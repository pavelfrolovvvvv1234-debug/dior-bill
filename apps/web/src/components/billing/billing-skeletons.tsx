function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

export function BillingOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="panel h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonBlock className="panel h-52 lg:col-span-1" />
        <SkeletonBlock className="panel h-52 lg:col-span-2" />
      </div>
      <SkeletonBlock className="panel h-64" />
    </div>
  );
}

export function TopUpFlowSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="panel h-24" />
      <SkeletonBlock className="panel h-40" />
      <SkeletonBlock className="panel h-56" />
    </div>
  );
}

export function TransactionsTableSkeleton() {
  return <SkeletonBlock className="panel h-[28rem]" />;
}

export function TopUpDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SkeletonBlock className="panel h-32" />
      <SkeletonBlock className="panel h-48" />
      <SkeletonBlock className="panel h-36" />
    </div>
  );
}
