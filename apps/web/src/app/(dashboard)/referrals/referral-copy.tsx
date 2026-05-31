"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export function ReferralCopy({ link, code }: { link: string; code: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm"
        />
        <Button type="button" variant="default" className="h-10 shrink-0" onClick={copyLink}>
          {copiedLink ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <div className="text-sm text-muted-foreground">
          Code{" "}
          <span className="font-mono font-medium text-foreground">{code}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copyCode}>
          {copiedCode ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy code
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
