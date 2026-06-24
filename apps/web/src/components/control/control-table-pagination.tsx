import Link from "next/link";
import { Button } from "@/components/ui/button";

function buildHref(
  basePath: string,
  page: number,
  params?: Record<string, string | undefined>,
) {
  const search = new URLSearchParams();
  search.set("page", String(page));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ControlTablePagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-4 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href={buildHref(basePath, page - 1, params)}>Previous</Link>
          </Button>
        ) : null}
        {page < totalPages ? (
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href={buildHref(basePath, page + 1, params)}>Next</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
