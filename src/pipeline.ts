import type { LanguageModel } from "ai";
import { evaluateLetter } from "./ai/evaluate.js";
import { generateLetter } from "./ai/generateLetter.js";
import { readJobPostingFromFile } from "./extract/jobFile.js";
import { fetchJobPosting, type JobPosting } from "./extract/jobPosting.js";
import { extractResumeText } from "./extract/resume.js";
import { writeOutput, type WrittenFiles } from "./io/writeOutput.js";
import {
  combinedScore,
  meetsThresholds,
  type Attempt,
  type GenerationResult,
  type PipelineConfig,
} from "./schemas.js";

export interface PipelineDeps {
  model: LanguageModel;
  fetchImpl?: typeof fetch;
  extractResume?: (path: string) => Promise<string>;
  fetchPosting?: (url: string) => Promise<JobPosting>;
  readPostingFile?: (path: string) => Promise<JobPosting>;
  log?: (msg: string) => void;
}

export interface PipelineRunOutput {
  result: GenerationResult;
  files: WrittenFiles;
  jobTitle: string;
}

export async function runPipeline(
  config: PipelineConfig,
  deps: PipelineDeps
): Promise<PipelineRunOutput> {
  const log = deps.log ?? (() => {});
  const extractResume = deps.extractResume ?? extractResumeText;
  const fetchPosting =
    deps.fetchPosting ??
    ((url: string) => fetchJobPosting(url, deps.fetchImpl));
  const readPostingFile = deps.readPostingFile ?? readJobPostingFromFile;

  const postingPromise: Promise<JobPosting> = config.jobFilePath
    ? readPostingFile(config.jobFilePath)
    : fetchPosting(config.jobUrl!);

  log(
    config.jobFilePath
      ? `Extracting resume and reading job posting from file...`
      : `Extracting resume and fetching job posting...`
  );
  const [resume, posting] = await Promise.all([
    extractResume(config.resumePath),
    postingPromise,
  ]);

  const result = await iterateUntilGoodEnough({
    config,
    resume,
    posting,
    model: deps.model,
    log,
  });

  log(
    `Done after ${result.iterations} iteration(s). Quality ${result.evaluation.qualityScore}/10, AI-likelihood ${result.evaluation.aiLikelihoodScore}/10.`
  );

  const files = await writeOutput({
    result,
    outputDir: config.outputDir,
    jobTitle: posting.title,
    jobUrl: config.jobUrl ?? posting.url,
  });

  return { result, files, jobTitle: posting.title };
}

interface IterateArgs {
  config: PipelineConfig;
  resume: string;
  posting: JobPosting;
  model: LanguageModel;
  log: (msg: string) => void;
}

async function iterateUntilGoodEnough(
  args: IterateArgs
): Promise<GenerationResult> {
  const { config, resume, posting, model, log } = args;
  const history: Attempt[] = [];

  for (let i = 1; i <= config.maxIterations; i++) {
    const previous = history[history.length - 1];
    log(`Generating draft ${i}/${config.maxIterations}...`);
    const letter = await generateLetter(model, {
      resume,
      jobPosting: posting.text,
      jobTitle: posting.title,
      priorLetter: previous?.letter,
      feedback: previous?.evaluation,
    });

    log(`Evaluating draft ${i}...`);
    const evaluation = await evaluateLetter(model, {
      letter,
      jobPosting: posting.text,
    });

    history.push({ letter, evaluation });

    if (meetsThresholds(evaluation, config)) {
      log(`Draft ${i} meets thresholds — stopping early.`);
      break;
    } else {
      log(`Draft ${i} does not meet thresholds — continuing.  Scores were quality ${evaluation.qualityScore}/10 and AI-likelihood ${evaluation.aiLikelihoodScore}/10, with feedback pieces: ${evaluation.qualityNotes.length}`);
    }
  }

  const best = pickBest(history);
  return {
    letter: best.letter,
    evaluation: best.evaluation,
    iterations: history.length,
    history,
  };
}

function pickBest(history: readonly Attempt[]): Attempt {
  if (history.length === 0) {
    throw new Error("No attempts produced — cannot pick best draft");
  }
  let best = history[0]!;
  for (let i = 1; i < history.length; i++) {
    const candidate = history[i]!;
    if (combinedScore(candidate.evaluation) > combinedScore(best.evaluation)) {
      best = candidate;
    }
  }
  return best;
}
