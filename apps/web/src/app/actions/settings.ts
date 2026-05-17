"use server";

import { revalidatePath } from "next/cache";
import {
  getSettingsProfile,
  updateProfile,
  changePassword,
  updateLocale,
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  createTelegramLinkToken,
  completeTelegramLink,
  unlinkTelegram,
  updateTelegramNotifications,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
  getApiKeyAuditLogs,
  revokeSessionWithAuth,
  API_PERMISSIONS,
} from "@dior/backend";
import { requireSession } from "@/lib/auth";

const REVALIDATE = ["/settings", "/settings/account", "/settings/security", "/settings/integrations", "/settings/localization", "/settings/api"];

function revalidateSettings() {
  for (const p of REVALIDATE) revalidatePath(p);
}

export async function getSettingsProfileAction() {
  const session = await requireSession();
  return getSettingsProfile(session.user.id);
}

export async function updateProfileAction(data: { email?: string }) {
  const session = await requireSession();
  const result = await updateProfile(session.user.id, data);
  revalidateSettings();
  return result;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
) {
  const session = await requireSession();
  await changePassword(session.user.id, currentPassword, newPassword);
  revalidateSettings();
}

export async function updateLocaleAction(locale: string) {
  const session = await requireSession();
  const result = await updateLocale(session.user.id, locale);
  revalidateSettings();
  return result;
}

export async function beginTwoFactorSetupAction() {
  const session = await requireSession();
  return beginTwoFactorSetup(session.user.id);
}

export async function confirmTwoFactorSetupAction(code: string) {
  const session = await requireSession();
  const result = await confirmTwoFactorSetup(session.user.id, code);
  revalidateSettings();
  return result;
}

export async function disableTwoFactorAction(currentPassword: string, code?: string) {
  const session = await requireSession();
  await disableTwoFactor(session.user.id, currentPassword, code);
  revalidateSettings();
}

export async function regenerateRecoveryCodesAction(currentPassword: string) {
  const session = await requireSession();
  const result = await regenerateRecoveryCodes(session.user.id, currentPassword);
  revalidateSettings();
  return result;
}

export async function createTelegramLinkAction() {
  const session = await requireSession();
  return createTelegramLinkToken(session.user.id);
}

/** Dev / manual confirm when bot webhook unavailable */
export async function confirmTelegramLinkDevAction(
  linkToken: string,
  username?: string,
) {
  const session = await requireSession();
  const { prisma } = await import("@dior/database");
  const pending = await prisma.telegramLinkToken.findUnique({ where: { token: linkToken } });
  if (!pending || pending.userId !== session.user.id) {
    throw new Error("Invalid link token");
  }
  const numericId = BigInt(`9${session.user.id.replace(/\D/g, "").slice(0, 12)}`);
  await completeTelegramLink(linkToken, {
    id: numericId,
    username: username ?? `user_${session.user.id.slice(0, 6)}`,
  });
  revalidateSettings();
}

export async function unlinkTelegramAction(currentPassword: string) {
  const session = await requireSession();
  await unlinkTelegram(session.user.id, currentPassword);
  revalidateSettings();
}

export async function updateTelegramNotificationsAction(prefs: {
  billing?: boolean;
  abuse?: boolean;
  serverStatus?: boolean;
}) {
  const session = await requireSession();
  await updateTelegramNotifications(session.user.id, prefs);
  revalidateSettings();
}

export async function createApiKeyAction(
  label: string,
  permissions: string[],
  currentPassword: string,
) {
  const session = await requireSession();
  const result = await createApiKey(session.user.id, label, permissions, currentPassword);
  revalidateSettings();
  return result;
}

export async function revokeApiKeyAction(keyId: string, currentPassword: string) {
  const session = await requireSession();
  await revokeApiKey(session.user.id, keyId, currentPassword);
  revalidateSettings();
}

export async function rotateApiKeyAction(keyId: string, currentPassword: string) {
  const session = await requireSession();
  const result = await rotateApiKey(session.user.id, keyId, currentPassword);
  revalidateSettings();
  return result;
}

export async function getApiKeyAuditLogsAction(keyId: string) {
  const session = await requireSession();
  return getApiKeyAuditLogs(session.user.id, keyId);
}

export async function revokeSessionAction(sessionId: string, currentPassword: string) {
  const session = await requireSession();
  await revokeSessionWithAuth(session.user.id, sessionId, currentPassword);
  revalidateSettings();
}

export async function getApiPermissionsAction() {
  return [...API_PERMISSIONS];
}
