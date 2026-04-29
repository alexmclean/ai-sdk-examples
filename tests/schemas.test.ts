import { describe, expect, it } from "vitest";
import {
  EvaluationSchema,
  PipelineConfigSchema,
  combinedScore,
  meetsThresholds,
} from "../src/schemas.js";

describe("EvaluationSchema", () => {
  it("accepts a well-formed evaluation", () => {
    const result = EvaluationSchema.parse({
      qualityScore: 7,
      aiLikelihoodScore: 3,
      qualityNotes: "Solid hook, good resume callbacks.",
      aiLikelihoodNotes: "Sentences vary in length.",
      specificImprovements: ["Tighten paragraph 2"],
    });
    expect(result.qualityScore).toBe(7);
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      EvaluationSchema.parse({
        qualityScore: 11,
        aiLikelihoodScore: 3,
        qualityNotes: "x",
        aiLikelihoodNotes: "y",
        specificImprovements: [],
      })
    ).toThrow();
    expect(() =>
      EvaluationSchema.parse({
        qualityScore: 5,
        aiLikelihoodScore: -1,
        qualityNotes: "x",
        aiLikelihoodNotes: "y",
        specificImprovements: [],
      })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      EvaluationSchema.parse({
        qualityScore: 5,
        aiLikelihoodScore: 5,
      })
    ).toThrow();
  });
});

describe("PipelineConfigSchema", () => {
  it("applies defaults", () => {
    const cfg = PipelineConfigSchema.parse({
      resumePath: "/tmp/r.pdf",
      jobUrl: "https://example.com/job",
    });
    expect(cfg.outputDir).toBe("./output");
    expect(cfg.maxIterations).toBe(3);
    expect(cfg.qualityThreshold).toBe(8);
    expect(cfg.aiLikelihoodThreshold).toBe(3);
    expect(cfg.model).toBe("claude-sonnet-4-6");
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      PipelineConfigSchema.parse({
        resumePath: "/tmp/r.pdf",
        jobUrl: "not a url",
      })
    ).toThrow();
  });

  it("rejects maxIterations out of range", () => {
    expect(() =>
      PipelineConfigSchema.parse({
        resumePath: "/tmp/r.pdf",
        jobUrl: "https://example.com",
        maxIterations: 0,
      })
    ).toThrow();
  });

  it("accepts jobFilePath as an alternative to jobUrl", () => {
    const cfg = PipelineConfigSchema.parse({
      resumePath: "/tmp/r.pdf",
      jobFilePath: "/tmp/job.txt",
    });
    expect(cfg.jobFilePath).toBe("/tmp/job.txt");
    expect(cfg.jobUrl).toBeUndefined();
  });

  it("requires either jobUrl or jobFilePath", () => {
    expect(() =>
      PipelineConfigSchema.parse({
        resumePath: "/tmp/r.pdf",
      })
    ).toThrow(/jobUrl or jobFilePath/);
  });
});

describe("score helpers", () => {
  const evalAt = (q: number, ai: number) => ({
    qualityScore: q,
    aiLikelihoodScore: ai,
    qualityNotes: "n",
    aiLikelihoodNotes: "n",
    specificImprovements: [],
  });

  it("combinedScore rewards quality and penalizes AI-likelihood", () => {
    expect(combinedScore(evalAt(9, 2))).toBe(7);
    expect(combinedScore(evalAt(5, 5))).toBe(0);
    expect(combinedScore(evalAt(3, 8))).toBe(-5);
  });

  it("meetsThresholds requires both quality and AI-likelihood", () => {
    const cfg = { qualityThreshold: 8, aiLikelihoodThreshold: 4 };
    expect(meetsThresholds(evalAt(8, 4), cfg)).toBe(true);
    expect(meetsThresholds(evalAt(8, 5), cfg)).toBe(false);
    expect(meetsThresholds(evalAt(7, 4), cfg)).toBe(false);
    expect(meetsThresholds(evalAt(10, 0), cfg)).toBe(true);
  });
});
