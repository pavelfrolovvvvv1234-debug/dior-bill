import { prisma } from "@dior/database";
import { ValidationError } from "@dior/shared";
import { decrypt, encrypt } from "../lib/crypto";
import { toJsonValue } from "../lib/json";
import {
  markProvisioningComplete,
  markProvisioningFailed,
} from "../core/provisioning/engine";
import {
  clearProvisionPipelineIdempotency,
  isDuplicateProvisionRun,
  provisionPipelineKey,
} from "../provisioning/pipeline-guard";
import { enqueueJob } from "../lib/queue";
import { creditWallet } from "../payments/wallet";
import { buildHostVdsCloudInitUserData } from "./cloud-init";
import {
  generateHostVdsPassword,
  getHostVdsNetworkRef,
  getHostVdsRegion,
  getHostVdsSecurityGroups,
  isHostVdsConfigured,
  resolveHostVdsFlavorName,
  resolveHostVdsImageName,
} from "./config";
import { resolveFlavor, resolveImage, resolveNetwork, assertSecurityGroupExists } from "./resolve";
import { hostVdsRegionFromLocationCode } from "./regions";
import {
  hostVdsCreateServer,
  hostVdsDeleteServer,
  hostVdsFindServerByVpsId,
  hostVdsGetServer,
  hostVdsWaitForServer,
} from "./servers";
import { waitForSshReady } from "./ssh-ready";
import type { ProvisioningStep } from "../provisioning/state-machine";

function regionFromCloudInit(cloudInit: unknown): string | null {
  if (!cloudInit || typeof cloudInit !== "object") return null;
  const raw = (cloudInit as { hostvdsRegion?: unknown }).hostvdsRegion;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function resolveHostVdsRegionForVps(vps: {
  location?: { code: string } | null;
  cloudInit?: unknown;
}): string {
  return (
    regionFromCloudInit(vps.cloudInit) ??
    (vps.location?.code ? hostVdsRegionFromLocationCode(vps.location.code) : null) ??
    getHostVdsRegion()
  );
}

const HOSTVDS_STEPS: ProvisioningStep[] = [
  { name: "Create order", phase: "queued", status: "pending" },
  { name: "Create VPS", phase: "cloning_template", status: "pending" },
  { name: "Wait for boot", phase: "starting_vm", status: "pending" },
  { name: "Fetch IP + SSH", phase: "allocating_ip", status: "pending" },
  { name: "Finalize", phase: "syncing_metrics", status: "pending" },
];

async function updateJob(
  jobId: string,
  data: {
    status?: string;
    progress?: number;
    currentStep?: string;
    steps?: ProvisioningStep[];
    error?: string | null;
  },
) {
  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      ...data,
      steps: data.steps ? toJsonValue(data.steps) : undefined,
    },
  });
}

async function markStep(
  steps: ProvisioningStep[],
  index: number,
  status: ProvisioningStep["status"],
  progress: number,
  jobId: string,
) {
  steps[index] = { ...steps[index], status };
  await updateJob(jobId, {
    steps,
    progress,
    currentStep: steps[index]?.phase,
    status: status === "failed" ? "failed" : "running",
  });
}

async function clearHostVdsLinkage(vpsId: string) {
  await prisma.vpsInstance.update({
    where: { id: vpsId },
    data: { externalId: null, primaryIp: null },
  });
}

async function refundHostVdsOrder(serviceId: string, reason: string): Promise<void> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { userId: true, label: true, monthlyPrice: true },
  });
  if (!service) return;

  const refundDescription = `Refund: Standard VPS ${serviceId}`;
  const already = await prisma.transaction.findFirst({
    where: {
      userId: service.userId,
      type: "CREDIT",
      description: refundDescription,
    },
  });
  if (already) return;

  const paid = await prisma.invoiceItem.findFirst({
    where: {
      serviceId,
      invoice: { userId: service.userId, status: "PAID" },
    },
    include: { invoice: true },
    orderBy: { invoice: { paidAt: "desc" } },
  });

  const amount = paid ? Number(paid.total) : Number(service.monthlyPrice);
  if (!(amount > 0)) return;

  await creditWallet({
    userId: service.userId,
    amount,
    description: refundDescription,
    metadata: {
      serviceId,
      reason,
      invoiceId: paid?.invoiceId ?? null,
      label: service.label,
    },
  });
}

/**
 * HostVDS provision — create ONCE; retry only wait/GET/SSH when externalId exists.
 */
export async function runHostVdsProvisionPipeline(payload: {
  serviceId: string;
  vpsId: string;
  jobId: string;
  idempotencyKey?: string;
  planId?: string;
}): Promise<void> {
  if (!isHostVdsConfigured()) {
    throw new ValidationError(
      "HostVDS is not configured — set HOSTVDS_AUTH_URL + credentials (or API token)",
    );
  }

  const pipelineKey = provisionPipelineKey(payload.serviceId);
  if (await isDuplicateProvisionRun(payload)) return;

  const serviceRow = await prisma.service.findUnique({
    where: { id: payload.serviceId },
    select: { status: true },
  });
  if (serviceRow?.status === "ACTIVE") return;
  if (
    serviceRow?.status === "DELETED" ||
    serviceRow?.status === "CANCELLED" ||
    serviceRow?.status === "EXPIRED"
  ) {
    return;
  }

  const jobRow = await prisma.provisioningJob.findUnique({
    where: { id: payload.jobId },
    select: { status: true, attempts: true, maxAttempts: true },
  });
  if (jobRow?.status === "completed") return;

  await clearProvisionPipelineIdempotency(payload.serviceId);

  const idemKey = payload.idempotencyKey ?? pipelineKey;
  const job = await prisma.provisioningJob.findUniqueOrThrow({
    where: { id: payload.jobId },
  });
  const attempts = job.attempts + 1;
  const steps = HOSTVDS_STEPS.map((s) => ({ ...s }));

  await prisma.provisioningJob.update({
    where: { id: payload.jobId },
    data: {
      status: "running",
      attempts,
      startedAt: job.startedAt ?? new Date(),
      steps: toJsonValue(steps),
    },
  });

  const vps = await prisma.vpsInstance.findUniqueOrThrow({
    where: { id: payload.vpsId },
    include: { location: true },
  });
  const region = resolveHostVdsRegionForVps(vps);

  let externalId = vps.externalId;
  let assignedIp: string | null = vps.primaryIp;
  /** True once Nova accepted create (or we recovered existing) — never POST create again. */
  let createAccepted = Boolean(externalId);

  try {
    const stillWanted = await prisma.service.findUnique({
      where: { id: payload.serviceId },
      select: { status: true },
    });
    if (
      stillWanted?.status === "DELETED" ||
      stillWanted?.status === "CANCELLED" ||
      stillWanted?.status === "EXPIRED"
    ) {
      if (externalId) {
        await hostVdsDeleteServer(externalId, { region }).catch(() => undefined);
        await clearHostVdsLinkage(payload.vpsId).catch(() => undefined);
      }
      await updateJob(payload.jobId, {
        status: "failed",
        error: "Service cancelled during provisioning",
      });
      return;
    }

    await markStep(steps, 0, "done", 10, payload.jobId);

    const password =
      vps.rootPasswordEnc
        ? null
        : generateHostVdsPassword();

    if (password) {
      await prisma.vpsInstance.update({
        where: { id: payload.vpsId },
        data: { rootPasswordEnc: encrypt(password) },
      });
    }

    const adminPass = password
      ? password
      : decrypt(
          (
            await prisma.vpsInstance.findUniqueOrThrow({
              where: { id: payload.vpsId },
              select: { rootPasswordEnc: true },
            })
          ).rootPasswordEnc!,
        );

    if (!externalId) {
      await markStep(steps, 1, "running", 25, payload.jobId);

      // Recover orphan from crash / timeout after Nova accepted create.
      const existing = await hostVdsFindServerByVpsId(payload.vpsId, { region });
      if (existing) {
        externalId = existing.id;
        createAccepted = true;
      } else {
        // Persist "create posted" BEFORE the HTTP call so a timeout cannot double-create.
        const createPostedKey = `hostvds:create-posted:${payload.vpsId}`;
        const alreadyPosted = await prisma.domainEvent.findFirst({
          where: { idempotencyKey: createPostedKey },
        });

        if (alreadyPosted || attempts > 1) {
          // One more metadata scan (list may lag); then fail — never POST again.
          const again = await hostVdsFindServerByVpsId(payload.vpsId, { region });
          if (again) {
            externalId = again.id;
            createAccepted = true;
          } else {
            throw new ValidationError(
              "HostVDS create already attempted — refusing duplicate create. Contact support for refund.",
            );
          }
        } else {
          const planId =
            payload.planId ??
            (vps.cloudInit && typeof vps.cloudInit === "object" && "planId" in vps.cloudInit
              ? String((vps.cloudInit as { planId?: string }).planId ?? "")
              : undefined);

          const flavorName = resolveHostVdsFlavorName({
            planId,
            cpuCores: vps.cpuCores,
            ramMb: vps.ramMb,
            diskGb: vps.diskGb,
          });
          const imageName = resolveHostVdsImageName(vps.os);
          const networkRef = getHostVdsNetworkRef();

          const [imageRef, flavorRef, networkId] = await Promise.all([
            resolveImage(imageName, region),
            resolveFlavor(flavorName, region),
            resolveNetwork(networkRef, region),
          ]);

          for (const sg of getHostVdsSecurityGroups()) {
            await assertSecurityGroupExists(sg, region);
          }

          // Atomic lock: only one runner may POST /servers.
          try {
            await prisma.domainEvent.create({
              data: {
                eventType: "hostvds.create_posted",
                aggregateType: "vps",
                aggregateId: payload.vpsId,
                payload: { serviceId: payload.serviceId, hostname: vps.hostname, region },
                idempotencyKey: createPostedKey,
              },
            });
          } catch {
            const raced = await hostVdsFindServerByVpsId(payload.vpsId, { region });
            if (raced) {
              externalId = raced.id;
              createAccepted = true;
            } else {
              throw new ValidationError(
                "HostVDS create already attempted — refusing duplicate create. Contact support for refund.",
              );
            }
          }

          if (!externalId) {
            try {
              const created = await hostVdsCreateServer({
                name: vps.hostname,
                imageRef,
                flavorRef,
                networkId,
                adminPass,
                userData: buildHostVdsCloudInitUserData(adminPass),
                region,
                metadata: {
                  managed_by: "web_billing",
                  dior_vps_id: payload.vpsId,
                  dior_service_id: payload.serviceId,
                  os_key: vps.os,
                  rate_id: planId ?? "",
                  region,
                },
              });
              externalId = created.id;
              createAccepted = true;
            } catch (createErr) {
              // Timeout / network after accept: recover by metadata before failing.
              const recovered = await hostVdsFindServerByVpsId(payload.vpsId, { region });
              if (recovered) {
                externalId = recovered.id;
                createAccepted = true;
              } else {
                throw createErr;
              }
            }
          }
        }
      }

      const prevCi =
        vps.cloudInit && typeof vps.cloudInit === "object" && !Array.isArray(vps.cloudInit)
          ? (vps.cloudInit as Record<string, unknown>)
          : {};
      await prisma.vpsInstance.update({
        where: { id: payload.vpsId },
        data: {
          externalId,
          provider: "hostvds",
          cloudInit: toJsonValue({ ...prevCi, hostvdsRegion: region }),
        },
      });
      await markStep(steps, 1, "done", 45, payload.jobId);
    } else {
      try {
        await hostVdsGetServer(externalId, { region });
      } catch {
        await clearHostVdsLinkage(payload.vpsId);
        externalId = null;
        assignedIp = null;
        throw new ValidationError(
          "HostVDS server linkage was stale — will not auto-recreate (create-once policy)",
        );
      }
      createAccepted = true;
      await markStep(steps, 1, "done", 45, payload.jobId);
    }

    if (!externalId) {
      throw new ValidationError("HostVDS server id missing after create");
    }

    await markStep(steps, 2, "running", 55, payload.jobId);
    const ready = await hostVdsWaitForServer(externalId, { region });

    const afterBoot = await prisma.service.findUnique({
      where: { id: payload.serviceId },
      select: { status: true },
    });
    if (
      afterBoot?.status === "DELETED" ||
      afterBoot?.status === "CANCELLED" ||
      afterBoot?.status === "EXPIRED"
    ) {
      await hostVdsDeleteServer(externalId, { region }).catch(() => undefined);
      await clearHostVdsLinkage(payload.vpsId).catch(() => undefined);
      await updateJob(payload.jobId, {
        status: "failed",
        error: "Service cancelled during provisioning",
      });
      return;
    }

    await markStep(steps, 2, "done", 75, payload.jobId);

    await markStep(steps, 3, "running", 85, payload.jobId);
    assignedIp = ready.addresses[0] ?? null;
    if (!assignedIp) {
      // Re-fetch — IP may appear shortly after ACTIVE
      for (let i = 0; i < 12 && !assignedIp; i++) {
        await new Promise((r) => setTimeout(r, 5_000));
        const again = await hostVdsGetServer(externalId, { region });
        assignedIp = again.addresses[0] ?? null;
      }
    }
    if (!assignedIp) {
      throw new ValidationError("HostVDS server is ACTIVE but has no IPv4 yet");
    }

    await waitForSshReady(assignedIp);

    await prisma.vpsInstance.update({
      where: { id: payload.vpsId },
      data: { primaryIp: assignedIp, provider: "hostvds", externalId },
    });
    await markStep(steps, 3, "done", 95, payload.jobId);

    await markStep(steps, 4, "running", 98, payload.jobId);
    await markProvisioningComplete({
      serviceId: payload.serviceId,
      idempotencyKey: idemKey,
      ip: assignedIp,
    });
    await markStep(steps, 4, "done", 100, payload.jobId);

    await updateJob(payload.jobId, {
      status: "completed",
      progress: 100,
      currentStep: "completed",
      error: null,
    });
    await prisma.provisioningJob.update({
      where: { id: payload.jobId },
      data: { completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "HostVDS provision failed";
    const maxAttempts = job.maxAttempts ?? 3;
    const canRetryWait =
      createAccepted &&
      Boolean(externalId) &&
      attempts < maxAttempts &&
      !/refusing duplicate create|stale — will not auto-recreate/i.test(message);

    await updateJob(payload.jobId, {
      status: canRetryWait ? "queued" : "failed",
      error: message,
    });

    if (canRetryWait) {
      await clearProvisionPipelineIdempotency(payload.serviceId);
      await enqueueJob("vps.provision", {
        serviceId: payload.serviceId,
        vpsId: payload.vpsId,
        jobId: payload.jobId,
        idempotencyKey: pipelineKey,
      }).catch((e) => console.warn("[hostvds-provision] re-queue failed:", e));
      return;
    }

    // Terminal: destroy orphan + refund
    if (externalId) {
      await hostVdsDeleteServer(externalId, { region }).catch((e) =>
        console.warn("[hostvds-provision] cleanup delete failed:", e),
      );
      await clearHostVdsLinkage(payload.vpsId).catch(() => undefined);
    }

    await refundHostVdsOrder(payload.serviceId, message).catch((e) =>
      console.error("[hostvds-provision] refund failed:", e),
    );

    await markProvisioningFailed({
      serviceId: payload.serviceId,
      idempotencyKey: idemKey,
      error: message,
      rollback: true,
    });
    throw err;
  }
}
