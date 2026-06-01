import { loadMonorepoEnv } from "@dior/backend";
loadMonorepoEnv();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  login,
  register,
  getDashboardStats,
  getUserServices,
  getUserVpsInstances,
  getUserInvoices,
  getUserTransactions,
  getInfrastructureFeed,
  getInfrastructureStatus,
  getUserActivityFeed,
  getServiceTimeline,
  getLiveMetricsSnapshot,
  getUserNotifications,
  getReferralDashboard,
  getUserDomains,
  searchDomainAvailability,
  getLiveTldPrices,
  registerDomainViaAmper,
  verifyAmperIntegration,
  isAmperConfigured,
  verifyProxmoxIntegration,
  isProxmoxConfigured,
  getUserCdnZones,
  getDedicatedInventory,
  getUserDedicatedServers,
  handleWebhook,
  createTopUp,
  getTopUpById,
  listUserTopUps,
  getWallet,
  getUserLedger,
  handleProviderWebhook,
  listAdminTopUps,
  adminApproveTopUp,
  adminRejectTopUp,
  syncTopUpStatus,
  verifySessionToken,
  COOKIE_NAME,
  checkRateLimit,
  RATE_LIMITS,
  AppError,
} from "@dior/backend";
import { prisma } from "@dior/database";

const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(
  cors({
    origin: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001",
    ],
    credentials: true,
  }),
);

const webhookBodyParser = express.raw({ type: "application/json", limit: "512kb" });

async function handlePaymentWebhookRoute(
  provider: import("@dior/database").TopUpProvider,
  req: express.Request,
  res: express.Response,
) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : undefined;
    const body = rawBody != null ? (JSON.parse(rawBody) as unknown) : req.body;
    const result = await handleProviderWebhook(
      provider,
      req.headers as Record<string, string>,
      body,
      rawBody,
    );
    apiSuccess(res, result);
  } catch (e) {
    apiError(res, e);
  }
}

app.post("/webhooks/heleket", webhookBodyParser, (req, res) =>
  handlePaymentWebhookRoute("HELEKET", req, res),
);
app.post("/webhooks/cryptobot", webhookBodyParser, (req, res) =>
  handlePaymentWebhookRoute("CRYPTOBOT", req, res),
);
app.post("/webhooks/crystalpay", webhookBodyParser, (req, res) =>
  handlePaymentWebhookRoute("CRYSTALPAY", req, res),
);

app.use(express.json());
app.use(cookieParser());

function routeParam(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) throw new Error("Missing route parameter");
  return v;
}

function apiSuccess<T>(res: express.Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

function apiError(res: express.Response, err: unknown) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
}

async function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const token = req.cookies[COOKIE_NAME] ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const payload = await verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: "Invalid session" });
    return;
  }
  const session = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) {
    res.status(401).json({ success: false, error: "Session expired" });
    return;
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dior-api" });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const ip = req.ip;
    const { allowed } = await checkRateLimit(
      `api:login:${ip}`,
      RATE_LIMITS.LOGIN.max,
      RATE_LIMITS.LOGIN.windowMs,
    );
    if (!allowed) throw new AppError("Rate limit exceeded", "RATE_LIMIT", 429);

    const { email, password } = req.body;
    const { token, user } = await login({
      email,
      password,
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
    });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    apiSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;
    const { token, user } = await register({
      email,
      password,
      referralCode,
      ipAddress: req.ip,
    });
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    apiSuccess(res, { user: { id: user.id, email: user.email } }, 201);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
  try {
    const stats = await getDashboardStats(req.userId!);
    apiSuccess(res, stats);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/services", authMiddleware, async (req, res) => {
  try {
    const services = await getUserServices(req.userId!);
    apiSuccess(res, services);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/vps", authMiddleware, async (req, res) => {
  try {
    const vps = await getUserVpsInstances(req.userId!);
    apiSuccess(res, vps);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/billing/invoices", authMiddleware, async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const invoices = await getUserInvoices(req.userId!, undefined, page);
    apiSuccess(res, invoices);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/billing/transactions", authMiddleware, async (req, res) => {
  try {
    const txs = await getUserTransactions(req.userId!);
    apiSuccess(res, txs);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/wallet", authMiddleware, async (req, res) => {
  try {
    apiSuccess(res, await getWallet(req.userId!));
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/topup", authMiddleware, async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const status = req.query.status as string | undefined;
    const provider = req.query.provider as string | undefined;
    const data = await listUserTopUps(req.userId!, {
      page,
      ...(status && { status: status as import("@dior/database").TopUpStatus }),
      ...(provider && { provider: provider as import("@dior/database").TopUpProvider }),
    });
    apiSuccess(res, data);
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/topup", authMiddleware, async (req, res) => {
  try {
    const { amount, provider, idempotencyKey, returnUrl } = req.body;
    const topUp = await createTopUp({
      userId: req.userId!,
      amount: Number(amount),
      provider,
      idempotencyKey: idempotencyKey ?? `idem_${Date.now()}_${req.userId}`,
      returnUrl,
    });
    apiSuccess(res, topUp, 201);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/topup/:id", authMiddleware, async (req, res) => {
  try {
    const topUp = await getTopUpById(routeParam(req.params.id), req.userId!);
    apiSuccess(res, topUp);
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/topup/:id/sync", authMiddleware, async (req, res) => {
  try {
    const topUp = await syncTopUpStatus(routeParam(req.params.id), req.userId!);
    apiSuccess(res, topUp);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/ledger", authMiddleware, async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const search = req.query.search as string | undefined;
    const ledger = await getUserLedger(req.userId!, { page, search });
    apiSuccess(res, ledger);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/admin/topups", authMiddleware, async (req, res) => {
  try {
    const data = await listAdminTopUps(req.userId!, {
      page: Number(req.query.page ?? 1),
      status: req.query.status as import("@dior/database").TopUpStatus | undefined,
      manualOnly: req.query.manual === "true",
      search: req.query.search as string | undefined,
    });
    apiSuccess(res, data);
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/admin/topups/:id/approve", authMiddleware, async (req, res) => {
  try {
    const { partialAmount, notes } = req.body;
    const result = await adminApproveTopUp(
      req.userId!,
      routeParam(req.params.id),
      partialAmount ? Number(partialAmount) : undefined,
      notes,
    );
    apiSuccess(res, result);
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/admin/topups/:id/reject", authMiddleware, async (req, res) => {
  try {
    const result = await adminRejectTopUp(
      req.userId!,
      routeParam(req.params.id),
      req.body.reason ?? "Rejected",
    );
    apiSuccess(res, result);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/infrastructure/feed", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const feed = await getInfrastructureFeed(page);
    apiSuccess(res, feed);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/infrastructure/status", async (_req, res) => {
  try {
    apiSuccess(res, await getInfrastructureStatus());
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/activity", authMiddleware, async (req, res) => {
  try {
    apiSuccess(res, await getUserActivityFeed(req.userId!));
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/services/:serviceId/timeline", authMiddleware, async (req, res) => {
  try {
    const service = await prisma.service.findFirst({
      where: { id: routeParam(req.params.serviceId), userId: req.userId! },
    });
    if (!service) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    apiSuccess(res, await getServiceTimeline(service.id));
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/events/stream", authMiddleware, async (req, res) => {
  const { getEventsSince } = await import("@dior/backend");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let since = new Date();
  const send = async () => {
    const events = await getEventsSince(req.userId!, since, 50);
    for (const evt of events) {
      since = evt.createdAt;
      res.write(`data: ${JSON.stringify({ type: "domain_event", event: evt })}\n\n`);
    }
  };

  await send();
  const interval = setInterval(send, 5000);
  req.on("close", () => clearInterval(interval));
});

app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const data = await getUserNotifications(req.userId!);
    apiSuccess(res, data);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/referrals", authMiddleware, async (req, res) => {
  try {
    const data = await getReferralDashboard(req.userId!);
    apiSuccess(res, data);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/domains", authMiddleware, async (req, res) => {
  try {
    apiSuccess(res, await getUserDomains(req.userId!));
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/domains/prices", authMiddleware, async (_req, res) => {
  try {
    if (!isAmperConfigured()) {
      apiSuccess(res, { configured: false, prices: [] });
      return;
    }
    const prices = await getLiveTldPrices();
    apiSuccess(res, { configured: true, prices });
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/domains/search", authMiddleware, async (req, res) => {
  try {
    const domain = String(req.query.domain ?? "").trim();
    if (!domain) {
      res.status(400).json({ success: false, error: "domain query required" });
      return;
    }
    apiSuccess(res, await searchDomainAvailability(domain));
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/domains/register", authMiddleware, async (req, res) => {
  try {
    const domain = String(req.body?.domain ?? "").trim();
    const retailPrice = Number(req.body?.retailPrice);
    const years = Number(req.body?.years ?? 1);
    if (!domain || !Number.isFinite(retailPrice) || retailPrice <= 0) {
      res.status(400).json({ success: false, error: "domain and retailPrice required" });
      return;
    }
    const created = await registerDomainViaAmper({
      userId: req.userId!,
      domainName: domain,
      retailPrice,
      years: Number.isFinite(years) && years > 0 ? years : 1,
    });
    apiSuccess(res, created, 201);
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/proxmox/health", authMiddleware, async (_req, res) => {
  try {
    if (!isProxmoxConfigured()) {
      apiSuccess(res, { configured: false });
      return;
    }
    apiSuccess(res, { configured: true, ...(await verifyProxmoxIntegration()) });
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/amper/health", authMiddleware, async (_req, res) => {
  try {
    if (!isAmperConfigured()) {
      apiSuccess(res, { configured: false });
      return;
    }
    apiSuccess(res, { configured: true, ...(await verifyAmperIntegration()) });
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/cdn", authMiddleware, async (req, res) => {
  try {
    apiSuccess(res, await getUserCdnZones(req.userId!));
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/dedicated/inventory", authMiddleware, async (_req, res) => {
  try {
    apiSuccess(res, await getDedicatedInventory());
  } catch (e) {
    apiError(res, e);
  }
});

app.get("/api/dedicated", authMiddleware, async (req, res) => {
  try {
    apiSuccess(res, await getUserDedicatedServers(req.userId!));
  } catch (e) {
    apiError(res, e);
  }
});

app.post("/api/webhooks/:method", async (req, res) => {
  try {
    const method = routeParam(req.params.method).toUpperCase() as "CRYPTO" | "TELEGRAM" | "MANUAL";
    const result = await handleWebhook(method, req.body.externalId ?? req.body.id, req.body);
    apiSuccess(res, result);
  } catch (e) {
    apiError(res, e);
  }
});

app.listen(PORT, () => {
  console.log(`Dior API listening on :${PORT}`);
});
