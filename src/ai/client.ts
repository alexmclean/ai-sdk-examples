import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ProviderId = "anthropic" | "openai";

export interface ParsedModelSpec {
  provider: ProviderId;
  modelId: string;
}

const SUPPORTED_PROVIDERS: readonly ProviderId[] = ["anthropic", "openai"];

// A model spec is "<provider>:<modelId>" (e.g. "openai:gpt-4o-mini").
// Bare ids are accepted for convenience: "claude-*" → anthropic, "gpt-*" /
// "o<digit>-*" → openai. Anything else without a prefix is rejected so
// typos fail fast instead of silently going to the default provider.
export function parseModelSpec(spec: string): ParsedModelSpec {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error("Model spec is empty");

  const colon = trimmed.indexOf(":");
  if (colon !== -1) {
    const providerRaw = trimmed.slice(0, colon).toLowerCase();
    const modelId = trimmed.slice(colon + 1).trim();
    if (!modelId) {
      throw new Error(`Model spec "${spec}" has no model id after the colon`);
    }
    if (!isSupportedProvider(providerRaw)) {
      throw new Error(
        `Unsupported provider "${providerRaw}". Use one of: ${SUPPORTED_PROVIDERS.join(", ")}.`
      );
    }
    return { provider: providerRaw, modelId };
  }

  if (/^claude/i.test(trimmed)) {
    return { provider: "anthropic", modelId: trimmed };
  }
  if (/^(gpt|o\d)/i.test(trimmed)) {
    return { provider: "openai", modelId: trimmed };
  }

  throw new Error(
    `Cannot infer provider for model id "${spec}". Prefix it explicitly, e.g. "anthropic:${spec}" or "openai:${spec}".`
  );
}

export function getModel(spec: string): LanguageModel {
  const { provider, modelId } = parseModelSpec(spec);
  if (provider === "anthropic") {
    requireEnv("ANTHROPIC_API_KEY");
    return anthropic(modelId);
  }
  if (provider === "openai") {
    requireEnv("OPENAI_API_KEY");
    return openai(modelId);
  }
  // Exhaustiveness — TS will complain here if a provider is added without a branch.
  const exhaustive: never = provider;
  throw new Error(`Unhandled provider: ${exhaustive}`);
}

function isSupportedProvider(value: string): value is ProviderId {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(
      `${name} is not set. Add it to .env or your environment.`
    );
  }
}
