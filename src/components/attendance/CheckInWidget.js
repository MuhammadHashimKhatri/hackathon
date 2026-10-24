"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LogIn, LogOut, MapPin, MapPinOff } from "lucide-react";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import { useToast } from "@/components/ui/Toast";

// Browser location, if the user allows it. Never blocks check-in (record only).
function currentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

const hours = (minutes) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;

// today: the result of getToday() rendered on the server. The clock shows
// server time in the company zone; the browser only adds elapsed seconds.
export default function CheckInWidget({ today, compact = false }) {
  const router = useRouter();
  const { toast } = useToast();
  const [record, setRecord] = useState(today.record ?? null);
  const [now, setNow] = useState(() => new Date(today.serverNow));
  const [location, setLocation] = useState(null); // "shared" | "denied" after an action
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const offset = useRef(0);

  useEffect(() => {
    offset.current = Date.parse(today.serverNow) - Date.now();
    const id = setInterval(() => setNow(new Date(Date.now() + offset.current)), 1000);
    return () => clearInterval(id);
  }, [today.serverNow]);

  if (!today.linked) {
    return (
      <EmptyState
        compact
        icon={MapPinOff}
        title="No employee record linked"
        description="Ask HR to register you as an employee to start checking in."
      />
    );
  }

  const tz = { timeZone: today.timezone };
  const clock = new Intl.DateTimeFormat("en-GB", { ...tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
  const dateLine = new Intl.DateTimeFormat("en-GB", { ...tz, weekday: "long", day: "numeric", month: "long" }).format(now);
  const checkedIn = Boolean(record);
  const checkedOut = Boolean(record?.checkOut);
  const workedMinutes = checkedIn
    ? Math.max(0, Math.floor(((checkedOut ? Date.parse(record.checkOutAt) : now.getTime()) - Date.parse(record.checkInAt)) / 60000))
    : 0;

  function run(kind) {
    setError(null);
    startTransition(async () => {
      let body;
      if (kind === "in") {
        const position = await currentPosition();
        setLocation(position ? "shared" : "denied");
        body = position ?? {};
      }
      const result = await postJson(`/api/attendance/check-${kind}`, body);
      if (!result.ok) {
        setError(result.status === 0 ? "Couldn't reach the server. Check your connection and try again." : (result.error?.message ?? "Something went wrong. Try again."));
        if (result.status === 409) router.refresh();
        return;
      }
      setRecord(result.data.attendance);
      const a = result.data.attendance;
      toast({
        tone: "success",
        title: kind === "in" ? `Checked in at ${a.checkIn}` : `Checked out at ${a.checkOut}`,
        description: a.status === "late" ? "Marked late." : a.status === "half_day" ? "Counted as a half day." : undefined,
      });
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col gap-5", !compact && "items-center text-center")}>
      <div className={cn("flex flex-col gap-1", !compact && "items-center")}>
        <p className="text-[0.8125rem] text-muted">
          {dateLine}
          {today.holidayName ? `, ${today.holidayName}` : !today.isWorkingDay ? ", off day" : ""}
        </p>
        <p
          className={cn("figure leading-none font-semibold tracking-tight text-ink", compact ? "text-4xl" : "text-6xl sm:text-7xl")}
          aria-label={`Time now ${clock}`}
          suppressHydrationWarning
        >
          {clock}
        </p>
        <p className="text-[0.8125rem] text-muted">Office time ({today.timezone}), starts {today.officeStart}</p>
      </div>

      {checkedIn ? (
        <dl className={cn("grid grid-cols-3 gap-4 text-sm", !compact && "w-full max-w-md")}>
          <div>
            <dt className="text-[0.8125rem] text-muted">In</dt>
            <dd className="figure font-semibold">{record.checkIn}</dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-muted">Out</dt>
            <dd className="figure font-semibold">{record.checkOut ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-muted">Worked</dt>
            <dd className="figure font-semibold">{hours(workedMinutes)}</dd>
          </div>
        </dl>
      ) : null}

      <div className={cn("flex flex-col gap-3", !compact && "w-full max-w-xs items-center")}>
        {checkedIn ? <Badge status={record.status} className="self-center" /> : null}
        <FormAlert className="text-left">{error}</FormAlert>
        {checkedOut ? (
          <Button size="md" disabled icon={CircleCheck} className="h-12 w-full text-base">
            Done for today
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={checkedIn ? LogOut : LogIn}
            loading={pending}
            onClick={() => run(checkedIn ? "out" : "in")}
            className="h-12 w-full text-base"
          >
            {checkedIn ? "Check out" : "Check in"}
          </Button>
        )}
        <p className="flex items-center justify-center gap-1.5 text-[0.8125rem] text-muted">
          <MapPin size={14} aria-hidden />
          {location === "denied"
            ? "Location not shared. You're still checked in."
            : record?.distanceM !== null && record?.distanceM !== undefined
              ? `Location recorded, about ${Math.round(record.distanceM)} m from the office.`
              : "Your location is recorded with your check-in if you allow it. Nothing else is captured."}
        </p>
      </div>
    </div>
  );
}
