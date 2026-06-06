export function PageHeaderSkeleton() {
  return (
    <div className="border-b border-border px-6 py-5">
      <div className="skeleton-block h-3 w-24 rounded" />
      <div className="skeleton-block mt-3 h-7 w-48 rounded" />
      <div className="skeleton-block mt-2 h-4 w-72 max-w-full rounded" />
    </div>
  );
}
