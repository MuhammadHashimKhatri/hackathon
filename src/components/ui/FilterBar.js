"use client";

import { cn } from "@/lib/cn";
import DatePicker from "./DatePicker";
import Select from "./Select";
import useUrlParams from "./useUrlParams";

// Date range (?from=&to=) + department (?dept=). Render inside <Suspense>.
export default function FilterBar({ departments = [], showDepartment = true, className }) {
  const { searchParams, setParams } = useUrlParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const dept = searchParams.get("dept") ?? "";
  const noDepartments = departments.length === 0;

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end", className)}>
      <DatePicker
        label="From"
        name="from"
        value={from}
        max={to || undefined}
        onChange={(e) => setParams({ from: e.target.value })}
        className="sm:w-44"
      />
      <DatePicker
        label="To"
        name="to"
        value={to}
        min={from || undefined}
        onChange={(e) => setParams({ to: e.target.value })}
        className="sm:w-44"
      />
      {showDepartment ? (
        <Select
          label="Department"
          name="dept"
          value={dept}
          disabled={noDepartments}
          placeholder={noDepartments ? "No departments yet" : "All departments"}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(e) => setParams({ dept: e.target.value })}
          className="col-span-2 sm:w-56"
        />
      ) : null}
    </div>
  );
}
