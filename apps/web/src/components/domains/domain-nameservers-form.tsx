"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

type Props = {
  initial: string[];
  amperConfigured: boolean;
  onSave: (nameservers: string[]) => Promise<void>;
  onRefresh?: () => Promise<string[]>;
};

const DEFAULT_NS = ["ns1.example.com", "ns2.example.com"];

export function DomainNameserversForm({
  initial,
  amperConfigured,
  onSave,
  onRefresh,
}: Props) {
  const [rows, setRows] = useState<string[]>(
    initial.length >= 2 ? initial : [...initial, ...DEFAULT_NS].slice(0, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(index: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function addRow() {
    setRows((prev) => (prev.length >= 8 ? prev : [...prev, ""]));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  function save() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await onSave(rows);
        setSuccess("Nameservers updated");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function refresh() {
    if (!onRefresh) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const live = await onRefresh();
        if (live.length > 0) setRows(live);
        setSuccess("Loaded from registrar");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Point your domain to your DNS host. Changes apply at the registrar
        {amperConfigured ? " (Amper)" : " (saved in billing)"}.
      </p>

      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => updateRow(index, e.target.value)}
              placeholder={`ns${index + 1}.example.com`}
              className="font-mono text-sm"
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={pending || rows.length <= 2}
              onClick={() => removeRow(index)}
              aria-label="Remove nameserver"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending || rows.length >= 8} onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add NS
        </Button>
        {onRefresh && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={refresh}>
            Load from registrar
          </Button>
        )}
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save nameservers"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-primary">{success}</p>}
    </div>
  );
}
