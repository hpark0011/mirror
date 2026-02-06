import { SignUpBlock } from "@feel-good/features/auth/blocks";
import { authClient } from "@/lib/auth-client";
import { getSafeRedirectUrl } from "@feel-good/features/auth/utils";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = getSafeRedirectUrl(next);
  return (
    <SignUpBlock
      authClient={authClient}
      signInHref="/sign-in"
      redirectTo={redirectTo}
    />
  );
}
