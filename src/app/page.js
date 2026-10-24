import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">HCM Lite</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        People, attendance, leave and payroll in one place.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Login
      </Link>
    </main>
  );
}
