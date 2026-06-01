import type { TopUpProvider } from "@dior/database";

/** Webhook callback URL — prefers API host, falls back to Next.js route on app host. */
export function paymentWebhookUrl(provider: Lowercase<TopUpProvider> | string): string {
  const slug = provider.toLowerCase();
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (api) return `${api}/webhooks/${slug}`;

  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (app) return `${app}/api/webhooks/${slug}`;

  return `http://127.0.0.1:3002/webhooks/${slug}`;
}
