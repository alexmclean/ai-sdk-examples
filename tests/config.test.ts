import { describe, expect, it } from "vitest";
import { buildConfig, parseArgv } from "../src/config.js";

describe("parseArgv", () => {
  it("parses --key value pairs", () => {
    const parsed = parseArgv([
      "--resume",
      "/tmp/r.pdf",
      "--job",
      "https://example.com/j",
      "--max",
      "5",
    ]);
    expect(parsed).toEqual({
      resume: "/tmp/r.pdf",
      job: "https://example.com/j",
      max: "5",
    });
  });

  it("throws when a flag is missing its value", () => {
    expect(() => parseArgv(["--resume"])).toThrow(/Missing value/);
    expect(() => parseArgv(["--resume", "--job"])).toThrow(/Missing value/);
  });

  it("ignores tokens that are not --flags", () => {
    expect(parseArgv(["positional", "--job", "https://x"])).toEqual({
      job: "https://x",
    });
  });
});

describe("buildConfig", () => {
  it("turns argv into a validated PipelineConfig with defaults", () => {
    const cfg = buildConfig(
      { resume: "/tmp/r.pdf", job: "https://example.com/j" },
      {}
    );
    expect(cfg.resumePath).toBe("/tmp/r.pdf");
    expect(cfg.jobUrl).toBe("https://example.com/j");
    expect(cfg.maxIterations).toBe(3);
    expect(cfg.qualityThreshold).toBe(8);
    expect(cfg.aiLikelihoodThreshold).toBe(3);
  });

  it("coerces numeric flags from strings", () => {
    const cfg = buildConfig(
      {
        resume: "/tmp/r.pdf",
        job: "https://example.com/j",
        max: "5",
        quality: "9.5",
        ai: "2",
      },
      {}
    );
    expect(cfg.maxIterations).toBe(5);
    expect(cfg.qualityThreshold).toBe(9.5);
    expect(cfg.aiLikelihoodThreshold).toBe(2);
  });

  it("falls back to env COVER_LETTER_MODEL when --model not set", () => {
    const cfg = buildConfig(
      { resume: "/tmp/r.pdf", job: "https://example.com/j" },
      { COVER_LETTER_MODEL: "anthropic:claude-opus-4-7" }
    );
    expect(cfg.genModel).toBe("anthropic:claude-opus-4-7");
    expect(cfg.evalModel).toBe("anthropic:claude-opus-4-7");
  });

  it("--model sets both gen and eval models", () => {
    const cfg = buildConfig(
      {
        resume: "/tmp/r.pdf",
        job: "https://example.com/j",
        model: "openai:gpt-4o-mini",
      },
      {}
    );
    expect(cfg.genModel).toBe("openai:gpt-4o-mini");
    expect(cfg.evalModel).toBe("openai:gpt-4o-mini");
  });

  it("--gen-model and --eval-model can target different providers", () => {
    const cfg = buildConfig(
      {
        resume: "/tmp/r.pdf",
        job: "https://example.com/j",
        "gen-model": "anthropic:claude-sonnet-4-6",
        "eval-model": "openai:gpt-4o-mini",
      },
      {}
    );
    expect(cfg.genModel).toBe("anthropic:claude-sonnet-4-6");
    expect(cfg.evalModel).toBe("openai:gpt-4o-mini");
  });

  it("specific model flags override --model", () => {
    const cfg = buildConfig(
      {
        resume: "/tmp/r.pdf",
        job: "https://example.com/j",
        model: "anthropic:claude-sonnet-4-6",
        "eval-model": "openai:gpt-4o-mini",
      },
      {}
    );
    expect(cfg.genModel).toBe("anthropic:claude-sonnet-4-6");
    expect(cfg.evalModel).toBe("openai:gpt-4o-mini");
  });

  it("rejects an invalid url via Zod", () => {
    expect(() =>
      buildConfig({ resume: "/tmp/r.pdf", job: "not-a-url" }, {})
    ).toThrow();
  });
});
