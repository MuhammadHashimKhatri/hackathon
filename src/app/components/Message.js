export default async function Message({ searchParams }) {
  const { message } = await searchParams;
  if (!message) return null;

  return (
    <p className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {message}
    </p>
  );
}
