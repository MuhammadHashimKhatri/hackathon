"use client";

import { EMPLOYEE_STATUSES, STATUS_LABELS } from "@/lib/validation/employees";
import SearchBar from "@/components/ui/SearchBar";
import Select from "@/components/ui/Select";
import useUrlParams from "@/components/ui/useUrlParams";

const SORT_OPTIONS = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "code:asc", label: "Employee code" },
  { value: "join_date:desc", label: "Newest joiners" },
  { value: "join_date:asc", label: "Longest serving" },
  { value: "department:asc", label: "Department" },
];

// Search, filters and sort for the directory and salary pages. All state is
// in the URL (?q, department, designation, status, sort, dir). Render inside <Suspense>.
export default function DirectoryControls({ departments, designations }) {
  const { searchParams, setParams } = useUrlParams();
  const department = searchParams.get("department") ?? "";
  const designation = searchParams.get("designation") ?? "";
  const sort = `${searchParams.get("sort") ?? "name"}:${searchParams.get("dir") ?? "asc"}`;

  const designationOptions = designations
    .filter((d) => !department || d.departmentId === department || d.departmentId === null)
    .map((d) => ({ value: d.id, label: d.title }));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <SearchBar placeholder="Search name, code or email" label="Search employees" className="lg:max-w-xs" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex-1">
        <Select
          label="Department"
          name="department"
          value={department}
          placeholder="All departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(e) => setParams({ department: e.target.value, designation: "" })}
        />
        <Select
          label="Designation"
          name="designation"
          value={designation}
          placeholder="All designations"
          options={designationOptions}
          onChange={(e) => setParams({ designation: e.target.value })}
        />
        <Select
          label="Status"
          name="status"
          value={searchParams.get("status") ?? ""}
          placeholder="Any status"
          options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(e) => setParams({ status: e.target.value })}
        />
        <Select
          label="Sort by"
          name="sort"
          value={SORT_OPTIONS.some((o) => o.value === sort) ? sort : "name:asc"}
          options={SORT_OPTIONS}
          onChange={(e) => {
            const [s, d] = e.target.value.split(":");
            setParams({ sort: s === "name" ? "" : s, dir: d === "asc" ? "" : d });
          }}
        />
      </div>
    </div>
  );
}
