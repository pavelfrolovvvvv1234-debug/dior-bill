"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkSufficientBalance } from "@/app/actions/order";
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
};

export function OrderButton({
  amount,
  href = "/billing/topup",
  children,
  className,
  size = "sm",
  variant = "outline",
  onAllowed,
}: OrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
        return;
      }
      router.push(href);
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}
