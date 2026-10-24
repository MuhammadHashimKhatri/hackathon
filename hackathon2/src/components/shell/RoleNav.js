import { getPageActor } from "@/server/auth/session";
import Skeleton from "@/components/ui/Skeleton";
import NavLinks from "./NavLinks";

// Reads the session, so it must be rendered inside <Suspense>.
export default async function RoleNav() {
  const { role } = await getPageActor();
  return (
    <nav aria-label="Main">
      <NavLinks role={role} />
    </nav>
  );
}

export function RoleNavSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}
