# @feel-good/features/auth

Pluggable auth components for Feel Good apps.

## Quick Start

```tsx
import { LoginBlock } from "@feel-good/features/auth/blocks";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  return <LoginBlock authClient={authClient} />;
}
```

## Abstraction Levels

| Import                  | Use When                                |
| ----------------------- | --------------------------------------- |
| `auth/blocks`           | Most apps — drop-in page sections       |
| `auth/components/forms` | Custom layouts — compose forms yourself |
| `auth/views`            | Custom logic — bring your own state     |
| `auth/hooks`            | Fully custom UI — headless logic only   |

## Available Blocks

- `LoginBlock` — Magic Link + OAuth sign-in
- `SignUpBlock` — Magic Link + OAuth registration

> **Product decision:** Authentication uses magic-link-only (no password form).
> Magic links provide a simpler, more secure authentication experience.

## Configuration

`getAuthClient()` defaults to Better Auth's same-origin `/api/auth` endpoint.
Prefer that for apps that proxy auth through their own domain, including Vercel
preview deployments with unique hosts.

```tsx
<LoginBlock
  authClient={authClient}
  signUpHref="/sign-up"
  redirectTo="/dashboard"
  onSuccess={() => console.log("Logged in!")}
  onError={(error) => console.error(error)}
/>
```

## Hooks

For headless auth logic:

```tsx
import { useMagicLinkRequest } from "@feel-good/features/auth/hooks";

function CustomLoginForm() {
  const { email, setEmail, status, error, submit } =
    useMagicLinkRequest(authClient);

  // Build your own UI
}
```

Available hooks:

- `useMagicLinkRequest` — Request magic link email
- `useOTPAuth` — OTP send/verify flow
- `createUseSession` — Session management factory

## Naming Conventions

- **Hooks** use "SignIn/SignUp" to match the Better Auth client API methods (`signIn.email`, `signUp.email`)
- **UI components** (forms, views, blocks) use "Login/SignUp" for user-facing terminology
- **Routes** use kebab-case `/sign-in` and `/sign-up`

## Security

- Error messages don't reveal account existence (user enumeration protection)
- Status ref guards prevent double-submission
- Redirect URLs validated against allowed origins

## Accessibility

- WCAG 2.2 compliant forms
- Proper `aria-` attributes for screen readers
- Correct `autoComplete` values for password managers
- Keyboard navigation support
