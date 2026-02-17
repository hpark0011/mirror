export type CallState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "connecting"; conversationUrl: string; conversationId: string }
  | { status: "connected"; conversationUrl: string; conversationId: string }
  | { status: "error"; message: string }
  | { status: "ended" };

export type CallAction =
  | { type: "start" }
  | { type: "connect"; conversationUrl: string; conversationId: string }
  | { type: "connected" }
  | { type: "error"; message: string }
  | { type: "end" }
  | { type: "reset" };
