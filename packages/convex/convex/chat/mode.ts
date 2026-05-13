import { v, type Infer } from "convex/values";

export const CHAT_MODE_VALUES = ["clone", "configuration"] as const;

export const chatModeValidator = v.union(
  v.literal("clone"),
  v.literal("configuration"),
);

export type ChatMode = Infer<typeof chatModeValidator>;

export const DEFAULT_CHAT_MODE: ChatMode = "clone";

export function getConversationMode(conversation: {
  mode?: ChatMode;
}): ChatMode {
  return conversation.mode ?? DEFAULT_CHAT_MODE;
}
