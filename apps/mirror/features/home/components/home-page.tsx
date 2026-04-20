import Link from "next/link";

import { WaitlistForm } from "./waitlist-form";

export function MirrorHomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen gap-10">
      <div className="flex flex-col gap-4 items-center">
        <div className="text-2xl font-medium">
          MIRROR
        </div>
        <p className="text-xl">
          Turn your mind into something others can talk to.
        </p>
      </div>

      <div className="flex flex-col gap-4 items-center">
        <WaitlistForm />
        <Link
          href="/sign-in"
          className="text-sm text-muted-foreground hover:underline"
        >
          Already invited? Sign in
        </Link>
      </div>
    </div>
  );
}
