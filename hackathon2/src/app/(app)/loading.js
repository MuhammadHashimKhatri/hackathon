import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Loading page">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            <SkeletonText lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
