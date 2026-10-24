import { getPageActor } from "@/server/auth/session";
import Skeleton from "@/components/ui/Skeleton";
import UserMenu from "./UserMenu";

// Reads the session, so it must be rendered inside <Suspense>.
export default async function RoleUserMenu() {
  const { role, email } = await getPageActor();
  return <UserMenu role={role} email={email} />;
}

export function UserMenuSkeleton() {
  return <Skeleton className="h-9 w-9 rounded-full sm:w-24" />;
}
