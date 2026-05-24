import { cn } from "@/lib/utils";

export function DataTable({
  className,
  children,
  minWidth = 640,
}: {
  className?: string;
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
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
        "px-3 py-2.5 font-medium sm:px-4 sm:py-3",
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
        "px-3 py-2.5 text-foreground sm:px-4 sm:py-3",
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
