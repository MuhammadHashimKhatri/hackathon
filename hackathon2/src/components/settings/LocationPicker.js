"use client";

import { useState } from "react";
import { ExternalLink, LocateFixed } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const GEO_ERRORS = {
  1: "Location permission was denied. Allow it in the browser, or type the coordinates.",
  2: "Your position isn't available right now. Try again, or type the coordinates.",
  3: "Finding your position took too long. Try again, or type the coordinates.",
};

// Office location for check-in (Spec §9: distance ≤ radius). Values are strings
// while editing; the form converts them on save.
export default function LocationPicker({ lat, lng, radius, onChange, errors = {}, disabled = false }) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState(null);

  function locateMe() {
    if (!window.isSecureContext) {
      setMessage({ tone: "danger", text: "Location needs HTTPS or localhost." });
      return;
    }
    if (!navigator.geolocation) {
      setMessage({ tone: "danger", text: "This browser can't share its location." });
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const accuracy = Math.round(pos.coords.accuracy);
        onChange({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setMessage(
          accuracy > 100
            ? { tone: "warning", text: `Accuracy ±${accuracy} m is low. Try near a window or type the coordinates.` }
            : { tone: "muted", text: `Accuracy ±${accuracy} m.` }
        );
      },
      (err) => {
        setLocating(false);
        setMessage({ tone: "danger", text: GEO_ERRORS[err.code] ?? "Couldn't get your location." });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  const hasPoint = lat !== "" && lng !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const tone = { danger: "text-danger", warning: "text-warning", muted: "text-muted" };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Latitude"
          name="office_lat"
          inputMode="decimal"
          placeholder="24.860700"
          value={lat}
          onChange={(e) => onChange({ lat: e.target.value })}
          error={errors.office_lat}
          disabled={disabled}
        />
        <Input
          label="Longitude"
          name="office_lng"
          inputMode="decimal"
          placeholder="67.001100"
          value={lng}
          onChange={(e) => onChange({ lng: e.target.value })}
          error={errors.office_lng}
          disabled={disabled}
        />
      </div>

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={LocateFixed} loading={locating} onClick={locateMe}>
            Use my current location
          </Button>
          {message ? (
            <p role="status" className={`text-[0.8125rem] ${tone[message.tone]}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Check-in radius (metres)"
          name="office_radius_m"
          type="number"
          min={10}
          max={5000}
          value={radius}
          onChange={(e) => onChange({ radius: e.target.value })}
          error={errors.office_radius_m}
          hint="Camera check-ins must be within this distance of the office."
          disabled={disabled}
        />
        {hasPoint ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-center text-sm text-accent hover:underline sm:mt-6"
          >
            View on map
            <ExternalLink size={14} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
