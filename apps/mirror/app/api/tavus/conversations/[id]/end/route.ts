import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TavusApiError, endConversation } from "@feel-good/tavus";
import { serverEnv } from "@/lib/env/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const cookieId = cookieStore.get("tavus_conv_id")?.value;

  if (!cookieId || cookieId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await endConversation(serverEnv.TAVUS_API_KEY, id);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete({ name: "tavus_conv_id", path: "/api/tavus" });
    return res;
  } catch (error) {
    console.error("[tavus/conversations/end]", error);

    if (error instanceof TavusApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to end conversation" },
      { status: 500 },
    );
  }
}
