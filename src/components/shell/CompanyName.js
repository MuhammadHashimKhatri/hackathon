import { getPageActor } from "@/server/auth/session";
import { getCompanyName } from "@/server/services/company";
import Skeleton from "@/components/ui/Skeleton";

// Server slot for the topbar; render inside <Suspense>.
export default async function CompanyName() {
  await getPageActor();
  const name = await getCompanyName();
  return name ?? <span className="text-muted">Company not set up</span>;
}

export function CompanyNameSkeleton() {
  return <Skeleton className="h-4 w-32" />;
}
