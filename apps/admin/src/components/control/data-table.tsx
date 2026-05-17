import { cn } from "@/lib/utils";

export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-white/6 bg-white/[0.02] text-left text-[11px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
        {children}
      </tr>
    </thead>
  );
}

export function DataTableTh({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-4 py-3", align === "right" && "text-right")}>{children}</th>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-white/6">{children}</tbody>;
}

export function DataTableRow({ children }: { children: React.ReactNode }) {
  return <tr className="data-row-hover">{children}</tr>;
}

export function DataTableTd({
  children,
  align = "left",
  mono,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3", align === "right" && "text-right", mono && "font-mono text-xs", className)}>
      {children}
    </td>
  );
}

export function DataTableEmpty({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
        {message}
      </td>
    </tr>
  );
}
