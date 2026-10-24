"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { settingsSchema, TIMEZONES } from "@/lib/validation/organization";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, patchJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import LocationPicker from "@/components/settings/LocationPicker";

// Mon–Sun order for people; values are JS weekday numbers (0 = Sunday).
const WEEKDAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"],
];
const TIMEZONE_OPTIONS = TIMEZONES.map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") }));

const toText = (v) => (v === null || v === undefined ? "" : String(v));

function toForm(s) {
  return {
    company_name: toText(s.company_name),
    timezone: s.timezone,
    office_start: s.office_start,
    grace_minutes: toText(s.grace_minutes),
    half_day_hours: toText(s.half_day_hours),
    weekend_days: s.weekend_days,
    office_lat: toText(s.office_lat),
    office_lng: toText(s.office_lng),
    office_radius_m: toText(s.office_radius_m),
    max_gps_accuracy_m: toText(s.max_gps_accuracy_m),
    late_penalty_enabled: s.late_penalty_enabled,
  };
}

const number = (text) => (text.trim() === "" ? Number.NaN : Number(text));
const optionalNumber = (text) => (text.trim() === "" ? null : Number(text));

function toPayload(f) {
  return {
    company_name: f.company_name,
    timezone: f.timezone,
    office_start: f.office_start,
    grace_minutes: number(f.grace_minutes),
    half_day_hours: number(f.half_day_hours),
    weekend_days: [...f.weekend_days].sort((a, b) => a - b),
    office_lat: optionalNumber(f.office_lat),
    office_lng: optionalNumber(f.office_lng),
    office_radius_m: number(f.office_radius_m),
    max_gps_accuracy_m: number(f.max_gps_accuracy_m),
    late_penalty_enabled: f.late_penalty_enabled,
  };
}

// Only the fields that differ from what's saved (lat/lng always travel together).
function changedFields(saved, payload) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (JSON.stringify(saved[key]) !== JSON.stringify(value)) out[key] = value;
  }
  if ("office_lat" in out || "office_lng" in out) {
    out.office_lat = payload.office_lat;
    out.office_lng = payload.office_lng;
  }
  return out;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(minutes)) return null;
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Section({ title, description, children }) {
  return (
    <Card title={title} description={description}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export default function CompanySettingsForm({ initial, canEdit }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, startTransition] = useTransition();

  const changes = useMemo(() => changedFields(saved, toPayload(form)), [saved, form]);
  const dirty = Object.keys(changes).length > 0;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const bind = (name) => ({ name, value: form[name], error: errors[name], onChange: (e) => set({ [name]: e.target.value }) });

  const lateAfter = addMinutes(form.office_start, number(form.grace_minutes));

  function toggleWeekend(day, checked) {
    set({ weekend_days: checked ? [...form.weekend_days, day] : form.weekend_days.filter((d) => d !== day) });
  }

  function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const parsed = settingsSchema.safeParse(changes);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await patchJson("/api/settings", parsed.data);
      if (!result.ok) {
        const state = formStateFromError(result, "Saving settings isn't available right now.");
        setFormError(state.formError);
        setErrors(state.fieldErrors ?? {});
        return;
      }
      setSaved(result.data.settings);
      setForm(toForm(result.data.settings));
      toast({ title: "Settings saved", description: "New check-ins and requests use these values.", tone: "success" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={!canEdit || pending} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">Company settings</legend>
        <FormAlert>{formError}</FormAlert>

        <Section title="Company">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Company name" required={canEdit} {...bind("company_name")} />
            <Select
              label="Time zone"
              options={TIMEZONE_OPTIONS}
              hint="All dates and times are worked out in this zone."
              {...bind("timezone")}
            />
          </div>
        </Section>

        <Section
          title="Working hours"
          description={
            lateAfter
              ? `Check-ins after ${lateAfter} are late. Days under ${form.half_day_hours || "?"} h worked are half days.`
              : "Set the office start time and grace period."
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Office starts at" type="time" {...bind("office_start")} />
            <Input label="Grace period (minutes)" type="number" min={0} max={240} {...bind("grace_minutes")} />
            <Input label="Half day under (hours)" type="number" min={0.5} max={12} step={0.5} {...bind("half_day_hours")} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-ink">Weekend days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(([day, label]) => {
                const checked = form.weekend_days.includes(day);
                return (
                  <label
                    key={day}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:disabled]:cursor-default"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleWeekend(day, e.target.checked)}
                      className="size-4 accent-accent"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {errors.weekend_days ? <p className="text-[0.8125rem] text-danger">{errors.weekend_days}</p> : null}
          </fieldset>
        </Section>

        <Section title="Office location" description="Used to check that camera check-ins happen at the office.">
          <LocationPicker
            lat={form.office_lat}
            lng={form.office_lng}
            radius={form.office_radius_m}
            errors={errors}
            disabled={!canEdit}
            onChange={(next) =>
              set({
                ...("lat" in next ? { office_lat: next.lat } : {}),
                ...("lng" in next ? { office_lng: next.lng } : {}),
                ...("radius" in next ? { office_radius_m: next.radius } : {}),
              })
            }
          />
          <Input
            label="Maximum GPS accuracy (metres)"
            type="number"
            min={5}
            max={1000}
            hint="Check-ins with a less precise location fix are refused."
            className="sm:max-w-xs"
            {...bind("max_gps_accuracy_m")}
          />
        </Section>

        <Section title="Late penalty">
          <Checkbox
            label="Deduct half a day for every 3 late check-ins in a month"
            description="Applied when payroll is generated. Off by default."
            name="late_penalty_enabled"
            checked={form.late_penalty_enabled}
            onChange={(e) => set({ late_penalty_enabled: e.target.checked })}
          />
        </Section>
      </fieldset>

      {canEdit ? (
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/90 py-3 backdrop-blur">
          {dirty ? <p className="text-[0.8125rem] text-muted">Unsaved changes</p> : null}
          <Button type="submit" variant="primary" icon={Save} loading={pending} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}
