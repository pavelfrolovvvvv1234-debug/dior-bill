import { loadMonorepoEnv } from "../src/lib/load-env";

loadMonorepoEnv();

async function main() {
  const {
    isHostVdsConfigured,
    getHostVdsRegion,
    resolveHostVdsFlavorName,
    resolveHostVdsImageName,
    getHostVdsNetworkRef,
  } = await import("../src/hostvds/config");
  const { resolveFlavor, resolveImage, resolveNetwork, assertSecurityGroupExists } =
    await import("../src/hostvds/resolve");

  console.log("configured=", isHostVdsConfigured(), "region=", getHostVdsRegion());
  if (!isHostVdsConfigured()) {
    process.exitCode = 1;
    return;
  }

  const flavorName = resolveHostVdsFlavorName({
    planId: "std-1",
    cpuCores: 1,
    ramMb: 1024,
    diskGb: 10,
  });
  const imageName = resolveHostVdsImageName("ubuntu-24.04");
  const netRef = getHostVdsNetworkRef();
  console.log("names", { flavorName, imageName, netRef });

  const [flavor, image, network] = await Promise.all([
    resolveFlavor(flavorName),
    resolveImage(imageName),
    resolveNetwork(netRef),
  ]);
  console.log("resolved", {
    flavor: `${flavor.slice(0, 8)}…`,
    image: `${image.slice(0, 8)}…`,
    network: `${network.slice(0, 8)}…`,
  });
  await assertSecurityGroupExists("allow_all");
  console.log("security group allow_all: OK");
  console.log("HOSTVDS_AUTH_OK");
}

main().catch((err) => {
  console.error("HOSTVDS_AUTH_FAIL", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
