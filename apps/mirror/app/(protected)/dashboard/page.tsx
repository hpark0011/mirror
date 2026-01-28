"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@feel-good/ui/primitives/button";

export default function DashboardPage() {
  const { user, isLoading, signOut } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Mirror
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Welcome, {user?.name || "there"}!
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are now signed in to Mirror. This is your dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}
