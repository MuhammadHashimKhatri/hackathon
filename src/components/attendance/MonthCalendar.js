"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleDot, PencilLine } from "lucide-react";
import { formatDate, formatMonth } from "@/lib/format";
import { cn } from "@/lib/cn";
import Badge, { STATUS } from "@/components/ui/Badge";
import Button, { ButtonLink } from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import CorrectionDialog from "./CorrectionDialog";

// Tinted day cells, same tones as the status badges.
export const DAY_TONE = {
  present: "bg-success-soft text-success",
  late: "bg-warning-soft text-warning",
  half_day: "bg-caution-soft text-caution",
  absent: "bg-danger-soft text-danger",
  on_leave: "bg-info-soft text-info",
  missing_checkout: "bg-neutral-soft text-neutral",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SOURCE_LABELS = { web: "Web check-in", camera: "Camera check-in", correction: "Corrected by HR" };
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

function MonthNav({ calendar, onMonth, loading }) {
  const nextDisabled = calendar.month >= calendar.today.slice(0, 7);
  const prev = { "aria-label": "Previous month", icon: ChevronLeft, size: "icon", variant: "ghost" };
  const next = { "aria-label": "Next month", icon: ChevronRight, size: "icon", variant: "ghost" };
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{formatMonth(`${calendar.month}-01`)}</h2>
      <div className="flex items-center gap-1">
        {onMonth ? (
          <>
            <Button {...prev} disabled={loading} onClick={() => onMonth(calendar.prevMonth)} />
            <Button {...next} disabled={loading || nextDisabled} onClick={() => onMonth(calendar.nextMonth)} />
          </>
        ) : (
          <>
            <ButtonLink href={`?month=${calendar.prevMonth}`} {...prev} />
            <ButtonLink
              href={`?month=${calendar.nextMonth}`}
              {...next}
              aria-disabled={nextDisabled || undefined}
              tabIndex={nextDisabled ? -1 : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
}

// calendar: the result of getCalendar(). onMonth(month) switches months in place
// (Employee 360); without it the arrows link to ?month=. canRequest: own calendar.
export default function MonthCalendar({ calendar, onMonth, loading = false, canRequest = false, onRequested }) {
  const [selected, setSelected] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const leading = (weekday(calendar.days[0].date) + 6) % 7; // Monday-first grid

  return (
    <div className="flex flex-col gap-3">
      <MonthNav calendar={calendar} onMonth={onMonth} loading={loading} />
      <div className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", loading && "opacity-60")} aria-busy={loading || undefined}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[0.75rem] font-medium text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {calendar.days.map((day) => {
          const dayNumber = Number(day.date.slice(8));
          const isToday = day.date === calendar.today;
          const muted = !day.status && (!day.isWorkingDay || !day.employed || day.isFuture);
          const label = day.status
            ? STATUS[day.status].label
            : day.holidayName ?? (!day.isWorkingDay ? "Off day" : day.isFuture || !day.employed ? "" : "Not checked in");
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelected(day)}
              aria-label={`${formatDate(day.date)}: ${label || "nothing recorded"}`}
              className={cn(
                "relative flex min-h-12 flex-col items-start rounded-lg p-1.5 text-left transition-colors sm:min-h-20 sm:p-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                day.status ? DAY_TONE[day.status] : muted ? "bg-surface-2/60 text-muted" : "border border-line text-ink hover:bg-surface-2",
                isToday && "ring-2 ring-accent"
              )}
            >
              <span className="figure text-sm font-semibold">{dayNumber}</span>
              <span className="hidden truncate text-[0.6875rem] leading-tight sm:block sm:max-w-full">{label}</span>
              {day.checkIn ? (
                <span className="figure hidden text-[0.6875rem] opacity-80 sm:block">
                  {day.checkIn}
                  {day.checkOut ? `–${day.checkOut}` : ""}
                </span>
              ) : null}
              {day.pendingCorrection ? (
                <CircleDot size={12} className="absolute top-1.5 right-1.5 text-accent" aria-label="Correction pending" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-[0.75rem] text-muted">
        Tap a day for details.{canRequest ? " Ask HR to fix a wrong or missing time from there." : ""}
      </p>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="sm"
        title={selected ? formatDate(selected.date) : ""}
        footer={
          selected && canRequest && !selected.isFuture && selected.employed && !selected.pendingCorrection ? (
            <Button
              variant="primary"
              icon={PencilLine}
              onClick={() => {
                setCorrecting(selected);
                setSelected(null);
              }}
            >
              Request correction
            </Button>
          ) : null
        }
      >
        {selected ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Status</dt>
            <dd>{selected.status ? <Badge status={selected.status} /> : selected.holidayName ?? (selected.isWorkingDay ? "Nothing recorded" : "Off day")}</dd>
            <dt className="text-muted">Check-in</dt>
            <dd className="figure">{selected.checkIn ?? "—"}</dd>
            <dt className="text-muted">Check-out</dt>
            <dd className="figure">{selected.checkOut ?? "—"}</dd>
            {selected.source ? (
              <>
                <dt className="text-muted">Recorded by</dt>
                <dd>{SOURCE_LABELS[selected.source]}</dd>
              </>
            ) : null}
            {selected.pendingCorrection ? (
              <>
                <dt className="text-muted">Correction</dt>
                <dd>Waiting for HR</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </Dialog>

      {correcting ? (
        <CorrectionDialog
          day={correcting}
          onClose={() => setCorrecting(null)}
          onSent={(c) => {
            setCorrecting(null);
            onRequested?.(c);
          }}
        />
      ) : null}
    </div>
  );
}
