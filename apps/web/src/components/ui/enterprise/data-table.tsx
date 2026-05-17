import { cn } from "@/lib/utils";

export function DataTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
        {children}
      </tr>
    </thead>
  );
}

export function DataTableTh({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("data-row-hover", className)}>{children}</tr>
  );
}

export function DataTableTd({
  children,
  className,
  align = "left",
  mono,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        mono && "font-mono text-xs tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function DataTableEmpty({ message, colSpan = 5 }: { message: string; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}
