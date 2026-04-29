import { PipelineConfigSchema, type PipelineConfig } from "./schemas.js";

export interface RawCliArgs {
  resume?: string;
  job?: string;
  "job-file"?: string;
  out?: string;
  max?: string;
  quality?: string;
  ai?: string;
  model?: string;
}

const KNOWN_KEYS = new Set<keyof RawCliArgs>([
  "resume",
  "job",
  "job-file",
  "out",
  "max",
  "quality",
  "ai",
  "model",
]);

export function parseArgv(argv: readonly string[]): RawCliArgs {
  const args: RawCliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token || !token.startsWith("--")) continue;
    const key = token.slice(2);
    if (!KNOWN_KEYS.has(key as keyof RawCliArgs)) {
      throw new Error(`Unknown flag --${key}`);
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key as keyof RawCliArgs] = next;
    i++;
  }
  return args;
}

export function buildConfig(
  raw: RawCliArgs,
  env: NodeJS.ProcessEnv = process.env
): PipelineConfig {
  const candidate = {
    resumePath: raw.resume,
    jobUrl: raw.job,
    jobFilePath: raw["job-file"],
    outputDir: raw.out,
    maxIterations: raw.max !== undefined ? Number(raw.max) : undefined,
    qualityThreshold:
      raw.quality !== undefined ? Number(raw.quality) : undefined,
    aiLikelihoodThreshold: raw.ai !== undefined ? Number(raw.ai) : undefined,
    model: raw.model ?? env.COVER_LETTER_MODEL ?? undefined,
  };
  return PipelineConfigSchema.parse(candidate);
}
