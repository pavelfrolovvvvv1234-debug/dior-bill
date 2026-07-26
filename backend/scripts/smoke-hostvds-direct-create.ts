import { loadMonorepoEnv } from "../src/lib/load-env";
loadMonorepoEnv();

import { generateHostVdsPassword, getHostVdsNetworkRef, getHostVdsSecurityGroups, resolveHostVdsFlavorName, resolveHostVdsImageName, getHostVdsRegion } from "../src/hostvds/config";
import { resolveFlavor, resolveImage, resolveNetwork, assertSecurityGroupExists } from "../src/hostvds/resolve";
import { buildHostVdsCloudInitUserData } from "../src/hostvds/cloud-init";
import { hostVdsCreateServer, hostVdsDeleteServer, hostVdsWaitForServer } from "../src/hostvds/servers";
import { waitForSshReady } from "../src/hostvds/ssh-ready";

async function main() {
  const password = generateHostVdsPassword();
  const flavorName = resolveHostVdsFlavorName({ planId: "std-1", cpuCores: 1, ramMb: 1024, diskGb: 10 });
  const imageName = resolveHostVdsImageName("ubuntu-24.04");
  const [imageRef, flavorRef, networkId] = await Promise.all([
    resolveImage(imageName),
    resolveFlavor(flavorName),
    resolveNetwork(getHostVdsNetworkRef()),
  ]);
  for (const sg of getHostVdsSecurityGroups()) await assertSecurityGroupExists(sg);

  const name = `hv-direct-${Date.now().toString(36).slice(-5)}`;
  console.log("creating", { name, flavorName, imageName, region: getHostVdsRegion() });
  const created = await hostVdsCreateServer({
    name,
    imageRef,
    flavorRef,
    networkId,
    adminPass: password,
    userData: buildHostVdsCloudInitUserData(password),
    metadata: { managed_by: "web_billing", smoke: "direct" },
  });
  console.log("created", created.id, created.status);

  try {
    const ready = await hostVdsWaitForServer(created.id);
    const ip = ready.addresses[0];
    console.log("ACTIVE", { ip, status: ready.status });
    if (!ip) throw new Error("no ip");
    await waitForSshReady(ip);
    console.log("SSH_OK", { ip, user: "root", password });
  } finally {
    console.log("cleanup delete", created.id);
    await hostVdsDeleteServer(created.id);
    console.log("deleted");
  }
}

main().catch((e) => {
  console.error("DIRECT_FAIL", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
