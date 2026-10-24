// Shared frame for the public forms.
export default function AuthCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
