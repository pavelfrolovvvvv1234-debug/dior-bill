import { getInvoiceAction } from "@/app/actions/invoice";
import { InvoiceDetailView } from "@/components/billing/invoice-detail-view";
import { notFound } from "next/navigation";

export async function InvoiceDetailSection({ id }: { id: string }) {
  let invoice;
  try {
    invoice = await getInvoiceAction(id);
  } catch {
    notFound();
  }

  const remaining = Number(invoice.total) - Number(invoice.amountPaid);

  return (
    <InvoiceDetailView
      invoice={{
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        subtotal: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        remaining,
        dueAt: invoice.dueAt,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        notes: invoice.notes,
        items: invoice.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
          serviceLabel: item.service?.label,
        })),
      }}
    />
  );
}
