import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GenerationResult } from "../schemas.js";
import { slugify } from "../util/slugify.js";

export interface WriteOutputArgs {
  result: GenerationResult;
  outputDir: string;
  jobTitle: string;
  jobUrl: string;
}

export interface WrittenFiles {
  letterPath: string;
  evalPath: string;
}

export async function writeOutput(args: WriteOutputArgs): Promise<WrittenFiles> {
  await mkdir(args.outputDir, { recursive: true });
  const slug = slugify(args.jobTitle);
  const letterPath = join(args.outputDir, `${slug}-cover-letter.md`);
  const evalPath = join(args.outputDir, `${slug}-eval.json`);

  const letterDoc = [
    `# Cover Letter — ${args.jobTitle}`,
    "",
    `Source: ${args.jobUrl}`,
    `Iterations: ${args.result.iterations}`,
    `Quality: ${args.result.evaluation.qualityScore}/10 · AI-likelihood: ${args.result.evaluation.aiLikelihoodScore}/10`,
    "",
    "---",
    "",
    args.result.letter,
    "",
  ].join("\n");

  const evalDoc = JSON.stringify(
    {
      jobTitle: args.jobTitle,
      jobUrl: args.jobUrl,
      iterations: args.result.iterations,
      finalEvaluation: args.result.evaluation,
      history: args.result.history.map((attempt, i) => ({
        attempt: i + 1,
        evaluation: attempt.evaluation,
      })),
    },
    null,
    2
  );

  await Promise.all([
    writeFile(letterPath, letterDoc, "utf8"),
    writeFile(evalPath, evalDoc, "utf8"),
  ]);

  return { letterPath, evalPath };
}
