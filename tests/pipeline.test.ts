import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import type { Evaluation, PipelineConfig } from "../src/schemas.js";

const generateLetterMock = vi.fn();
const evaluateLetterMock = vi.fn();

vi.mock("../src/ai/generateLetter.js", () => ({
  generateLetter: (...args: unknown[]) => generateLetterMock(...args),
}));
vi.mock("../src/ai/evaluate.js", () => ({
  evaluateLetter: (...args: unknown[]) => evaluateLetterMock(...args),
}));

const { runPipeline } = await import("../src/pipeline.js");

const fakeGenModel = { id: "gen" } as unknown as LanguageModel;
const fakeEvalModel = { id: "eval" } as unknown as LanguageModel;

function makeEval(quality: number, ai: number): Evaluation {
  return {
    qualityScore: quality,
    aiLikelihoodScore: ai,
    qualityNotes: `quality=${quality}`,
    aiLikelihoodNotes: `ai=${ai}`,
    specificImprovements: ["tighten the opener"],
  };
}

function baseConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    resumePath: "/tmp/resume.pdf",
    jobUrl: "https://example.com/job",
    outputDir: "./output",
    maxIterations: 3,
    qualityThreshold: 8,
    aiLikelihoodThreshold: 4,
    genModel: "anthropic:claude-sonnet-4-6",
    evalModel: "anthropic:claude-sonnet-4-6",
    ...overrides,
  };
}

let tempDir: string;
const fakePosting = {
  url: "https://example.com/job",
  title: "Senior Engineer",
  text: "We need a senior engineer",
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cover-letter-test-"));
  generateLetterMock.mockReset();
  evaluateLetterMock.mockReset();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("runPipeline", () => {
  it("returns after one pass when the first draft meets thresholds", async () => {
    generateLetterMock.mockResolvedValueOnce("Draft 1");
    evaluateLetterMock.mockResolvedValueOnce(makeEval(9, 2));

    const out = await runPipeline(baseConfig({ outputDir: tempDir }), {
      genModel: fakeGenModel,
      evalModel: fakeEvalModel,
      extractResume: async () => "resume text",
      fetchPosting: async () => fakePosting,
    });

    expect(out.result.iterations).toBe(1);
    expect(out.result.letter).toBe("Draft 1");
    expect(out.result.evaluation.qualityScore).toBe(9);
    expect(generateLetterMock).toHaveBeenCalledTimes(1);
    expect(evaluateLetterMock).toHaveBeenCalledTimes(1);
    // gen and eval models are routed correctly
    expect(generateLetterMock.mock.calls[0]?.[0]).toBe(fakeGenModel);
    expect(evaluateLetterMock.mock.calls[0]?.[0]).toBe(fakeEvalModel);
  });

  it("iterates and stops as soon as thresholds are met", async () => {
    generateLetterMock
      .mockResolvedValueOnce("Draft 1")
      .mockResolvedValueOnce("Draft 2");
    evaluateLetterMock
      .mockResolvedValueOnce(makeEval(6, 7))
      .mockResolvedValueOnce(makeEval(9, 3));

    const out = await runPipeline(
      baseConfig({ outputDir: tempDir, maxIterations: 5 }),
      {
        genModel: fakeGenModel,
        evalModel: fakeEvalModel,
        extractResume: async () => "resume",
        fetchPosting: async () => fakePosting,
      }
    );

    expect(out.result.iterations).toBe(2);
    expect(out.result.letter).toBe("Draft 2");
    expect(out.result.history).toHaveLength(2);
  });

  it("respects maxIterations and returns the best attempt by combined score", async () => {
    generateLetterMock
      .mockResolvedValueOnce("D1")
      .mockResolvedValueOnce("D2")
      .mockResolvedValueOnce("D3");
    evaluateLetterMock
      .mockResolvedValueOnce(makeEval(4, 6)) // -2
      .mockResolvedValueOnce(makeEval(7, 5)) // 2 (best)
      .mockResolvedValueOnce(makeEval(6, 6)); // 0

    const out = await runPipeline(
      baseConfig({ outputDir: tempDir, maxIterations: 3 }),
      {
        genModel: fakeGenModel,
        evalModel: fakeEvalModel,
        extractResume: async () => "resume",
        fetchPosting: async () => fakePosting,
      }
    );

    expect(generateLetterMock).toHaveBeenCalledTimes(3);
    expect(out.result.iterations).toBe(3);
    expect(out.result.letter).toBe("D2");
    expect(out.result.evaluation.qualityScore).toBe(7);
  });

  it("passes prior letter and feedback to revise prompts", async () => {
    generateLetterMock
      .mockResolvedValueOnce("D1")
      .mockResolvedValueOnce("D2");
    evaluateLetterMock
      .mockResolvedValueOnce(makeEval(5, 6))
      .mockResolvedValueOnce(makeEval(9, 2));

    await runPipeline(baseConfig({ outputDir: tempDir }), {
      genModel: fakeGenModel,
      evalModel: fakeEvalModel,
      extractResume: async () => "resume",
      fetchPosting: async () => fakePosting,
    });

    const firstCallArgs = generateLetterMock.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    const secondCallArgs = generateLetterMock.mock.calls[1]?.[1] as Record<
      string,
      unknown
    >;
    expect(firstCallArgs.priorLetter).toBeUndefined();
    expect(firstCallArgs.feedback).toBeUndefined();
    expect(secondCallArgs.priorLetter).toBe("D1");
    expect((secondCallArgs.feedback as Evaluation).qualityScore).toBe(5);
  });

  it("writes the final letter and an eval JSON to the output directory", async () => {
    generateLetterMock.mockResolvedValueOnce("Draft text");
    evaluateLetterMock.mockResolvedValueOnce(makeEval(9, 2));

    const out = await runPipeline(baseConfig({ outputDir: tempDir }), {
      genModel: fakeGenModel,
      evalModel: fakeEvalModel,
      extractResume: async () => "resume",
      fetchPosting: async () => fakePosting,
    });

    const letter = readFileSync(out.files.letterPath, "utf8");
    const evalJson = JSON.parse(readFileSync(out.files.evalPath, "utf8"));
    expect(letter).toContain("Draft text");
    expect(letter).toContain("Senior Engineer");
    expect(evalJson.finalEvaluation.qualityScore).toBe(9);
    expect(evalJson.history).toHaveLength(1);
  });

  it("runs resume extraction and posting fetch in parallel", async () => {
    const order: string[] = [];
    generateLetterMock.mockResolvedValueOnce("D1");
    evaluateLetterMock.mockResolvedValueOnce(makeEval(9, 2));

    await runPipeline(baseConfig({ outputDir: tempDir }), {
      genModel: fakeGenModel,
      evalModel: fakeEvalModel,
      extractResume: async () => {
        order.push("resume:start");
        await new Promise((r) => setTimeout(r, 20));
        order.push("resume:end");
        return "r";
      },
      fetchPosting: async () => {
        order.push("posting:start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("posting:end");
        return fakePosting;
      },
    });

    expect(order.indexOf("posting:start")).toBeLessThan(
      order.indexOf("resume:end")
    );
  });
});
