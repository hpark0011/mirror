import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl">
          Mirror
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Your personal mirror for productivity
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-8 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
