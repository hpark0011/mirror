import "server-only";

import { NextResponse } from "next/server";
import { TavusApiError, endConversation } from "@feel-good/tavus";
import { serverEnv } from "@/lib/env/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await endConversation(serverEnv.TAVUS_API_KEY, id);
    return NextResponse.json({ ok: true });
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
