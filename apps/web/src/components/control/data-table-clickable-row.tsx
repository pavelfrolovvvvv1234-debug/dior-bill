"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RowDeleteContext } from "@/components/control/row-delete-context";

export function DataTableClickableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <RowDeleteContext.Provider value={{ removeRow: () => setRemoved(true) }}>
      <tr
        className="cursor-pointer transition-all duration-200 hover:bg-white/[0.04]"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button, select, input, label, [role='dialog']")) return;
          router.push(href);
        }}
      >
        {children}
      </tr>
    </RowDeleteContext.Provider>
  );
}
