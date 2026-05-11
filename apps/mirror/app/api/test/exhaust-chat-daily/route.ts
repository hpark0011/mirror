import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";

interface ExhaustRequestBody {
  username: string;
}

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const testSecret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const incomingSecret = request.headers.get("x-test-secret");
  if (!incomingSecret || !secretsMatch(incomingSecret, testSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ExhaustRequestBody;
  try {
    body = (await request.json()) as ExhaustRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.username || typeof body.username !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid username" },
      { status: 400 },
    );
  }

  const convexSiteUrl = serverEnv.CONVEX_SITE_URL;

  const res = await fetch(`${convexSiteUrl}/test/exhaust-chat-daily`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ username: body.username }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "exhaust-chat-daily failed" },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
