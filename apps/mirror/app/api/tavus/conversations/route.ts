import "server-only";

import { NextResponse } from "next/server";
import {
  createConversation,
  serializeArticlesToContext,
  type Article,
} from "@feel-good/tavus";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.TAVUS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Tavus API key not configured" },
        { status: 500 },
      );
    }

    const personaId = process.env.TAVUS_PERSONA_ID ?? "pdced222244b";

    const body = (await request.json()) as { articles: Article[] };
    const { articles } = body;

    const conversationalContext = serializeArticlesToContext(articles);

    const response = await createConversation(apiKey, {
      persona_id: personaId,
      conversational_context: conversationalContext,
      properties: {
        max_duration: 600,
      },
    });

    return NextResponse.json({
      conversation_url: response.conversation_url,
      conversation_id: response.conversation_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
