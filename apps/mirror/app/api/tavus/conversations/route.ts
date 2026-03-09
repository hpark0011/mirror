import "server-only";

import { NextResponse } from "next/server";
import {
  TavusApiError,
  createConversation,
  serializeArticlesToContext,
} from "@feel-good/tavus";
import { api } from "@feel-good/convex/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { serverEnv } from "@/lib/env/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username: string };
    const articles = await fetchAuthQuery(
      api.articles.queries.getByUsernameForConversation,
      { username: body.username },
    );
    if (!articles) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const conversationalContext = serializeArticlesToContext(articles);

    const response = await createConversation(serverEnv.TAVUS_API_KEY, {
      persona_id: serverEnv.TAVUS_PERSONA_ID,
      conversational_context: conversationalContext,
      properties: {
        max_call_duration: 600,
      },
    });

    return NextResponse.json({
      conversation_url: response.conversation_url,
      conversation_id: response.conversation_id,
    });
  } catch (error) {
    console.error("[tavus/conversations]", error);

    if (error instanceof TavusApiError && error.status === 429) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to start conversation" },
      { status: 500 },
    );
  }
}
