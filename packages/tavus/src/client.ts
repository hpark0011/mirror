import {
  type CreateConversationRequest,
  type CreateConversationResponse,
  type TavusErrorBody,
} from "./types";

const TAVUS_API_BASE = "https://tavusapi.com/v2";

export class TavusApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TavusApiError";
  }
}

export async function createConversation(
  apiKey: string,
  request: CreateConversationRequest,
): Promise<CreateConversationResponse> {
  const response = await fetch(`${TAVUS_API_BASE}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body: TavusErrorBody = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new TavusApiError(
      response.status,
      body.message || body.error || body.detail || "Failed to create conversation",
    );
  }

  return response.json();
}

export async function endConversation(
  apiKey: string,
  conversationId: string,
): Promise<void> {
  const response = await fetch(
    `${TAVUS_API_BASE}/conversations/${conversationId}/end`,
    {
      method: "POST",
      headers: { "x-api-key": apiKey },
    },
  );

  if (!response.ok) {
    throw new TavusApiError(response.status, "Failed to end conversation");
  }
}
