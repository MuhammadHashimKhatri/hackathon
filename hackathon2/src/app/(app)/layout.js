import { Suspense } from "react";
import ShellFrame from "@/components/shell/ShellFrame";
import RoleNav, { RoleNavSkeleton } from "@/components/shell/RoleNav";
import RoleUserMenu, { UserMenuSkeleton } from "@/components/shell/RoleUserMenu";

export default function AppLayout({ children }) {
  return (
    <ShellFrame
      nav={
        <Suspense fallback={<RoleNavSkeleton />}>
          <RoleNav />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <RoleUserMenu />
        </Suspense>
      }
      companyName={null}
    >
      {children}
    </ShellFrame>
  );
}
