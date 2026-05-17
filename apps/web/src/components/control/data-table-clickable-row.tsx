"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function DataTableClickableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, select, input, label")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
