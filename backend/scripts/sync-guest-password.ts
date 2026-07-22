/**
 * Push billing rootPasswordEnc into the guest via qemu-guest-agent,
 * enable password SSH, and verify login from this host when possible.
 *
 * Usage: pnpm exec tsx scripts/sync-guest-password.ts testoepta
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { decrypt } from "../src/lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { resolveVpsLoginUser } from "../src/servers/vps-access";

loadMonorepoEnv();

function trySshPasswordLogin(host: string, user: string, password: string): boolean {
  // Prefer sshpass when available
  const hasSshpass = spawnSync("which", ["sshpass"], { encoding: "utf8" }).status === 0;
  if (hasSshpass) {
    const r = spawnSync(
      "sshpass",
      [
        "-p",
        password,
        "ssh",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        "-o",
        "PreferredAuthentications=password",
        "-o",
        "PubkeyAuthentication=no",
        "-o",
        "NumberOfPasswordPrompts=1",
        "-o",
        "ConnectTimeout=10",
        `${user}@${host}`,
        "echo",
        "SSH_LOGIN_OK",
      ],
      { encoding: "utf8", timeout: 20_000 },
    );
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    console.log(`sshpass test exit=${r.status} out=${out.slice(0, 200).replace(/\n/g, " ")}`);
    return r.status === 0 && out.includes("SSH_LOGIN_OK");
  }

  // Fallback: Python3 (stdlib only) if present
  const py = `
import socket, sys
try:
    import paramiko
except ImportError:
    sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(${JSON.stringify(host)}, username=${JSON.stringify(user)}, password=${JSON.stringify(password)}, timeout=10, allow_agent=False, look_for_keys=False)
stdin, stdout, stderr = c.exec_command("echo SSH_LOGIN_OK")
print(stdout.read().decode())
c.close()
`.trim();
  const scriptPath = join(tmpdir(), `dior-ssh-test-${Date.now()}.py`);
  try {
    writeFileSync(scriptPath, py, "utf8");
    chmodSync(scriptPath, 0o600);
    const r = spawnSync("python3", [scriptPath], { encoding: "utf8", timeout: 25_000 });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    console.log(`paramiko test exit=${r.status} out=${out.slice(0, 200).replace(/\n/g, " ")}`);
    return r.status === 0 && out.includes("SSH_LOGIN_OK");
  } catch {
    console.log("No sshpass/paramiko — skip live SSH auth test (try WinSCP)");
    return false;
  } finally {
    try {
      unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/sync-guest-password.ts <hostname>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
    include: { node: true, service: true },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    console.error(`VPS not found / no VMID / no IP: ${name}`);
    process.exit(1);
  }
  if (!vps.rootPasswordEnc) {
    console.error("No rootPasswordEnc in billing DB");
    process.exit(1);
  }

  let password: string;
  try {
    password = decrypt(vps.rootPasswordEnc);
  } catch {
    console.error("Cannot decrypt rootPasswordEnc — check ENCRYPTION_KEY");
    process.exit(1);
  }

  const user = resolveVpsLoginUser(vps.os);
  const client = getProxmoxClient();
  if (!client) {
    console.error("Proxmox client unavailable");
    process.exit(1);
  }
  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const vmid = vps.proxmoxVmid;

  console.log(`=== ${vps.hostname} ===`);
  console.log(`vmid=${vmid} ip=${vps.primaryIp} user=${user}`);

  // Preflight: dump auth-related guest state
  await client.guestExec(node, vmid, [
    "/bin/bash",
    "-c",
    "getent passwd root; sshd -T 2>/dev/null | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication) ' || grep -RniE 'PermitRootLogin|PasswordAuthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d 2>/dev/null | head -40",
  ]);

  const ok = await client.guestSetUserPassword(node, vmid, user, password);
  if (!ok) {
    console.error("Failed to set password / unlock SSH in guest");
    process.exit(1);
  }

  console.log("\n=== WinSCP / PuTTY ===");
  console.log(`Host: ${vps.primaryIp}  Port: 22  User: ${user}`);
  console.log(`Password: ${password}`);
  console.log("(Delete saved session password in WinSCP, paste fresh)");

  console.log("\n=== Live SSH test from billing ===");
  const loginOk = trySshPasswordLogin(vps.primaryIp, user, password);
  if (loginOk) {
    console.log("OK — password auth works from billing host");
  } else {
    console.log(
      "Live test failed or unavailable. Install sshpass for verification: apt-get install -y sshpass",
    );
    console.log("Then re-run this script, or try WinSCP again after clearing saved password.");
  }

  await prisma.$disconnect();
  if (!loginOk) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
