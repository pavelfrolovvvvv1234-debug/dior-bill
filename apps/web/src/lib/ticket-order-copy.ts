import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import type { VpsPlan } from "@/lib/vps-plans";
import { BULLETPROOF_VPS_OS_OPTIONS, STANDARD_VPS_OS_OPTIONS } from "@/lib/vps-os-options";

const PRODUCT_LINE_LABELS = {
  "bulletproof-dedicated": "Bulletproof Dedicated Server",
  dedicated: "Dedicated Server",
  turbovds: "TurboVDS",
} as const;

export type TicketOrderProductLine = keyof typeof PRODUCT_LINE_LABELS;

export function getProductLineLabel(line: TicketOrderProductLine): string {
  return PRODUCT_LINE_LABELS[line];
}

export function formatDedicatedConfiguration(plan: DedicatedCatalogPlan): string {
  if (isDedicatedPlanDetailed(plan)) {
    return [
      plan.name,
      `${plan.cpuCores} CPU cores`,
      plan.ram,
      plan.storage,
      plan.network,
      plan.bandwidth,
    ].join(" · ");
  }
  const parts = [plan.cpu, plan.ram];
  if (plan.storage) parts.push(plan.storage);
  return parts.join(" · ");
}

export function buildDedicatedTicketCopy(
  plan: DedicatedCatalogPlan,
  productLine: "bulletproof-dedicated" | "dedicated",
): { subject: string; body: string; invoiceDescription: string } {
  const lineLabel = getProductLineLabel(productLine);
  const configuration = formatDedicatedConfiguration(plan);
  const title =
    isDedicatedPlanDetailed(plan) && plan.name
      ? plan.name
      : `${plan.cpu} / ${plan.ram}`;

  return {
    subject: `Order: ${lineLabel} — ${title}`,
    invoiceDescription: `${lineLabel}: ${configuration}`,
    body: [
      "Paid order — balance charged. Please provision and reply with access credentials.",
      "",
      `Product: ${lineLabel}`,
      `Configuration: ${configuration}`,
      `Plan ID: ${plan.id}`,
      `Monthly price: $${plan.price.toFixed(2)}`,
      "",
      "Please attach IP, hostname, login, and password/panel link when ready.",
    ].join("\n"),
  };
}

export function buildInventoryDedicatedTicketCopy(item: {
  id: string;
  name: string;
  cpu: string;
  monthlyPrice: number;
  bulletproof?: boolean;
}): { subject: string; body: string; invoiceDescription: string; productLine: TicketOrderProductLine } {
  const productLine = item.bulletproof ? "bulletproof-dedicated" : "dedicated";
  const lineLabel = getProductLineLabel(productLine);

  return {
    productLine,
    subject: `Order: ${lineLabel} — ${item.name}`,
    invoiceDescription: `${lineLabel}: ${item.name} (${item.cpu})`,
    body: [
      "Paid order — balance charged. Please provision and reply with access credentials.",
      "",
      `Product: ${lineLabel}`,
      `Server: ${item.name}`,
      `CPU: ${item.cpu}`,
      `Inventory ID: ${item.id}`,
      `Monthly price: $${item.monthlyPrice.toFixed(2)}`,
      "",
      "Please attach IP, hostname, login, and password/panel link when ready.",
    ].join("\n"),
  };
}

function osLabel(value: string, turbovds: boolean): string {
  const options = turbovds ? STANDARD_VPS_OS_OPTIONS : BULLETPROOF_VPS_OS_OPTIONS;
  return options.find((o) => o.value === value)?.label ?? value;
}

export function buildTurbovdsTicketCopy(params: {
  plan: VpsPlan;
  hostname: string;
  locationLabel: string;
  locationCode: string;
  os: string;
}): { subject: string; body: string; invoiceDescription: string } {
  const lineLabel = getProductLineLabel("turbovds");
  const ram = params.plan.ramDisplay ?? `${params.plan.ramMb / 1024} GB`;
  const disk = params.plan.diskDisplay ?? `${params.plan.diskGb} GB NVMe`;
  const network = params.plan.networkDisplay ?? `${params.plan.networkMbps} Mbps`;

  const configuration = [
    params.plan.name,
    `${params.plan.cpuCores} vCPU`,
    ram,
    disk,
    network,
    params.plan.bandwidthLabel,
  ].join(" · ");

  return {
    subject: `Order: ${lineLabel} — ${params.plan.name} (${params.hostname})`,
    invoiceDescription: `${lineLabel}: ${params.plan.name} @ ${params.locationCode}`,
    body: [
      "Paid order — balance charged. Please provision TurboVDS and reply with access credentials.",
      "",
      `Product: ${lineLabel}`,
      `Plan: ${params.plan.name}`,
      `Configuration: ${configuration}`,
      `Hostname: ${params.hostname}`,
      `Region: ${params.locationLabel} (${params.locationCode})`,
      `OS: ${osLabel(params.os, true)}`,
      `Plan ID: ${params.plan.id}`,
      `Monthly price: $${params.plan.price.toFixed(2)}`,
      "",
      "Please attach IP, root/login credentials, and panel URL when ready.",
    ].join("\n"),
  };
}
