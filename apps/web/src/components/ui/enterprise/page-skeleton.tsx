export function PageHeaderSkeleton() {
  return (
    <div className="border-b border-border px-6 py-5">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted/60" />
    </div>
  );
}
