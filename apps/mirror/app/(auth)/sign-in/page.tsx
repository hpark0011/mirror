import { LoginBlock } from "@feel-good/features/auth/blocks";
import { authClient } from "@/lib/auth-client";
import { getSafeRedirectUrl } from "@feel-good/features/auth/utils";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = getSafeRedirectUrl(next);
  return (
    <LoginBlock
      authClient={authClient}
      signUpHref="/sign-up"
      redirectTo={redirectTo}
    />
  );
}
