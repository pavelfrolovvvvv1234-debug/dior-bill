"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBroadcastAction } from "@/app/actions/control";

export function BroadcastForm() {
  const [pending, start] = useTransition();

  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(() => createBroadcastAction(String(fd.get("title")), String(fd.get("body"))));
        e.currentTarget.reset();
      }}
    >
      <Input name="title" placeholder="Announcement title" required />
      <textarea
        name="body"
        placeholder="Message body"
        required
        className="min-h-[100px] w-full rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Send broadcast
      </Button>
    </form>
  );
}
