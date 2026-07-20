/**
 * 100% health check: Proxmox + shared IP registry (TG bot) + recent bulletproof VPS.
 *
 * Usage (on billing server):
 *   cd /var/www/dior-billing/backend
 *   pnpm exec tsx scripts/verify-shared-ip-and-vps.ts
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import {
  getProxmoxClient,
  getProxmoxConfig,
  getProxmoxNodeName,
  isProxmoxConfigured,
  isSharedIpRegistryEnabled,
  isSharedIpRegistryRequired,
  resolveProxmoxNetwork,
  syncProxmoxUsedIpsToInventory,
} from "../src/proxmox";
import { validateVpsBillingCredentials } from "../src/servers/vps-access";

loadMonorepoEnv();

type Check = { name: string; ok: boolean; detail: string };

function flag(v: boolean): string {
  return v ? "YES" : "NO";
}

async function main() {
  const checks: Check[] = [];
  let fatal = false;

  console.log("=== ENV / MODE ===");
  const proxmoxOk = isProxmoxConfigured();
  const registryOn = isSharedIpRegistryEnabled();
  const registryRequired = isSharedIpRegistryRequired();
  const network = process.env.PROXMOX_NETWORK?.trim() || "(unset)";
  const gateway = process.env.PROXMOX_GATEWAY?.trim() || "(unset)";
  const botSql = Boolean(process.env.TELEGRAM_BOT_IPS_SQL?.trim());

  console.log(`proxmoxConfigured=${flag(proxmoxOk)}`);
  console.log(`sharedIpRegistry=${flag(registryOn)}`);
  console.log(`requireRegistry=${flag(registryRequired)}`);
  console.log(`PROXMOX_NETWORK=${network}`);
  console.log(`PROXMOX_GATEWAY=${gateway}`);
  console.log(`TELEGRAM_BOT_IPS_SQL=${flag(botSql)} (legacy read-only; ignored when requireRegistry=1)`);

  checks.push({
    name: "Proxmox API configured",
    ok: proxmoxOk,
    detail: proxmoxOk ? getProxmoxConfig()!.apiUrl : "PROXMOX_BASE_URL / TOKEN missing",
  });
  checks.push({
    name: "Shared IP registry required",
    ok: registryRequired,
    detail: registryRequired
      ? "PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 — single source of truth"
      : "NOT set — duplicate risk with TG bot remains",
  });

  if (!proxmoxOk) fatal = true;
  if (!registryRequired) fatal = true;

  console.log("\n=== PROXMOX LIVE SCAN ===");
  if (proxmoxOk) {
    try {
      const client = getProxmoxClient()!;
      const net = await resolveProxmoxNetwork("debian12");
      const scan = await client.collectUsedIpsOnClusterDetailed(net.prefix);
      console.log(
        `scan: ${scan.ips.size} IPs from ${scan.scanned} VMs/LXC` +
          (scan.noIpDetected ? ` (${scan.noIpDetected} without detectable IP)` : ""),
      );
      checks.push({
        name: "Proxmox cluster reachable",
        ok: scan.scanned > 0,
        detail: `${scan.scanned} VMs scanned, ${scan.ips.size} IPs visible`,
      });
      if (scan.scanned === 0) fatal = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Proxmox scan failed:", msg);
      checks.push({ name: "Proxmox cluster reachable", ok: false, detail: msg });
      fatal = true;
    }
  }

  console.log("\n=== SHARED REGISTRY (network_ip_allocations) ===");
  try {
    const byOwner = await prisma.$queryRaw<
      Array<{ owner: string; status: string; cnt: bigint }>
    >`
      SELECT owner, status, COUNT(*) AS cnt
      FROM network_ip_allocations
      GROUP BY owner, status
      ORDER BY owner, status
    `;

    if (byOwner.length === 0) {
      console.log("(table empty — run sync-shared-ip-registry)");
      checks.push({
        name: "Registry has rows",
        ok: false,
        detail: "network_ip_allocations is empty",
      });
      fatal = true;
    } else {
      console.log("owner / status / count:");
      let billingActive = 0;
      let botActive = 0;
      let totalOccupied = 0;
      for (const row of byOwner) {
        const n = Number(row.cnt);
        console.log(`  ${row.owner.padEnd(16)} ${row.status.padEnd(10)} ${n}`);
        if (row.status === "reserved" || row.status === "active") {
          totalOccupied += n;
          if (row.owner === "billing") billingActive += n;
          if (row.owner === "telegram_bot") botActive += n;
        }
      }
      checks.push({
        name: "Registry populated",
        ok: totalOccupied > 0,
        detail: `${totalOccupied} occupied (reserved+active)`,
      });
      checks.push({
        name: "TG bot writes to shared registry",
        ok: botActive > 0,
        detail:
          botActive > 0
            ? `${botActive} telegram_bot reserved/active rows`
            : "NO telegram_bot rows — bot may not use SHARED_IP_DATABASE_URL (HIGH duplicate risk if bot still allocates alone)",
      });
      if (botActive === 0) fatal = true;
      checks.push({
        name: "Billing writes to shared registry",
        ok: billingActive > 0,
        detail:
          billingActive > 0
            ? `${billingActive} billing reserved/active rows`
            : "No billing rows yet (ok if never sold via web)",
      });
    }

    const dupes = await prisma.$queryRaw<Array<{ ip: string; c: bigint }>>`
      SELECT ip, COUNT(*) AS c
      FROM network_ip_allocations
      WHERE status IN ('reserved', 'active')
      GROUP BY ip
      HAVING COUNT(*) > 1
    `;
    checks.push({
      name: "No duplicate occupied IPs in registry",
      ok: dupes.length === 0,
      detail:
        dupes.length === 0
          ? "UNIQUE(ip) + no duplicate occupied rows"
          : dupes.map((d) => `${d.ip}×${d.c}`).join(", "),
    });
    if (dupes.length > 0) fatal = true;

    const sync = await syncProxmoxUsedIpsToInventory();
    console.log(`Next free IP: ${sync.nextFree ?? "NONE"}`);
    checks.push({
      name: "Free IP available for next purchase",
      ok: Boolean(sync.nextFree),
      detail: sync.nextFree ?? "subnet / range exhausted",
    });
    if (!sync.nextFree) fatal = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Registry query failed:", msg);
    checks.push({ name: "Registry table readable", ok: false, detail: msg });
    fatal = true;
  }

  console.log("\n=== RECENT BILLING VPS (bulletproof path) ===");
  const recent = await prisma.vpsInstance.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      service: { select: { status: true, label: true, monthlyPrice: true } },
      location: { select: { code: true, name: true } },
    },
  });

  if (recent.length === 0) {
    console.log("No VPS in billing DB");
    checks.push({
      name: "Billing has provisioned VPS",
      ok: false,
      detail: "No rows — never purchased or wrong DATABASE_URL",
    });
  } else {
    console.log(
      "hostname".padEnd(18),
      "status".padEnd(12),
      "ip".padEnd(16),
      "vmid".padEnd(6),
      "loc".padEnd(10),
      "ok?",
    );
    let activeWithIp = 0;
    let credentialOk = 0;
    let mismatch = 0;

    for (const v of recent) {
      let mark = "—";
      if (v.service.status === "ACTIVE" && v.primaryIp && v.proxmoxVmid) {
        activeWithIp++;
        try {
          const cred = await validateVpsBillingCredentials(v.id);
          if (cred.ok) {
            credentialOk++;
            mark = "OK";
          } else {
            mark = `BAD:${cred.errors[0] ?? "?"}`;
            mismatch++;
          }
        } catch (e) {
          mark = e instanceof Error ? e.message.slice(0, 40) : "err";
          mismatch++;
        }
      } else if (v.service.status === "ACTIVE" && !v.primaryIp) {
        mark = "NO_IP";
        mismatch++;
      } else {
        mark = v.service.status;
      }
      console.log(
        v.hostname.padEnd(18),
        v.service.status.padEnd(12),
        (v.primaryIp ?? "—").padEnd(16),
        String(v.proxmoxVmid ?? "—").padEnd(6),
        (v.location?.code ?? "—").padEnd(10),
        mark,
      );
    }

    checks.push({
      name: "Recent ACTIVE VPS have IP+VMID",
      ok: activeWithIp > 0,
      detail: `${activeWithIp} ACTIVE with IP+VMID of ${recent.length} recent`,
    });
    checks.push({
      name: "Credentials / Proxmox match for ACTIVE",
      ok: mismatch === 0 && credentialOk > 0,
      detail:
        mismatch === 0
          ? `${credentialOk} ACTIVE passed credential+Proxmox checks`
          : `${mismatch} problems — see rows above`,
    });
    if (activeWithIp === 0) fatal = true;
  }

  console.log("\n=== REGISTRY vs BILLING ACTIVE IPS ===");
  const billingActiveIps = await prisma.vpsInstance.findMany({
    where: {
      primaryIp: { not: null },
      service: { status: { in: ["ACTIVE", "PROVISIONING", "PENDING"] } },
    },
    select: { primaryIp: true, hostname: true, proxmoxVmid: true },
  });
  let missingInRegistry = 0;
  for (const v of billingActiveIps) {
    if (!v.primaryIp) continue;
    const row = await prisma.networkIpAllocation.findUnique({
      where: { ip: v.primaryIp },
      select: { status: true, owner: true, vmid: true },
    });
    if (!row || (row.status !== "active" && row.status !== "reserved")) {
      console.log(`MISSING registry: ${v.hostname} ${v.primaryIp}`);
      missingInRegistry++;
    }
  }
  checks.push({
    name: "All billing VPS IPs present in registry",
    ok: missingInRegistry === 0,
    detail:
      missingInRegistry === 0
        ? `${billingActiveIps.length} billing IPs tracked`
        : `${missingInRegistry} billing IPs not active/reserved in registry`,
  });
  if (missingInRegistry > 0) fatal = true;

  console.log("\n=== SUMMARY ===");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`      ${c.detail}`);
  }

  if (fatal) {
    console.log("\nRESULT: FAIL — do not sell until fixed");
    process.exit(1);
  }
  console.log("\nRESULT: PASS — shared registry + Proxmox + recent VPS look healthy");
  console.log(
    "Note: TCP :22 from billing host to client subnet often fails by design; test SSH from your PC.",
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
