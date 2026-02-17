"use client";

import { useReducer } from "react";
import type { CallState, CallAction } from "../types";

function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "start":
      return { status: "creating" };
    case "connect":
      return {
        status: "connecting",
        conversationUrl: action.conversationUrl,
        conversationId: action.conversationId,
      };
    case "connected":
      if (state.status !== "connecting") return state;
      return {
        status: "connected",
        conversationUrl: state.conversationUrl,
        conversationId: state.conversationId,
      };
    case "error":
      return { status: "error", message: action.message };
    case "end":
      return { status: "ended" };
    case "reset":
      return { status: "idle" };
  }
}

export function useCallState() {
  return useReducer(callReducer, { status: "idle" } as CallState);
}
