"use client";

import { useRef, useState, useTransition } from "react";
import { CircleCheck, Download, FileSearch, FileSpreadsheet, KeyRound, Upload } from "lucide-react";
import { CSV_COLUMNS, MAX_ROWS, REQUIRED_COLUMNS } from "@/lib/validation/employeeCsv";
import Button, { ButtonLink, buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormAlert from "@/components/ui/FormAlert";
import Table from "@/components/ui/Table";
import { cn } from "@/lib/cn";

const EXAMPLE_ROW = [
  "", "Ayesha Khan", "ayesha.khan@yourcompany.com", "0300-1234567", "Karachi", "female",
  "1995-03-01", "Engineering", "Developer", "2026-11-01", "probation", "50000",
];

const COLUMN_HELP = {
  employee_code: "Leave blank to get the next EMP-0001 style code",
  full_name: "Their full name",
  email: "Becomes their sign-in; must be new",
  phone: "Optional",
  address: "Optional",
  gender: "male, female or other",
  date_of_birth: "YYYY-MM-DD",
  department: "An existing department name",
  designation: "An existing designation in that department",
  join_date: "YYYY-MM-DD",
  status: "probation (default) or active",
  basic_salary: "Monthly basic, more than 0",
};

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function upload(file, dryRun) {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch(`/api/employees/import?dryRun=${dryRun}`, { method: "POST", body });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, data } : { ok: false, status: res.status, error: data?.error ?? null };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

const errorColumns = [
  { key: "row", header: "Row", render: (e) => <span className="figure">{e.row}</span> },
  { key: "field", header: "Column", render: (e) => (e.field ? <code className="text-[0.8125rem]">{e.field}</code> : "Whole row") },
  { key: "reason", header: "Problem", render: (e) => e.reason },
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function ImportManager() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(null); // dry-run result for `file`
  const [imported, setImported] = useState(null);
  const [formError, setFormError] = useState(null);
  const [action, setAction] = useState(null); // "check" | "import" while pending
  const [pending, startTransition] = useTransition();

  function chooseFile(e) {
    setFile(e.target.files?.[0] ?? null);
    setCheck(null);
    setImported(null);
    setFormError(null);
  }

  function run(dryRun) {
    if (!file) return;
    setAction(dryRun ? "check" : "import");
    setFormError(null);
    startTransition(async () => {
      const result = await upload(file, dryRun);
      if (!result.ok) {
        // Data changed since the dry run (e.g. someone registered the same email): show the new problems.
        const errors = result.error?.details?.errors;
        if (errors) setCheck((c) => ({ ...c, errors, validRows: 0 }));
        setFormError(
          result.status === 0
            ? "Couldn't reach the server. Check your connection and try again."
            : (result.error?.message ?? "Something went wrong. Try again.")
        );
        return;
      }
      if (dryRun) {
        setCheck(result.data);
        return;
      }
      setImported(result.data);
      setCheck(null);
      download("employee-logins.csv", result.data.credentialsCsv);
    });
  }

  function reset() {
    setFile(null);
    setCheck(null);
    setImported(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const clean = check && check.errors.length === 0;
  const problemRows = check ? new Set(check.errors.map((e) => e.row)).size : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {imported ? (
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <CircleCheck size={22} className="mt-0.5 shrink-0 text-success" aria-hidden />
                <div>
                  <p className="text-base font-semibold">{plural(imported.created, "employee", "employees")} imported</p>
                  <p className="mt-1 max-w-prose text-[0.8125rem] text-muted">
                    Their temporary passwords were downloaded as employee-logins.csv
                    {imported.linked ? ` (${imported.linked} kept their existing login)` : ""}. Share each one privately.
                    It&apos;s the only copy, so delete the file once everyone has signed in.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={KeyRound} onClick={() => download("employee-logins.csv", imported.credentialsCsv)}>
                  Download passwords again
                </Button>
                <ButtonLink href="/employees" variant="primary">View employees</ButtonLink>
                <Button variant="ghost" onClick={reset}>Import another file</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="Import employees" description={`A CSV with a header row, up to ${MAX_ROWS} employees and 1 MB.`}>
            <div className="flex flex-col gap-4">
              <FormAlert>{formError}</FormAlert>
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center",
                  "hover:bg-surface-2 focus-within:ring-2 focus-within:ring-accent/25"
                )}
              >
                <FileSpreadsheet size={24} className="text-muted" aria-hidden />
                <span className="text-sm font-medium break-all">{file ? file.name : "Choose a CSV file"}</span>
                <span className="text-[0.8125rem] text-muted">
                  {file ? `${(file.size / 1024).toFixed(1)} KB. Choose another to replace it.` : "Saved from Excel or Google Sheets as CSV"}
                </span>
                <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={chooseFile} className="sr-only" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button icon={FileSearch} onClick={() => run(true)} disabled={!file || pending} loading={pending && action === "check"}>
                  Check file
                </Button>
                <Button
                  variant="primary"
                  icon={Upload}
                  onClick={() => run(false)}
                  disabled={!clean || pending}
                  loading={pending && action === "import"}
                >
                  {clean ? `Import ${plural(check.validRows, "employee", "employees")}` : "Import"}
                </Button>
              </div>
              {file && !check ? (
                <p className="text-[0.8125rem] text-muted">Check the file first. Import unlocks when every row is valid.</p>
              ) : null}
            </div>
          </Card>
        )}

        {check && clean ? (
          <Card>
            <div className="flex items-start gap-3">
              <CircleCheck size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
              <p className="text-sm">
                {check.totalRows === 1 ? "The row is" : `All ${check.totalRows} rows are`} valid and ready to import.
                {check.linkedRows
                  ? ` ${plural(check.linkedRows, "row matches an existing HR or Admin login", "rows match existing HR or Admin logins")} and will be linked instead of getting a new one.`
                  : ""}
              </p>
            </div>
          </Card>
        ) : null}
        {check && !clean ? (
          <Card
            title={`${plural(check.errors.length, "problem", "problems")} in ${plural(problemRows, "row", "rows")}`}
            description="Nothing has been imported. Fix these in your spreadsheet, save it as CSV and check again. Row numbers match the spreadsheet; the header is row 1."
            padding={false}
          >
            <div className="p-2 sm:p-3">
              <Table
                columns={errorColumns}
                rows={check.errors}
                rowKey={(e) => `${e.row}-${e.field}-${e.reason}`}
                caption="Problems found in the file"
              />
            </div>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Export" description="Every employee with their current basic salary, in the import format.">
          <a href="/api/employees/export.csv" download className={buttonClass()}>
            <Download size={16} aria-hidden /> Export employees
          </a>
        </Card>
        <Card title="Columns" description="Header names must match; order doesn't matter.">
          <dl className="flex flex-col gap-2.5 text-[0.8125rem]">
            {CSV_COLUMNS.map((c) => (
              <div key={c}>
                <dt>
                  <code className="font-medium text-ink">{c}</code>
                  {REQUIRED_COLUMNS.includes(c) ? <span className="text-danger"> *</span> : null}
                </dt>
                <dd className="text-muted">{COLUMN_HELP[c]}</dd>
              </div>
            ))}
          </dl>
          <Button
            size="sm"
            icon={Download}
            className="mt-4"
            onClick={() => download("employees-template.csv", `${CSV_COLUMNS.join(",")}\n${EXAMPLE_ROW.join(",")}\n`)}
          >
            Download template
          </Button>
        </Card>
      </div>
    </div>
  );
}
