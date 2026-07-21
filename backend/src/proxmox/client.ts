/**
 * Proxmox VE API client
 * @see https://pve.proxmox.com/pve-docs/api-viewer/
 */
import { readFileSync } from "node:fs";
import https from "node:https";
import { URL } from "node:url";
import type { ProxmoxRuntimeConfig } from "./config";
import { getProxmoxCiUser, getProxmoxConfig } from "./config";
import {
  buildNet0LikeReference,
  loadReferenceVmConfig,
  pickReferenceHardwareFields,
} from "./reference-vm-profile";

export interface VmSpec {
  vmid: number;
  node: string;
  hostname: string;
  cores: number;
  memoryMb: number;
  diskGb: number;
  templateVmid: number;
  primaryIp?: string;
  gateway?: string;
  ipCidr?: number;
  rootPassword?: string;
  ciuser?: string;
  storage: string;
  bridge: string;
}

export class ProxmoxApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ProxmoxApiError";
  }
}

type ProxmoxEnvelope<T> = { data: T };

export class ProxmoxClient {
  private readonly agent: https.Agent;

  constructor(private readonly config: ProxmoxRuntimeConfig) {
    const ca = config.caCertPath
      ? readFileSync(config.caCertPath)
      : undefined;
    this.agent = new https.Agent({
      rejectUnauthorized: !config.insecureTls,
      ...(ca ? { ca } : {}),
    });
  }

  private request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | URLSearchParams,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const url = new URL(`${this.config.apiUrl}${path.startsWith("/") ? path : `/${path}`}`);
    const headers: Record<string, string> = {
      Authorization: `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`,
    };

    let requestBody: string | undefined;
    if (body instanceof URLSearchParams) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = body.toString();
    } else if (body) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
    if (requestBody) {
      headers["Content-Length"] = String(Buffer.byteLength(requestBody));
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          agent: this.agent,
          timeout: options?.timeoutMs ?? 120_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            const status = res.statusCode ?? 500;
            if (status < 200 || status >= 300) {
              reject(new ProxmoxApiError(status, text || res.statusMessage || "Request failed"));
              return;
            }
            if (!text) {
              resolve(undefined as T);
              return;
            }
            try {
              const json = JSON.parse(text) as ProxmoxEnvelope<T> | T;
              if (json && typeof json === "object" && "data" in json) {
                resolve((json as ProxmoxEnvelope<T>).data);
              } else {
                resolve(json as T);
              }
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy(new Error(`Proxmox API timed out (${method} ${path})`));
      });
      if (requestBody) req.write(requestBody);
      req.end();
    });
  }

  private async requestForm<T>(
    method: string,
    path: string,
    fields: Record<string, string | number | undefined>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    return this.request<T>(method, path, params, options);
  }

  async waitForTask(node: string, upid: string, timeoutMs = 600_000): Promise<void> {
    const started = Date.now();
    let lastLog = 0;
    while (Date.now() - started < timeoutMs) {
      const status = await this.request<{
        status: string;
        exitstatus?: string;
      }>(
        "GET",
        `/api2/json/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`,
        undefined,
        { timeoutMs: 300_000 },
      );

      if (status.status === "stopped") {
        if (status.exitstatus && status.exitstatus !== "OK") {
          throw new ProxmoxApiError(500, `Proxmox task failed: ${status.exitstatus}`);
        }
        return;
      }
      if (Date.now() - lastLog > 30_000) {
        console.log(`[proxmox] task still running: ${upid}`);
        lastLog = Date.now();
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new ProxmoxApiError(504, `Proxmox task timed out after ${Math.round(timeoutMs / 1000)}s: ${upid}`);
  }

  async getNextVmid(): Promise<number> {
    const data = await this.request<string | number>("GET", "/api2/json/cluster/nextid");
    return typeof data === "number" ? data : Number(data);
  }

  /** All QEMU + LXC VMIDs on the cluster (templates excluded). */
  async collectAllVmidsOnCluster(): Promise<Set<number>> {
    const ids = new Set<number>();
    const nodes = await this.listNodes();
    for (const { node } of nodes) {
      try {
        for (const vm of await this.listVms(node)) {
          if (vm.template === 1) continue;
          ids.add(vm.vmid);
        }
      } catch {
        /* node offline */
      }
      try {
        const lxcs = await this.request<
          Array<{ vmid: number; template?: number }>
        >("GET", `/api2/json/nodes/${node}/lxc`);
        for (const ct of lxcs) {
          if (ct.template === 1) continue;
          ids.add(ct.vmid);
        }
      } catch {
        /* no LXC */
      }
    }
    return ids;
  }

  /** Every guest VM/LXC on the cluster with detected IPs (for registry sync). */
  async collectClusterVmInventory(subnetPrefix?: string): Promise<
    Array<{
      vmid: number;
      name: string;
      node: string;
      kind: "qemu" | "lxc";
      ips: string[];
    }>
  > {
    const out: Array<{
      vmid: number;
      name: string;
      node: string;
      kind: "qemu" | "lxc";
      ips: string[];
    }> = [];

    let nodes: Array<{ node: string; status: string }>;
    try {
      nodes = await this.listNodes();
    } catch {
      return out;
    }

    for (const { node } of nodes) {
      let vms: Array<{
        vmid: number;
        name?: string;
        status?: string;
        template?: number;
      }>;
      try {
        vms = await this.listVms(node);
      } catch {
        vms = [];
      }

      for (const vm of vms) {
        if (vm.template === 1) continue;
        const ips = new Set<string>();
        try {
          const cfg = await this.getVmConfig(node, vm.vmid);
          for (const ip of this.parseIpsFromVmConfig(cfg, subnetPrefix)) ips.add(ip);
        } catch {
          /* mid-clone */
        }
        if (vm.status === "running") {
          for (const ip of await this.getGuestAgentIps(node, vm.vmid, subnetPrefix)) {
            ips.add(ip);
          }
        }
        out.push({
          vmid: vm.vmid,
          name: vm.name ?? `vm-${vm.vmid}`,
          node,
          kind: "qemu",
          ips: [...ips],
        });
      }

      let lxcs: Array<{
        vmid: number;
        name?: string;
        template?: number;
      }>;
      try {
        lxcs = await this.listLxc(node);
      } catch {
        lxcs = [];
      }

      for (const ct of lxcs) {
        if (ct.template === 1) continue;
        const ips = new Set<string>();
        try {
          const cfg = await this.getLxcConfig(node, ct.vmid);
          for (const ip of this.parseIpsFromVmConfig(cfg, subnetPrefix)) ips.add(ip);
        } catch {
          /* mid-create */
        }
        out.push({
          vmid: ct.vmid,
          name: ct.name ?? `ct-${ct.vmid}`,
          node,
          kind: "lxc",
          ips: [...ips],
        });
      }
    }

    return out;
  }

  async vmConfigExists(node: string, vmid: number): Promise<boolean> {
    try {
      await this.getVmConfig(node, vmid);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pick a VMID not used on the cluster. Proxmox cluster/nextid can return IDs whose
   * config still exists after interrupted clones — verify before clone.
   */
  async allocateFreeVmid(preferredNode?: string): Promise<number> {
    const occupied = await this.collectAllVmidsOnCluster();
    const node = preferredNode ?? this.config.node;
    let candidate = await this.getNextVmid();

    for (let attempt = 0; attempt < 64; attempt++) {
      if (!occupied.has(candidate) && !(await this.vmConfigExists(node, candidate))) {
        return candidate;
      }
      occupied.add(candidate);
      const raw = await this.request<string | number>(
        "GET",
        `/api2/json/cluster/nextid?vmid=${candidate}`,
      );
      candidate = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(candidate)) break;
    }

    throw new ProxmoxApiError(
      500,
      `Could not allocate free VMID (${occupied.size} IDs on cluster)`,
    );
  }

  /** Poll until VM config is gone after delete (interrupted clones leave stale configs). */
  async waitUntilVmidGone(node: string, vmid: number, timeoutMs = 120_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!(await this.vmConfigExists(node, vmid))) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new ProxmoxApiError(504, `VMID ${vmid} still exists on ${node} after destroy`);
  }

  async listNodes(): Promise<Array<{ node: string; status: string }>> {
    return this.request("GET", "/api2/json/nodes");
  }

  async cloneFromTemplate(spec: VmSpec): Promise<void> {
    console.log(
      `[proxmox] cloning template ${spec.templateVmid} → vmid ${spec.vmid} (${spec.hostname}) on ${spec.node}`,
    );
    const upid = await this.requestForm<string>(
      "POST",
      `/api2/json/nodes/${spec.node}/qemu/${spec.templateVmid}/clone`,
      {
        newid: spec.vmid,
        name: spec.hostname.replace(/[^a-zA-Z0-9.-]/g, "-").slice(0, 63),
        full: 1,
        storage: spec.storage,
      },
      { timeoutMs: 0 },
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(spec.node, upid, 900_000);
    }
  }

  /** Primary boot disk from cloned template (scsi0 vs virtio0). */
  resolvePrimaryBootDisk(config: Record<string, string>): string {
    for (const key of ["scsi0", "virtio0", "sata0", "ide0"]) {
      const val = config[key];
      if (val && !val.includes("cloudinit") && !val.includes("media=cdrom")) {
        return key;
      }
    }
    return "scsi0";
  }

  /**
   * Normalize net0 — preserve MAC from clone, disable Proxmox firewall.
   * @deprecated Prefer buildNet0LikeReference when reference VM is available.
   */
  buildNet0(existing: string | undefined, bridge: string): string {
    return buildNet0LikeReference(existing, undefined, bridge);
  }

  isCloudInitNetworkReady(
    cfg: Record<string, string>,
    expectedIp: string | undefined,
    ciuser: string,
  ): boolean {
    if (!cfg.ide2?.includes("cloudinit")) return false;
    if (!cfg.ipconfig0?.trim()) return false;
    if (cfg.ciuser?.trim() !== ciuser) return false;
    if (!cfg.cipassword?.trim()) return false;
    if (expectedIp && this.parseIpFromConfig(cfg) !== expectedIp) return false;
    const net0 = cfg.net0 ?? "";
    if (net0.includes("firewall=1")) return false;
    return true;
  }

  async resizeDisk(
    node: string,
    vmid: number,
    sizeGb: number,
    disk: string = "scsi0",
  ): Promise<void> {
    const upid = await this.requestForm<string>(
      "PUT",
      `/api2/json/nodes/${node}/qemu/${vmid}/resize`,
      {
        disk,
        size: `${sizeGb}G`,
      },
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 600_000);
    }
  }

  async configureVm(spec: VmSpec): Promise<void> {
    const existingCfg = await this.getVmConfig(spec.node, spec.vmid);
    const bootDisk = this.resolvePrimaryBootDisk(existingCfg);
    const referenceCfg = await loadReferenceVmConfig(spec.node);

    const fields: Record<string, string | number | undefined> = {
      cores: spec.cores,
      memory: spec.memoryMb,
      agent: 1,
      onboot: 1,
      ...(referenceCfg ? pickReferenceHardwareFields(referenceCfg) : {}),
    };

    if (spec.rootPassword) {
      fields.cipassword = spec.rootPassword;
      fields.ciuser = spec.ciuser ?? getProxmoxCiUser();
      fields.sshkeys = "";
      fields.citype = "configdrive2";
      const user = String(fields.ciuser);
      fields.ostype = referenceCfg?.ostype ?? (user === "Administrator" ? "win10" : "l26");
    }

    if (spec.primaryIp) {
      fields.net0 = buildNet0LikeReference(
        existingCfg.net0,
        referenceCfg?.net0,
        spec.bridge,
      );
      fields.boot = referenceCfg?.boot ?? `order=${bootDisk}`;
      fields.nameserver = referenceCfg?.nameserver ?? "1.1.1.1";
      if (referenceCfg?.searchdomain) {
        fields.searchdomain = referenceCfg.searchdomain;
      }
      const gw = spec.gateway ?? guessGateway(spec.primaryIp);
      fields.ipconfig0 = `ip=${spec.primaryIp}/${spec.ipCidr ?? 24},gw=${gw}`;
      fields.citype = referenceCfg?.citype ?? "configdrive2";
    }

    await this.requestForm(
      "PUT",
      `/api2/json/nodes/${spec.node}/qemu/${spec.vmid}/config`,
      fields,
    );

    try {
      await this.resizeDisk(spec.node, spec.vmid, spec.diskGb, bootDisk);
    } catch {
      /* template disk may already match plan size */
    }
  }

  async getVmConfig(node: string, vmid: number): Promise<Record<string, string>> {
    return this.request("GET", `/api2/json/nodes/${node}/qemu/${vmid}/config`);
  }

  async listLxc(
    node: string,
  ): Promise<Array<{ vmid: number; name?: string; status?: string; template?: number }>> {
    return this.request("GET", `/api2/json/nodes/${node}/lxc`);
  }

  async getLxcConfig(node: string, vmid: number): Promise<Record<string, string>> {
    return this.request("GET", `/api2/json/nodes/${node}/lxc/${vmid}/config`);
  }

  /** Regenerate cloud-init ISO (forces guest to re-apply network/password on next boot). */
  async regenerateCloudInit(node: string, vmid: number): Promise<void> {
    await this.requestForm(
      "PUT",
      `/api2/json/nodes/${node}/qemu/${vmid}/cloudinit`,
      {},
      { timeoutMs: 60_000 },
    );
  }

  /**
   * Attach cloud-init drive if missing. If ide2 already has cloudinit, regenerateCloudInit is enough.
   */
  async ensureCloudInitDrive(node: string, vmid: number, storage: string): Promise<void> {
    const cfg = await this.getVmConfig(node, vmid);
    if (cfg.ide2?.includes("cloudinit")) {
      return;
    }
    await this.requestForm("PUT", `/api2/json/nodes/${node}/qemu/${vmid}/config`, {
      ide2: `${storage}:cloudinit`,
      citype: "configdrive2",
    });
  }

  /** Drop stale cloud-init ISO and recreate drive (fixes broken first-boot seeds). */
  async rebuildCloudInitDrive(node: string, vmid: number, storage: string): Promise<void> {
    const cfg = await this.getVmConfig(node, vmid);
    if (cfg.ide2?.includes("cloudinit")) {
      try {
        await this.request(
          "DELETE",
          `/api2/json/nodes/${node}/qemu/${vmid}/config/ide2`,
          undefined,
          { timeoutMs: 60_000 },
        );
      } catch {
        /* may already be detached */
      }
    }
    await this.ensureCloudInitDrive(node, vmid, storage);
  }

  /** Update cloud-init login (requires reboot inside guest to apply password change). */
  async updateVmCloudInitCredentials(
    node: string,
    vmid: number,
    password: string,
    ciuser?: string,
  ): Promise<void> {
    await this.requestForm("PUT", `/api2/json/nodes/${node}/qemu/${vmid}/config`, {
      ciuser: ciuser ?? getProxmoxCiUser(),
      cipassword: password,
      sshkeys: "",
      citype: "configdrive2",
    });
  }

  async pingGuestAgent(node: string, vmid: number): Promise<boolean> {
    try {
      await this.request<{ result?: Record<string, unknown> }>(
        "POST",
        `/api2/json/nodes/${node}/qemu/${vmid}/agent/ping`,
        {},
        { timeoutMs: 10_000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  /** True when Proxmox says qemu-guest-agent is missing/down (never throw this to callers). */
  static isGuestAgentDownError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /guest agent is not running|guest-agent|No QEMU guest agent|agent is not running/i.test(
      msg,
    );
  }

  /** Run a command inside the guest via qemu-guest-agent. Returns exit code or null (never throws on agent-down). */
  async guestExec(node: string, vmid: number, command: string[]): Promise<number | null> {
    let started: { pid?: number };
    try {
      started = await this.request<{ pid?: number }>(
        "POST",
        `/api2/json/nodes/${node}/qemu/${vmid}/agent/exec`,
        { command },
        { timeoutMs: 30_000 },
      );
    } catch (err) {
      if (ProxmoxClient.isGuestAgentDownError(err)) {
        console.warn(`[proxmox] vmid=${vmid} guest-agent down — skip exec ${command[0] ?? ""}`);
        return null;
      }
      console.warn(
        `[proxmox] vmid=${vmid} guest exec failed:`,
        err instanceof Error ? err.message.slice(0, 160) : err,
      );
      return null;
    }
    const pid = started?.pid;
    if (pid == null) return null;

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      let status: {
        exited?: number;
        exitcode?: number;
        "out-data"?: string;
        "err-data"?: string;
      };
      try {
        status = await this.request(
          "GET",
          `/api2/json/nodes/${node}/qemu/${vmid}/agent/exec-status?pid=${pid}`,
          undefined,
          { timeoutMs: 15_000 },
        );
      } catch (err) {
        if (ProxmoxClient.isGuestAgentDownError(err)) return null;
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (status.exited === 1) {
        if (status.exitcode !== 0 && status["err-data"]) {
          try {
            const err = Buffer.from(status["err-data"], "base64").toString("utf8").trim();
            if (err) console.warn(`[proxmox] vmid=${vmid} guest exec stderr: ${err.slice(0, 200)}`);
          } catch {
            /* ignore */
          }
        }
        return status.exitcode ?? 0;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }

  /** Wipe stale cloud-init state cloned from template disk (required for template 902). */
  async guestCloudInitClean(node: string, vmid: number): Promise<boolean> {
    const attempts = [
      ["/usr/bin/cloud-init", "clean", "--logs"],
      ["/bin/bash", "-c", "cloud-init clean --logs"],
      ["cloud-init", "clean", "--logs"],
    ] as const;
    for (const cmd of attempts) {
      try {
        const code = await this.guestExec(node, vmid, [...cmd]);
        if (code === 0) {
          console.log(`[proxmox] vmid=${vmid} guest cloud-init clean succeeded (${cmd.join(" ")})`);
          return true;
        }
        if (code != null) {
          console.warn(`[proxmox] vmid=${vmid} guest exec exit ${code}: ${cmd.join(" ")}`);
        }
      } catch (e) {
        console.warn(
          `[proxmox] vmid=${vmid} guest exec ${cmd.join(" ")}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    return false;
  }

  /** Re-run cloud-init modules so guest re-reads Proxmox configdrive. */
  async guestForceCloudInitRun(node: string, vmid: number): Promise<boolean> {
    if (!(await this.pingGuestAgent(node, vmid))) {
      console.warn(`[proxmox] vmid=${vmid} guest-agent down — skip cloud-init force`);
      return false;
    }
    const steps = [
      ["cloud-init", "init"],
      ["cloud-init", "modules", "--mode=config"],
      ["cloud-init", "modules", "--mode=final"],
    ] as const;
    for (const step of steps) {
      let code = await this.guestExec(node, vmid, [...step]);
      if (code !== 0) {
        code = await this.guestExec(node, vmid, [`/usr/bin/${step[0]}`, ...step.slice(1)]);
      }
      if (code !== 0) {
        console.warn(`[proxmox] vmid=${vmid} cloud-init step failed (${step.join(" ")}), exit=${code}`);
        return false;
      }
    }
    console.log(`[proxmox] vmid=${vmid} cloud-init modules completed`);
    return true;
  }

  /**
   * Last resort when template cloud-init ignores Proxmox ipconfig0.
   * Configures IPv4 + default route inside guest via qemu-guest-agent.
   */
  async guestInjectStaticNetwork(
    node: string,
    vmid: number,
    ip: string,
    gateway: string,
    cidr = 24,
  ): Promise<boolean> {
    const script = [
      'IFACE=$(ip -o link show | awk -F": " \'/^[0-9]+: (eth|ens|enp)/ {gsub(/@.*/,"",$2); print $2; exit}\')',
      '[ -n "$IFACE" ] || exit 1',
      'ip link set "$IFACE" up || true',
      'ip addr flush dev "$IFACE" 2>/dev/null || true',
      `ip addr add ${ip}/${cidr} dev "$IFACE"`,
      `ip route replace default via ${gateway}`,
      'printf "nameserver 1.1.1.1\\n" > /etc/resolv.conf',
      'systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || service ssh restart 2>/dev/null || true',
    ].join("; ");
    const code = await this.guestExec(node, vmid, ["/bin/bash", "-c", script]);
    if (code === 0) {
      console.log(`[proxmox] vmid=${vmid} guest static network injected ${ip}/${cidr} gw=${gateway}`);
      return true;
    }
    console.warn(`[proxmox] vmid=${vmid} guest static network injection failed, exit=${code}`);
    return false;
  }

  /** Poll qemu-guest-agent for the first non-loopback IPv4. */
  async waitForGuestIp(node: string, vmid: number, timeoutMs = 300_000): Promise<string | null> {
    const started = Date.now();
    let lastLog = 0;
    while (Date.now() - started < timeoutMs) {
      const agentUp = await this.pingGuestAgent(node, vmid);
      if (agentUp) {
        try {
          const interfaces = await this.request<
            Array<{
              name?: string;
              "ip-addresses"?: Array<{ "ip-address"?: string; "ip-address-type"?: string }>;
            }>
          >(
            "GET",
            `/api2/json/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`,
            undefined,
            { timeoutMs: 15_000 },
          );

          for (const ip of this.extractIpv4FromAgentInterfaces(interfaces)) {
            return ip;
          }
        } catch {
          /* agent up but no IP yet */
        }
      }
      if (Date.now() - lastLog > 20_000) {
        console.log(
          `[proxmox] waiting for IP vmid ${vmid} (agent ${agentUp ? "up" : "down"})...`,
        );
        lastLog = Date.now();
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    return null;
  }

  parseIpFromConfig(config: Record<string, string>): string | null {
    const ipconfig0 = config.ipconfig0 ?? config.ipconfig1 ?? "";
    const match = ipconfig0.match(/ip=([0-9.]+)/);
    return match?.[1] ?? null;
  }

  /** Extract routable IPv4s from full VM/LXC config (ipconfig*, net*, description, notes). */
  parseIpsFromVmConfig(config: Record<string, string>, subnetPrefix?: string): string[] {
    const ips = new Set<string>();
    const ipv4InText = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;

    const addIp = (ip: string) => {
      if (ip.startsWith("127.") || ip.startsWith("169.254.") || ip.endsWith(".0") || ip.endsWith(".255")) {
        return;
      }
      if (subnetPrefix && !ip.startsWith(`${subnetPrefix}.`)) return;
      ips.add(ip);
    };

    for (const [key, value] of Object.entries(config)) {
      if (!value) continue;
      if (key.startsWith("ipconfig")) {
        const fromCfg = this.parseIpFromConfig({ ipconfig0: value });
        if (fromCfg) addIp(fromCfg);
      }
      if (key.startsWith("net")) {
        const netIp = value.match(/(?:^|,|\s)ip=([0-9.]+)/)?.[1];
        if (netIp) addIp(netIp);
      }
      if (key === "description" || key === "notes" || key === "name") {
        let match: RegExpExecArray | null;
        ipv4InText.lastIndex = 0;
        while ((match = ipv4InText.exec(value)) !== null) {
          addIp(match[1]);
        }
      }
    }
    return [...ips];
  }

  async startVm(node: string, vmid: number): Promise<void> {
    const upid = await this.requestForm<string>(
      "POST",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/start`,
      {},
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 60_000);
    }
  }

  async stopVm(node: string, vmid: number): Promise<void> {
    const upid = await this.requestForm<string>(
      "POST",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/stop`,
      {},
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 60_000);
    }
  }

  async rebootVm(node: string, vmid: number): Promise<void> {
    const upid = await this.requestForm<string>(
      "POST",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/reboot`,
      {},
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 60_000);
    }
  }

  async shutdownVm(node: string, vmid: number): Promise<void> {
    const upid = await this.requestForm<string>(
      "POST",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/shutdown`,
      {},
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 90_000);
    }
  }

  async deleteVm(node: string, vmid: number): Promise<void> {
    const upid = await this.requestForm<string>(
      "DELETE",
      `/api2/json/nodes/${node}/qemu/${vmid}`,
      {},
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 600_000);
    }
  }

  async listVms(
    node: string,
  ): Promise<Array<{ vmid: number; name?: string; status?: string; template?: number }>> {
    return this.request("GET", `/api2/json/nodes/${node}/qemu`);
  }

  /** Extract routable IPv4s from guest-agent interface list. */
  extractIpv4FromAgentInterfaces(
    interfaces: Array<{
      name?: string;
      "ip-addresses"?: Array<{ "ip-address"?: string; "ip-address-type"?: string }>;
    }>,
    subnetPrefix?: string,
  ): string[] {
    const out: string[] = [];
    for (const iface of interfaces) {
      for (const addr of iface["ip-addresses"] ?? []) {
        const ip = addr["ip-address"]?.trim();
        if (
          addr["ip-address-type"] === "ipv4" &&
          ip &&
          !ip.startsWith("127.") &&
          !ip.startsWith("169.254.") &&
          (!subnetPrefix || ip.startsWith(`${subnetPrefix}.`))
        ) {
          out.push(ip);
        }
      }
    }
    return out;
  }

  async getGuestAgentIps(node: string, vmid: number, subnetPrefix?: string): Promise<string[]> {
    if (!(await this.pingGuestAgent(node, vmid))) return [];
    try {
      const interfaces = await this.request<
        Array<{
          name?: string;
          "ip-addresses"?: Array<{ "ip-address"?: string; "ip-address-type"?: string }>;
        }>
      >(
        "GET",
        `/api2/json/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`,
        undefined,
        { timeoutMs: 8_000 },
      );
      return this.extractIpv4FromAgentInterfaces(interfaces, subnetPrefix);
    } catch {
      return [];
    }
  }

  /**
   * All IPv4s on one node — QEMU + LXC, cloud-init, net*, guest-agent, description.
   * Primary source for TG-bot + web billing IP conflict avoidance (no bot DB needed).
   */
  async collectUsedIpsOnNode(
    node: string,
    subnetPrefix?: string,
  ): Promise<{ ips: Set<string>; scanned: number; noIpDetected: number }> {
    const ips = new Set<string>();
    let scanned = 0;
    let noIpDetected = 0;

    const absorb = (found: string[]) => {
      scanned++;
      if (found.length === 0) noIpDetected++;
      for (const ip of found) ips.add(ip);
    };

    let vms: Array<{ vmid: number; name?: string; status?: string; template?: number }>;
    try {
      vms = await this.listVms(node);
    } catch {
      vms = [];
    }

    for (const vm of vms) {
      if (vm.template === 1) continue;
      const found: string[] = [];
      try {
        const cfg = await this.getVmConfig(node, vm.vmid);
        found.push(...this.parseIpsFromVmConfig(cfg, subnetPrefix));
      } catch {
        /* mid-clone */
      }

      if (vm.status === "running") {
        const fromAgent = await this.getGuestAgentIps(node, vm.vmid, subnetPrefix);
        found.push(...fromAgent);
      }

      absorb(found);
    }

    let lxcs: Array<{ vmid: number; name?: string; status?: string; template?: number }>;
    try {
      lxcs = await this.listLxc(node);
    } catch {
      lxcs = [];
    }

    for (const ct of lxcs) {
      if (ct.template === 1) continue;
      const found: string[] = [];
      try {
        const cfg = await this.getLxcConfig(node, ct.vmid);
        found.push(...this.parseIpsFromVmConfig(cfg, subnetPrefix));
      } catch {
        /* mid-create */
      }
      absorb(found);
    }

    return { ips, scanned, noIpDetected };
  }

  /** Scan every cluster node — all VMs/LXC on shared Proxmox (TG bot included). */
  async collectUsedIpsOnCluster(subnetPrefix?: string): Promise<Set<string>> {
    const result = await this.collectUsedIpsOnClusterDetailed(subnetPrefix);
    return result.ips;
  }

  async collectUsedIpsOnClusterDetailed(subnetPrefix?: string): Promise<{
    ips: Set<string>;
    scanned: number;
    noIpDetected: number;
  }> {
    const ips = new Set<string>();
    let scanned = 0;
    let noIpDetected = 0;
    let nodes: Array<{ node: string; status: string }>;
    try {
      nodes = await this.listNodes();
    } catch {
      return { ips, scanned, noIpDetected };
    }
    for (const { node } of nodes) {
      const onNode = await this.collectUsedIpsOnNode(node, subnetPrefix);
      for (const ip of onNode.ips) ips.add(ip);
      scanned += onNode.scanned;
      noIpDetected += onNode.noIpDetected;
    }
    if (scanned > 0) {
      console.log(
        `[proxmox] IP scan: ${ips.size} IPs from ${scanned} VMs/LXC` +
          (noIpDetected > 0 ? ` (${noIpDetected} without detectable IP — guest-agent off?)` : ""),
      );
    }
    return { ips, scanned, noIpDetected };
  }

  /** Last-chance check before cloud-init assigns an IP. */
  async isIpInUseOnCluster(targetIp: string, subnetPrefix?: string): Promise<boolean> {
    const used = await this.collectUsedIpsOnCluster(subnetPrefix);
    return used.has(targetIp);
  }

  async getVmStatus(
    node: string,
    vmid: number,
  ): Promise<{ status: string; uptime?: number; cpu?: number; mem?: number; maxmem?: number }> {
    return this.request(
      "GET",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
      undefined,
      { timeoutMs: 8_000 },
    );
  }

  async getVmUptimeSec(node: string, vmid: number): Promise<number> {
    try {
      const st = await this.getVmStatus(node, vmid);
      if (st.status !== "running") return 0;
      return typeof st.uptime === "number" ? st.uptime : 0;
    } catch {
      return 0;
    }
  }
}

function guessGateway(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "1";
    return parts.join(".");
  }
  return "10.0.0.1";
}

export function getProxmoxClient(): ProxmoxClient | null {
  const config = getProxmoxConfig();
  if (!config) return null;
  return new ProxmoxClient(config);
}

export function getProxmoxNodeName(dbNode?: string | null): string {
  // Real cluster node from .env (e.g. pve01) wins over logical DB labels (e.g. pve-nl-ams).
  const configured = getProxmoxConfig()?.node?.trim();
  if (configured) return configured;
  const fromDb = dbNode?.trim();
  if (fromDb) return fromDb;
  return "pve01";
}
