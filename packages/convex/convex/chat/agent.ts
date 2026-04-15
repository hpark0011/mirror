"use node";

import { Agent } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { components } from "../_generated/api";

type Provider = "anthropic" | "openai" | "google";

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
};

function getLanguageModel() {
  const provider = (process.env.LLM_PROVIDER as Provider) || "anthropic";
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];

  switch (provider) {
    case "anthropic":
      return anthropic(model);
    case "openai":
      return openai(model);
    case "google":
      return google(model);
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
}

export const cloneAgent = new Agent(components.agent, {
  name: "clone",
  languageModel: getLanguageModel(),
  instructions: "",
});
