import { Suspense } from "react";
import { ShieldOff } from "lucide-react";
import { getPageActor } from "@/server/auth/session";
import { rolesFor } from "@/config/navigation";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageLoading from "@/app/(app)/loading";

// Page-level role check. Allowed roles = roles whose menu (NAV) has `href`,
// so the menu config stays the single source of truth for access.
// Services re-check roles on every read/write; this only guards the page.
async function Gate({ href, children }) {
  const actor = await getPageActor();
  if (rolesFor(href).includes(actor.role)) return children;
  return (
    <Card>
      <EmptyState
        icon={ShieldOff}
        title="You don't have access to this page"
        description="This page isn't part of your role. Your dashboard has everything you can use."
        action={<ButtonLink href="/dashboard" variant="primary">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}

export default function RoleGate({ href, children }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate href={href}>{children}</Gate>
    </Suspense>
  );
}
