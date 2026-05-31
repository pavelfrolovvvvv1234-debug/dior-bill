"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkSufficientBalance } from "@/app/actions/order";
import { PurchaseSuccessDialog } from "@/components/billing/purchase-success-dialog";
import { Button } from "@/components/ui/button";
import { toastInsufficientBalance } from "@/lib/toast";
import { cn } from "@/lib/utils";

type OrderButtonProps = {
  amount: number;
  href?: string;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  onAllowed?: () => void | Promise<void>;
  /** Show premium provisioning + success flow after order completes */
  showSuccessFlow?: boolean;
};

export function OrderButton({
  amount,
  href = "/billing/topup",
  children,
  className,
  size = "sm",
  variant = "outline",
  onAllowed,
  showSuccessFlow = true,
}: OrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { sufficient } = await checkSufficientBalance(amount);
      if (!sufficient) {
        toastInsufficientBalance();
        return;
      }
      if (onAllowed) {
        await onAllowed();
        if (showSuccessFlow) {
          setPurchaseSuccessOpen(true);
        }
        return;
      }
      router.push(href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? "…" : children}
      </Button>

      {showSuccessFlow && onAllowed ? (
        <PurchaseSuccessDialog
          open={purchaseSuccessOpen}
          onOpenChange={setPurchaseSuccessOpen}
        />
      ) : null}
    </>
  );
}
