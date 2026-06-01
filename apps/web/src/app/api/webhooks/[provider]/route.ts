import type { TopUpProvider } from "@dior/database";
import { handleProviderWebhook } from "@dior/backend";

function headersFromRequest(req: Request): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  req.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await ctx.params;
  const provider = raw.toUpperCase() as TopUpProvider;
  if (!["HELEKET", "CRYPTOBOT", "CRYSTALPAY"].includes(provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleProviderWebhook(
      provider,
      headersFromRequest(req),
      body,
      rawBody,
    );
    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error(`[webhook:${provider}]`, err);
    const message = err instanceof Error ? err.message : "Webhook failed";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
