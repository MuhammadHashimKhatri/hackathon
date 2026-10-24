import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        icon={SearchX}
        title="This page doesn't exist"
        description="The link may be old or mistyped. Go back to your dashboard to find what you need."
        action={<ButtonLink href="/dashboard" variant="primary">Go to dashboard</ButtonLink>}
      />
    </main>
  );
}
