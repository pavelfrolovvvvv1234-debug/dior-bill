import { ValidationError } from "./errors";

const EMAIL_LOCAL = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/;
const EMAIL_DOMAIN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const PASSWORD_RULE_IDS = ["length", "lower", "upper", "number", "special"] as const;
export type PasswordRuleId = (typeof PASSWORD_RULE_IDS)[number];

export type PasswordRuleStatus = {
  id: PasswordRuleId;
  met: boolean;
};

export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export type PasswordAnalysis = {
  score: number;
  level: PasswordStrengthLevel;
  rules: PasswordRuleStatus[];
  strongEnough: boolean;
};

export function normalizeRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidRegistrationEmail(email: string): boolean {
  const normalized = normalizeRegistrationEmail(email);
  if (!normalized || normalized.length > 254) return false;

  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  if (!EMAIL_LOCAL.test(local) || !EMAIL_DOMAIN.test(domain)) return false;
  if (local.includes("..") || domain.includes("..")) return false;

  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-z]{2,24}$/.test(tld)) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
  }

  return true;
}

export function validateRegistrationEmail(email: string): string {
  const normalized = normalizeRegistrationEmail(email);
  if (!normalized) {
    throw new ValidationError("Enter a valid email address");
  }
  if (!isValidRegistrationEmail(normalized)) {
    throw new ValidationError("Enter a valid email address with a real domain (e.g. name@company.com)");
  }
  return normalized;
}

function getPasswordRules(password: string): PasswordRuleStatus[] {
  return [
    { id: "length", met: password.length >= 8 },
    { id: "lower", met: /[a-z]/.test(password) },
    { id: "upper", met: /[A-Z]/.test(password) },
    { id: "number", met: /\d/.test(password) },
    { id: "special", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function analyzePassword(password: string): PasswordAnalysis {
  if (!password) {
    return {
      score: 0,
      level: "empty",
      rules: PASSWORD_RULE_IDS.map((id) => ({ id, met: false })),
      strongEnough: false,
    };
  }

  const rules = getPasswordRules(password);
  const metCount = rules.filter((r) => r.met).length;

  let score = metCount * 16;
  if (password.length >= 12) score += 8;
  if (password.length >= 16) score += 6;
  score = Math.min(100, score);

  let level: PasswordStrengthLevel = "weak";
  if (score >= 88) level = "strong";
  else if (score >= 68) level = "good";
  else if (score >= 44) level = "fair";

  const strongEnough =
    rules.find((r) => r.id === "length")?.met === true &&
    rules.find((r) => r.id === "lower")?.met === true &&
    rules.find((r) => r.id === "upper")?.met === true &&
    rules.find((r) => r.id === "number")?.met === true;

  return { score, level, rules, strongEnough };
}

export function validateRegistrationPassword(password: string): void {
  const analysis = analyzePassword(password);
  if (!analysis.strongEnough) {
    throw new ValidationError(
      "Password must be at least 8 characters and include uppercase, lowercase, and a number",
    );
  }
}
