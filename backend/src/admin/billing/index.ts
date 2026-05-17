import { prisma } from "@dior/database";
import type { InvoiceStatus } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { adminBillingCorrection } from "../../core/admin/control";
import { requirePermission } from "../rbac";

export async function listAdminInvoices(
  actorId: string,
  options: {
    status?: InvoiceStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "billing.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const q = options.q?.trim();

  const where = {
    ...(options.status && { status: options.status }),
    ...(q && {
      OR: [
        { number: { contains: q } },
        { user: { email: { contains: q } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        amountPaid: true,
        dueAt: true,
        paidAt: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function adminOverrideInvoice(
  actorId: string,
  invoiceId: string,
  params: { action: "mark_paid" | "void" | "extend"; note?: string },
) {
  await requirePermission(actorId, "billing.write");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError();

  if (params.action === "mark_paid") {
    await adminBillingCorrection({
      actorId,
      invoiceId,
      userId: invoice.userId,
      markPaid: true,
    });
  } else if (params.action === "void") {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED" },
    });
    await createAuditLog({
      actorId,
      action: "invoice.void",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { note: params.note },
    });
  } else {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { dueAt: due },
    });
    await createAuditLog({
      actorId,
      action: "invoice.extend",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { dueAt: due.toISOString() },
    });
  }

  return prisma.invoice.findUnique({ where: { id: invoiceId } });
}
