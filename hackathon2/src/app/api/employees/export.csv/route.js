import { withApi } from "@/server/http";
import { requireActor } from "@/server/auth/guard";
import { exportEmployeesCsv } from "@/server/services/employeeCsv";

export const GET = withApi(async () => {
  const actor = await requireActor();
  const { filename, csv } = await exportEmployeesCsv(actor);
  // BOM so Excel opens UTF-8 names correctly.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
