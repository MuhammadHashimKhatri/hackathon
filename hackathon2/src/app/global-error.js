"use client";

// Replaces the root layout when it fails, so it can't rely on globals.css.
// Colours follow the OS scheme only (see Next docs: global-error).
export default function GlobalError({ retry }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <title>Something went wrong | HCM Lite</title>
        <div>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>HCM Lite didn&apos;t load</h1>
          <p style={{ margin: "0 0 1rem", opacity: 0.7 }}>Reload the page. If it keeps happening, tell your admin.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
