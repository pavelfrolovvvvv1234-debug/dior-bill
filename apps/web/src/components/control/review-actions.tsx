"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolveReviewAction } from "@/app/actions/control";

export function ReviewActions({ reviewId }: { reviewId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => resolveReviewAction(reviewId, "approve"))}>Approve</Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(() => resolveReviewAction(reviewId, "freeze"))}>Freeze</Button>
    </div>
  );
}
