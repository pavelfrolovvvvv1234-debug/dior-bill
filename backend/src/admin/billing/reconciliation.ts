import { prisma } from "@dior/database";
import {
  runReconciliation,
  type ReconciliationDomain,
} from "../../core/reconciliation/jobs";
import { requirePermission } from "../rbac";
import { toIso } from "./serialize";

export async function listReconciliationRuns(
  actorId: string,
  options: { page?: number; pageSize?: number } = {},
) {
  await requirePermission(actorId, "billing.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);

  const [items, total] = await Promise.all([
    prisma.reconciliationRun.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { startedAt: "desc" },
    }),
    prisma.reconciliationRun.count(),
  ]);

  return {
    items: items.map((r) => ({
      id: r.id,
      domain: r.domain,
      status: r.status,
      fixesApplied: r.fixesApplied,
      findings: r.findings,
      startedAt: toIso(r.startedAt)!,
      completedAt: toIso(r.completedAt),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function adminTriggerReconciliation(
  actorId: string,
  domain: ReconciliationDomain,
) {
  await requirePermission(actorId, "billing.write");
  const result = await runReconciliation(domain);
  return result;
}
