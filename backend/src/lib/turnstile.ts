import { ValidationError } from "@dior/shared";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export function isTurnstileRequired(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  if (process.env.NODE_ENV !== "production" && process.env.TURNSTILE_ENFORCE_IN_DEV !== "true") {
    return false;
  }
  return true;
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<void> {
  if (!isTurnstileRequired()) {
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    throw new ValidationError("Captcha verification is not configured");
  }

  if (!token?.trim()) {
    throw new ValidationError("Complete the captcha verification");
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteIp) body.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new ValidationError("Captcha verification is temporarily unavailable");
  }

  if (!response.ok) {
    throw new ValidationError("Captcha verification failed. Please try again.");
  }

  const data = (await response.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    throw new ValidationError("Captcha verification failed. Please try again.");
  }
}
