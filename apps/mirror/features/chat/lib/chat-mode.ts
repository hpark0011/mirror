import { DEFAULT_CHAT_MODE, type ChatMode } from "../types";

export function parseChatMode(value: string | null | undefined): ChatMode {
  return value === "configuration" ? "configuration" : DEFAULT_CHAT_MODE;
}

export function isConfigurationMode(mode: ChatMode): boolean {
  return mode === "configuration";
}
