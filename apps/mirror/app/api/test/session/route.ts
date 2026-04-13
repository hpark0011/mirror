import { NextResponse, type NextRequest } from "next/server";

interface TestSessionRequestBody {
  email: string;
}

interface TestSessionResponse {
  ok: boolean;
  username: string;
}

interface ReadOtpResponse {
  otp: string;
}

const TEST_EMAIL_SUFFIX = "@mirror.test";

// Constant-time compare so the secret length does not leak via timing.
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard 1: Route is permanently disabled in production, even if
  // PLAYWRIGHT_TEST_SECRET is accidentally set there.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Guard 2: Route only exists when PLAYWRIGHT_TEST_SECRET is configured.
  // Return 404 (not 403) to avoid leaking that the route exists when unset.
  const testSecret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Guard 3: Caller must present the matching secret header.
  const incomingSecret = request.headers.get("x-test-secret");
  if (!incomingSecret || !secretsMatch(incomingSecret, testSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Guard 4: Request body must contain a non-empty test email.
  let body: TestSessionRequestBody;
  try {
    body = (await request.json()) as TestSessionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email || typeof body.email !== "string" || body.email.trim() === "") {
    return NextResponse.json({ error: "Missing or empty email" }, { status: 400 });
  }

  if (!body.email.endsWith(TEST_EMAIL_SUFFIX)) {
    return NextResponse.json(
      { error: `Email must end in ${TEST_EMAIL_SUFFIX}` },
      { status: 400 },
    );
  }

  const { email } = body;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_SITE_URL is not configured" },
      { status: 500 },
    );
  }

  // Step 1: Trigger OTP send. The sendVerificationOTP hook intercepts in test
  // mode and stores the plain OTP in the testOtpStore table instead of emailing it.
  const sendOtpRes = await fetch(
    `${convexSiteUrl}/api/auth/email-otp/send-verification-otp`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    },
  );
  if (!sendOtpRes.ok) {
    return NextResponse.json(
      { error: "send-verification-otp failed" },
      { status: sendOtpRes.status },
    );
  }

  // Step 2: Read the stored OTP from the testOtpStore via the internal HTTP action.
  const readOtpRes = await fetch(`${convexSiteUrl}/test/read-otp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email }),
  });
  if (!readOtpRes.ok) {
    return NextResponse.json(
      { error: "read-otp failed" },
      { status: readOtpRes.status },
    );
  }
  const { otp } = (await readOtpRes.json()) as ReadOtpResponse;

  // Step 3: Sign in with the OTP to create a real Better Auth session.
  const signInRes = await fetch(`${convexSiteUrl}/api/auth/sign-in/email-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  if (!signInRes.ok) {
    return NextResponse.json(
      { error: "sign-in/email-otp failed" },
      { status: signInRes.status },
    );
  }

  // Collect all Set-Cookie headers from the sign-in response.
  const signInCookies = signInRes.headers.getSetCookie();

  // Step 4: Ensure the app-level user profile exists (username, onboardingComplete, etc.).
  const ensureUserRes = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email, username: "test-user" }),
  });
  if (!ensureUserRes.ok) {
    return NextResponse.json(
      { error: "ensure-user failed" },
      { status: ensureUserRes.status },
    );
  }

  // Step 5: Pre-warm the Convex JWT by forwarding the session cookie to the
  // convex/token endpoint. This ensures SSR Convex queries authenticate correctly
  // on the first load without an extra round-trip.
  const cookieHeader = signInCookies
    .map((c) => c.split(";")[0]) // strip cookie attributes; keep name=value only
    .join("; ");

  const tokenRes = await fetch(`${convexSiteUrl}/api/auth/convex/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
  });
  // Collect additional Set-Cookie headers from the token response (convex_jwt).
  const tokenCookies = tokenRes.ok ? tokenRes.headers.getSetCookie() : [];

  // Step 6: Forward all collected Set-Cookie headers to the caller (Playwright).
  const allCookies = [...signInCookies, ...tokenCookies];

  const responseBody: TestSessionResponse = { ok: true, username: "test-user" };
  const response = NextResponse.json(responseBody, { status: 200 });

  for (const cookieValue of allCookies) {
    response.headers.append("set-cookie", cookieValue);
  }

  return response;
}
