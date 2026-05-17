import { PageHeaderSkeleton } from "@/components/ui/enterprise/page-skeleton";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel h-28 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
        <div className="panel h-64 animate-pulse bg-white/[0.02]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel h-48 animate-pulse bg-white/[0.02]" />
          <div className="panel h-48 animate-pulse bg-white/[0.02]" />
        </div>
      </div>
    </>
  );
}
