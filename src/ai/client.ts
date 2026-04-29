import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export function getModel(modelId: string): LanguageModel {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env or your environment."
    );
  }
  return anthropic(modelId);
}
