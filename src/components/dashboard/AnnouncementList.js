import Link from "next/link";
import { Megaphone } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";

// Latest announcements, shown on every dashboard (Spec §4 row 23).
export default function AnnouncementList({ items }) {
  if (items.length === 0) {
    return <EmptyState compact icon={Megaphone} title="No announcements" description="Posts from Admin and HR show here for everyone." />;
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
          <p className="font-medium">{a.title}</p>
          <p className="line-clamp-2 text-sm text-muted">{a.body}</p>
          <p className="mt-0.5 text-[0.75rem] text-muted">{formatDate(a.createdAt)}</p>
        </li>
      ))}
      <li className="pt-2">
        <Link href="/announcements" className="text-sm font-medium text-accent hover:underline">
          All announcements
        </Link>
      </li>
    </ul>
  );
}
