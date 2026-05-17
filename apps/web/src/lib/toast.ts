"use client";

import { create } from "zustand";
import { getT } from "@/lib/i18n/store";
import { isInsufficientBalanceError } from "@/lib/order-errors";

export type ToastVariant = "error" | "success" | "info";

export type ToastAction = {
  href: string;
  label: string;
};

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
};

type ToastState = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 5500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { ...toast, id }] });
    window.setTimeout(() => {
      get().dismiss(id);
    }, AUTO_DISMISS_MS);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function toastInsufficientBalance() {
  const t = getT();
  useToastStore.getState().push({
    variant: "error",
    title: t("toast.insufficientBalance.title"),
    description: t("toast.insufficientBalance.description"),
    action: { href: "/billing/topup", label: t("toast.insufficientBalance.action") },
  });
}

export function handlePurchaseError(err: unknown): boolean {
  if (err instanceof Error && isInsufficientBalanceError(err.message)) {
    toastInsufficientBalance();
    return true;
  }
  return false;
}
