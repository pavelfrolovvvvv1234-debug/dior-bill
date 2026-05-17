import { getAdminAnalytics } from "../../analytics";
import { requirePermission } from "../rbac";

export async function getControlAnalytics(actorId: string) {
  await requirePermission(actorId, "analytics.read");
  return getAdminAnalytics(actorId);
}
