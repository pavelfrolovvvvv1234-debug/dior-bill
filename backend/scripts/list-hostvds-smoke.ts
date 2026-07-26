import { loadMonorepoEnv } from "../src/lib/load-env";
loadMonorepoEnv();

import { hostVdsRequest } from "../src/hostvds/client";

async function main() {
  const data = await hostVdsRequest<{
    servers: Array<{ id: string; name: string; status: string; metadata?: Record<string, string> }>;
  }>("/servers/detail");
  const list = data.servers ?? [];
  const ours = list.filter(
    (s) =>
      s.name?.startsWith("hv-smoke") ||
      s.metadata?.managed_by === "web_billing" ||
      s.metadata?.dior_vps_id,
  );
  console.log("total_servers", list.length);
  console.log(
    "ours",
    ours.map((s) => ({
      id: s.id.slice(0, 8),
      name: s.name,
      status: s.status,
      vps: s.metadata?.dior_vps_id?.slice(0, 10),
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
