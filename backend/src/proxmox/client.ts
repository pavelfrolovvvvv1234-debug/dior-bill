/**
 * Proxmox VE API client
 * @see https://pve.proxmox.com/pve-docs/api-viewer/
 */
import { readFileSync } from "node:fs";
import https from "node:https";
import { URL } from "node:url";
import type { ProxmoxRuntimeConfig } from "./config";
import { getProxmoxCiUser, getProxmoxConfig } from "./config";

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

  async resizeDisk(node: string, vmid: number, sizeGb: number, storage: string): Promise<void> {
    const upid = await this.requestForm<string>(
      "PUT",
      `/api2/json/nodes/${node}/qemu/${vmid}/resize`,
      {
        disk: "scsi0",
        size: `${sizeGb}G`,
      },
    );
    if (typeof upid === "string" && upid.startsWith("UPID:")) {
      await this.waitForTask(node, upid, 600_000);
    }
  }

  async configureVm(spec: VmSpec): Promise<void> {
    const fields: Record<string, string | number | undefined> = {
      cores: spec.cores,
      memory: spec.memoryMb,
      agent: 1,
    };

    if (spec.rootPassword) {
      fields.cipassword = spec.rootPassword;
    }

    if (spec.primaryIp) {
      fields.net0 = `virtio,bridge=${spec.bridge}`;
      fields.boot = "order=scsi0";
      fields.ciuser = getProxmoxCiUser();
      fields.nameserver = "1.1.1.1";
      fields.searchdomain = "local";
      const gw = spec.gateway ?? guessGateway(spec.primaryIp);
      fields.ipconfig0 = `ip=${spec.primaryIp}/${spec.ipCidr ?? 24},gw=${gw}`;
      fields.citype = "configdrive2";
    }

    await this.requestForm(
      "PUT",
      `/api2/json/nodes/${spec.node}/qemu/${spec.vmid}/config`,
      fields,
    );

    try {
      await this.resizeDisk(spec.node, spec.vmid, spec.diskGb, spec.storage);
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

  /** Update cloud-init login (requires reboot inside guest to apply password change). */
  async updateVmCloudInitCredentials(
    node: string,
    vmid: number,
    password: string,
  ): Promise<void> {
    await this.requestForm("PUT", `/api2/json/nodes/${node}/qemu/${vmid}/config`, {
      ciuser: getProxmoxCiUser(),
      cipassword: password,
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
  ): Promise<{ status: string; cpu?: number; mem?: number; maxmem?: number }> {
    return this.request(
      "GET",
      `/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
      undefined,
      { timeoutMs: 8_000 },
    );
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
