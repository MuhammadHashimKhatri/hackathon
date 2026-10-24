import { Megaphone } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Announcements" };

export default function Page() {
  return (
    <>
      <PageHeader title="Announcements" description="Company news from Admin and HR." />
      <Card>
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="Posts from Admin and HR show here for everyone."
        />
      </Card>
    </>
  );
}
