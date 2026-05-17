import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { appendDomainEvent } from "../events/store";

export type AbuseAction = "allow" | "challenge" | "freeze" | "review";

/**
 * Automatic abuse enforcement (risk score, velocity freeze, review queue) is off.
 * Manual actions in Control → Security still call setAbuseAction when needed.
 */
export const AUTOMATIC_ABUSE_ENFORCEMENT = false;

/** No-op while automatic enforcement is disabled. */
export async function checkAbuseAllowance(_userId: string, _action: string): Promise<void> {
  return;
}

/** Risk scoring & auto-freeze/review — disabled. */
export async function incrementRisk(
  _userId: string,
  _delta: number,
  _reason: string,
): Promise<void> {
  return;
}

/** Clears automatic abuse flags (freeze/review/challenge) after login. */
export async function releaseStuckAbuseRestrictions(userId: string): Promise<void> {
  if (AUTOMATIC_ABUSE_ENFORCEMENT) return;

  await prisma.userRiskProfile.updateMany({
    where: {
      userId,
      OR: [{ abuseAction: { not: "allow" } }, { frozenAt: { not: null } }],
    },
    data: {
      abuseAction: "allow",
      frozenAt: null,
    },
  });
}

/** Manual admin action (Control → Security). */
export async function setAbuseAction(
  userId: string,
  action: AbuseAction,
  actorId: string,
): Promise<void> {
  await prisma.userRiskProfile.upsert({
    where: { userId },
    create: {
      userId,
      abuseAction: action,
      frozenAt: action === "freeze" ? new Date() : null,
    },
    update: {
      abuseAction: action,
      frozenAt: action === "freeze" ? new Date() : null,
    },
  });

  await appendDomainEvent({
    eventType:
      action === "freeze" ? DOMAIN_EVENTS.ABUSE_FROZEN : DOMAIN_EVENTS.ABUSE_CHALLENGE,
    aggregateType: "user",
    aggregateId: userId,
    userId,
    payload: { action, actorId },
    idempotencyKey: `abuse.action:${userId}:${action}:${actorId}`,
  });
}
