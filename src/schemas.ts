import { z } from "zod";

export const EvaluationSchema = z.object({
  qualityScore: z
    .number()
    .min(0)
    .max(10)
    .describe(
      "Overall quality of the cover letter from 0 (poor) to 10 (excellent)."
    ),
  aiLikelihoodScore: z
    .number()
    .min(0)
    .max(10)
    .describe(
      "How AI-generated the letter sounds, from 0 (clearly human) to 10 (obviously AI)."
    ),
  qualityNotes: z
    .string()
    .min(1)
    .describe("Short prose explaining the quality score."),
  aiLikelihoodNotes: z
    .string()
    .min(1)
    .describe("Short prose explaining the AI-likelihood score."),
  specificImprovements: z
    .array(z.string().min(1))
    .max(8)
    .describe("Concrete, actionable edits that would improve the letter."),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export const PipelineConfigSchema = z
  .object({
    resumePath: z.string().min(1),
    jobUrl: z.string().url().optional(),
    jobFilePath: z.string().min(1).optional(),
    outputDir: z.string().min(1).default("./output"),
    maxIterations: z.number().int().min(1).max(10).default(3),
    qualityThreshold: z.number().min(0).max(10).default(8),
    aiLikelihoodThreshold: z.number().min(0).max(10).default(3),
    model: z.string().min(1).default("claude-sonnet-4-6"),
  })
  .refine((cfg) => Boolean(cfg.jobUrl) || Boolean(cfg.jobFilePath), {
    message: "Either jobUrl or jobFilePath must be provided",
    path: ["jobUrl"],
  });

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type PipelineConfigInput = z.input<typeof PipelineConfigSchema>;

export const AttemptSchema = z.object({
  letter: z.string().min(1),
  evaluation: EvaluationSchema,
});

export type Attempt = z.infer<typeof AttemptSchema>;

export const GenerationResultSchema = z.object({
  letter: z.string().min(1),
  evaluation: EvaluationSchema,
  iterations: z.number().int().min(1),
  history: z.array(AttemptSchema).min(1),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;

export function combinedScore(evaluation: Evaluation): number {
  return evaluation.qualityScore - evaluation.aiLikelihoodScore;
}

export function meetsThresholds(
  evaluation: Evaluation,
  config: Pick<PipelineConfig, "qualityThreshold" | "aiLikelihoodThreshold">
): boolean {
  return (
    evaluation.qualityScore >= config.qualityThreshold &&
    evaluation.aiLikelihoodScore <= config.aiLikelihoodThreshold
  );
}
