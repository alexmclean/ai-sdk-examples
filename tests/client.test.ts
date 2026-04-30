import { describe, expect, it } from "vitest";
import { parseModelSpec } from "../src/ai/client.js";

describe("parseModelSpec", () => {
  it("parses an explicit anthropic prefix", () => {
    expect(parseModelSpec("anthropic:claude-sonnet-4-6")).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
  });

  it("parses an explicit openai prefix", () => {
    expect(parseModelSpec("openai:gpt-4o-mini")).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
    });
  });

  it("infers anthropic from a bare claude id", () => {
    expect(parseModelSpec("claude-sonnet-4-6")).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
  });

  it("infers openai from a bare gpt or o-series id", () => {
    expect(parseModelSpec("gpt-4o").provider).toBe("openai");
    expect(parseModelSpec("o3-mini").provider).toBe("openai");
    expect(parseModelSpec("o1-preview").provider).toBe("openai");
  });

  it("parses an explicit google prefix", () => {
    expect(parseModelSpec("google:gemini-2.5-pro")).toEqual({
      provider: "google",
      modelId: "gemini-2.5-pro",
    });
  });

  it("infers google from a bare gemini id", () => {
    expect(parseModelSpec("gemini-2.5-pro")).toEqual({
      provider: "google",
      modelId: "gemini-2.5-pro",
    });
  });

  it("trims whitespace", () => {
    expect(parseModelSpec("  openai:gpt-4o  ")).toEqual({
      provider: "openai",
      modelId: "gpt-4o",
    });
  });

  it("rejects an empty spec", () => {
    expect(() => parseModelSpec("")).toThrow(/empty/i);
    expect(() => parseModelSpec("   ")).toThrow(/empty/i);
  });

  it("rejects a known prefix with no model id", () => {
    expect(() => parseModelSpec("openai:")).toThrow(/no model id/i);
  });

  it("rejects an unsupported provider prefix", () => {
    expect(() => parseModelSpec("cohere:command-r")).toThrow(
      /unsupported provider/i
    );
  });

  it("rejects an ambiguous bare id with no prefix", () => {
    expect(() => parseModelSpec("llama-3-70b")).toThrow(/cannot infer/i);
  });
});
