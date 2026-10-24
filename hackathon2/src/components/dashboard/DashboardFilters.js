import { Suspense } from "react";
import FilterBar from "@/components/ui/FilterBar";
import Skeleton from "@/components/ui/Skeleton";

// FilterBar reads searchParams, so it sits in its own Suspense boundary.
// Departments are passed in once Prompt 4 exists; until then the select is disabled.
export default function DashboardFilters({ departments = [] }) {
  return (
    <Suspense fallback={<Skeleton className="h-[4.25rem] w-full max-w-xl" />}>
      <FilterBar departments={departments} />
    </Suspense>
  );
}
