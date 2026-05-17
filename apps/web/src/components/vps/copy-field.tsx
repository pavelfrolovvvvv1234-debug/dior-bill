"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyField({
  label,
  value,
  masked = false,
  mono = true,
  className,
}: {
  label: string;
  value: string;
  masked?: boolean;
  mono?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(!masked);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const display = visible ? value : "••••••••••••••••";

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "min-h-10 flex-1 rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-sm",
            mono && "font-mono",
          )}
        >
          {display}
        </div>
        {masked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? "Hide" : "Show"}
          </Button>
        )}
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}


