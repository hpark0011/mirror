import { Button } from "@feel-good/ui/primitives/button";
import Link from "next/link";

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
        <p className="text-sm">Join Waitlist</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button variant="outline" size="lg" asChild>
          <Link href="/sign-in">
            Sign in
          </Link>
        </Button>
        <Button variant="primary" size="lg" asChild>
          <Link href="/sign-up">
            Create account
          </Link>
        </Button>
      </div>
    </div>
  );
}
