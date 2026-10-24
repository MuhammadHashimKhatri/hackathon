import Link from "next/link";
import { ScrollText } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { auditFacets, listAudit } from "@/server/services/auditLog";
import { auditQuery } from "@/lib/validation/dashboard";
import { firstValues } from "@/lib/searchParams";
import AuditFilters from "./AuditFilters";

export const metadata = { title: "Audit Log" };

const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const json = (v) => (v === null || v === undefined ? "—" : JSON.stringify(v, null, 2));

async function Log({ searchParams }) {
  const actor = await getPageActor();
  const q = auditQuery.parse(firstValues(await searchParams));
  const [result, facets] = await Promise.all([listAudit(actor, { ...q, actorId: q.actor }), auditFacets(actor)]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p) => {
    const params = new URLSearchParams(Object.entries({ ...q, page: String(p) }).filter(([, v]) => v));
    return `/audit?${params}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <AuditFilters facets={facets} />
      {result.rows.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No audit entries" description="Creates, updates, approvals and payroll finalization are recorded here." />
        </Card>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-line">
            {result.rows.map((e) => (
              <li key={e.id}>
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm">
                      <span className="font-medium">{e.actorEmail ?? "System"}</span>
                      {e.actorRole ? <span className="text-muted"> ({e.actorRole})</span> : null} <span className="font-semibold">{e.action}</span>{" "}
                      <span className="text-muted">{e.entity.replaceAll("_", " ")}</span>
                    </span>
                    <span className="text-[0.8125rem] text-muted">{time.format(new Date(e.createdAt))}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[0.8125rem] font-medium text-muted">Before</p>
                      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{json(e.before)}</pre>
                    </div>
                    <div>
                      <p className="mb-1 text-[0.8125rem] font-medium text-muted">After</p>
                      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{json(e.after)}</pre>
                    </div>
                  </div>
                  {e.entityId ? <p className="figure mt-2 text-[0.75rem] text-muted">Record {e.entityId}</p> : null}
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {q.page > 1 ? <Link href={pageHref(q.page - 1)} className="font-medium text-accent hover:underline">Newer</Link> : <span />}
          <span className="text-muted">
            Page {q.page} of {pages} ({result.total} entries)
          </span>
          {q.page < pages ? <Link href={pageHref(q.page + 1)} className="font-medium text-accent hover:underline">Older</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}

export default function AuditPage({ searchParams }) {
  return (
    <RoleGate href="/audit">
      <PageHeader title="Audit Log" description="Every important action with who did it and the before/after values. Entries can't be edited or deleted." />
      <Log searchParams={searchParams} />
    </RoleGate>
  );
}
