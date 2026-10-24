"use client";

import { Suspense } from "react";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/ui/Select";
import useUrlParams from "@/components/ui/useUrlParams";

function Filters({ facets }) {
  const { searchParams, setParams } = useUrlParams();
  const value = (k) => searchParams.get(k) ?? "";
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <Select
        label="Who"
        name="actor"
        value={value("actor")}
        placeholder="Anyone"
        options={facets.actors.map((a) => ({ value: a.id, label: a.email }))}
        onChange={(e) => setParams({ actor: e.target.value })}
        className="col-span-2 sm:w-56"
      />
      <Select
        label="Action"
        name="action"
        value={value("action")}
        placeholder="Any action"
        options={facets.actions.map((a) => ({ value: a, label: a }))}
        onChange={(e) => setParams({ action: e.target.value })}
        className="sm:w-40"
      />
      <Select
        label="Record type"
        name="entity"
        value={value("entity")}
        placeholder="Any record"
        options={facets.entities.map((a) => ({ value: a, label: a.replaceAll("_", " ") }))}
        onChange={(e) => setParams({ entity: e.target.value })}
        className="sm:w-48"
      />
      <DatePicker label="From" name="from" value={value("from")} onChange={(e) => setParams({ from: e.target.value })} className="sm:w-44" />
      <DatePicker label="To" name="to" value={value("to")} onChange={(e) => setParams({ to: e.target.value })} className="sm:w-44" />
    </div>
  );
}

// Reads searchParams, so it sits in its own Suspense boundary.
export default function AuditFilters({ facets }) {
  return (
    <Suspense>
      <Filters facets={facets} />
    </Suspense>
  );
}
