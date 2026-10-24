"use client";

import DatePicker from "@/components/ui/DatePicker";
import SearchBar from "@/components/ui/SearchBar";
import Select from "@/components/ui/Select";
import useUrlParams from "@/components/ui/useUrlParams";

// Date, department and name search for the board (?date, department, q). Render inside <Suspense>.
export default function BoardControls({ departments, date, today }) {
  const { searchParams, setParams } = useUrlParams();
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <DatePicker
        label="Date"
        name="date"
        value={date}
        max={today}
        onChange={(e) => setParams({ date: e.target.value === today ? "" : e.target.value, status: "" })}
        className="sm:w-44"
      />
      <Select
        label="Department"
        name="department"
        value={searchParams.get("department") ?? ""}
        placeholder="All departments"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(e) => setParams({ department: e.target.value })}
        className="sm:w-56"
      />
      <SearchBar placeholder="Search name or code" label="Search employees" className="col-span-2 sm:w-64" />
    </div>
  );
}
