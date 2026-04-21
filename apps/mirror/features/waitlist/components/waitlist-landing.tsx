import Link from "next/link";

import { MirrorLogo } from "@/components/mirror-logo";

import { WaitlistForm } from "./waitlist-form";

export function WaitlistLanding() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen gap-10">
      <div className="absolute top-4 flex flex-col items-center gap-2">
        <Link
          href="/"
          className="text-2xl font-medium tracking-[-0.06em] outline-none"
        >
          MIRROR
        </Link>
        <div className="flex flex-col items-center max-w-sm px-8 my-2 mb-3">
          <MirrorLogo className="size-[40px]" />
        </div>
        <p className="text-[15px] text-center leading-[1.2]">
          Interface for your mind.
        </p>
      </div>

      <div className="flex w-full flex-col items-center">
        <WaitlistForm />
        <Link
          href="/sign-in"
          className="text-sm text-muted-foreground hover:underline mt-6"
        >
          Already invited? Sign in
        </Link>
      </div>
    </div>
  );
}
