"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createTicket, replyToTicket } from "@dior/backend";
import { rethrowServerActionError } from "@/lib/server-action-error";

export async function createTicketAction(formData: FormData) {
  const session = await requireSession();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) throw new Error("Subject and message are required");

  try {
    const ticket = await createTicket({
      userId: session.user.id,
      subject,
      body,
    });

    revalidatePath("/support");
    redirect(`/support/${ticket.id}`);
  } catch (err) {
    rethrowServerActionError(err, "Could not create ticket");
  }
}

export async function replyTicketAction(ticketId: string, formData: FormData) {
  const session = await requireSession();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Message is required");

  await replyToTicket({
    ticketId,
    authorId: session.user.id,
    body,
  });

  revalidatePath(`/support/${ticketId}`);
}
