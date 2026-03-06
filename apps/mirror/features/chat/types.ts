import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

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
  threadId: string;
  status: "active" | "archived";
  title: string;
  streamingInProgress?: boolean;
};
