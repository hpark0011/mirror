import type {
  CreateConversationRequest,
  CreateConversationResponse,
} from "./types";

const TAVUS_API_BASE = "https://tavusapi.com/v2";

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
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(
      `Tavus API error (${response.status}): ${error.message || "Failed to create conversation"}`,
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
    throw new Error(`Failed to end conversation: ${response.status}`);
  }
}
