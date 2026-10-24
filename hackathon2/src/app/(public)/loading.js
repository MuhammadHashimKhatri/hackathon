import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Loading page" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
