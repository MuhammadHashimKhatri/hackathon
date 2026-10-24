import { Megaphone } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { listAnnouncements } from "@/server/services/announcements";
import { formatDate } from "@/lib/format";
import PostAnnouncement from "./PostAnnouncement";

export const metadata = { title: "Announcements" };

async function Content() {
  const actor = await getPageActor();
  const items = await listAnnouncements(actor);
  const canPost = actor.role === "admin" || actor.role === "hr";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <Card>
            <EmptyState icon={Megaphone} title="No announcements yet" description={canPost ? "Post the first one with the form." : "Company news from Admin and HR will appear here."} />
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id}>
              <article className="flex flex-col gap-1.5">
                <h2 className="text-base font-semibold">{a.title}</h2>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="text-[0.8125rem] text-muted">
                  {formatDate(a.createdAt)}
                  {a.authorRole ? `, posted by ${a.authorRole === "hr" ? "HR" : "Admin"}` : ""}
                </p>
              </article>
            </Card>
          ))
        )}
      </div>
      {canPost ? <PostAnnouncement /> : null}
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <RoleGate href="/announcements">
      <PageHeader title="Announcements" description="Company news from Admin and HR. Everyone sees these on their dashboard." />
      <Content />
    </RoleGate>
  );
}
