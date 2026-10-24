import { Suspense } from "react";
import ShellFrame from "@/components/shell/ShellFrame";
import CompanyName, { CompanyNameSkeleton } from "@/components/shell/CompanyName";
import RoleNav, { RoleNavSkeleton } from "@/components/shell/RoleNav";
import RoleUserMenu, { UserMenuSkeleton } from "@/components/shell/RoleUserMenu";

// The session is read inside each slot's <Suspense>, never at the top of the
// layout, so {children} isn't held behind it (Next docs: auth with Cache Components).
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
      companyName={
        <Suspense fallback={<CompanyNameSkeleton />}>
          <CompanyName />
        </Suspense>
      }
    >
      {children}
    </ShellFrame>
  );
}
