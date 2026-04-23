import { type UIMessage } from "@convex-dev/agent/react";

export function countMessagesByRole(messages: UIMessage[]) {
  let user = 0;
  let assistant = 0;

  for (const message of messages) {
    if (message.role === "user") {
      user += 1;
    } else if (message.role === "assistant") {
      assistant += 1;
    }
  }

  return { user, assistant };
}

export function findInsertIndexBeforeNewAssistant(
  messages: UIMessage[],
  assistantBaseline: number,
) {
  let seenAssistantCount = 0;

  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role !== "assistant") continue;
    if (seenAssistantCount === assistantBaseline) {
      return index;
    }
    seenAssistantCount += 1;
  }

  return messages.length;
}

export function findFirstNewAssistant(
  messages: UIMessage[],
  assistantBaseline: number,
) {
  let seenAssistantCount = 0;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message?.role !== "assistant") continue;
    if (seenAssistantCount === assistantBaseline) {
      return { index, message };
    }
    seenAssistantCount += 1;
  }

  return null;
}
