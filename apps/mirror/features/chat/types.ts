import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  type ChatMode,
  DEFAULT_CHAT_MODE,
} from "@feel-good/convex/convex/chat/mode";

export { type ChatMode, DEFAULT_CHAT_MODE };

export type ChatRouteResolution =
  | { status: "resolving" }
  | { status: "ready"; conversationId: Id<"conversations"> }
  | { status: "new_conversation" }
  | { status: "invalid" }
  | { status: "empty" };

export type Conversation = {
  _id: Id<"conversations">;
  _creationTime: number;
  profileOwnerId: Id<"users">;
  viewerId?: Id<"users">;
  mode: ChatMode;
  threadId: string;
  status: "active" | "archived";
  title: string;
  streamingInProgress?: boolean;
};
