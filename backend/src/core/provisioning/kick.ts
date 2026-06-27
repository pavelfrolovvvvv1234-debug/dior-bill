import { prisma } from "@dior/database";
import { startProvisioning } from "./engine";

const PROVISION_STATUSES = new Set(["PENDING", "FAILED", "ROLLBACK"]);

/** Start VPS provisioning immediately after payment (do not wait for worker queue). */
export async function kickVpsProvisioningForServiceIds(
  serviceIds: string[],
  idempotencyKey: string,
): Promise<void> {
  for (const serviceId of serviceIds) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.type !== "VPS") continue;
    if (!PROVISION_STATUSES.has(service.status)) continue;

    try {
      await startProvisioning({
        serviceId,
        idempotencyKey: `provision:${serviceId}:${idempotencyKey}`,
      });
    } catch (err) {
      console.error(`[provision-kick] service ${serviceId}:`, err);
    }
  }
}
