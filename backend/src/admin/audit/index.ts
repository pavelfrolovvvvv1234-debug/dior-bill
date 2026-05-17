import { getAuditLogs } from "../../audit";
import { requirePermission } from "../rbac";

export async function listAdminAuditLogs(
  actorId: string,
  options: {
    actorId?: string;
    entityType?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "audit.read");
  return getAuditLogs(options);
}
