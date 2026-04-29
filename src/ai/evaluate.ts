import { generateObject, type LanguageModel } from "ai";
import { EvaluationSchema, type Evaluation } from "../schemas.js";

const SYSTEM_PROMPT = `You are a strict hiring manager and a detector of AI-generated writing. Evaluate cover letters honestly. Be willing to give low scores. Never inflate scores to be polite.

Quality dimensions to weigh: specificity to the role, evidence drawn from the resume, narrative arc, voice, concision (250-400 words preferred), absence of clichés.

AI-likelihood signals: generic openings, list-of-three rhythms, hedge words, absence of concrete details, perfectly parallel paragraphs, overuse of "not __ but __" phrasing, saying something is "real", vocabulary like "leverage", "passionate", "proven", "robust", "delve", use of dashes when parentheses or colons might be more appropriate, uniformly em-dashed clauses.`;

export interface EvaluateArgs {
  letter: string;
  jobPosting: string;
}

export async function evaluateLetter(
  model: LanguageModel,
  args: EvaluateArgs
): Promise<Evaluation> {
  const { object } = await generateObject({
    model,
    schema: EvaluationSchema,
    system: SYSTEM_PROMPT,
    prompt: [
      "Job posting:",
      args.jobPosting,
      "",
      "Cover letter to evaluate:",
      args.letter,
      "",
      "Score it on quality (0-10) and AI-likelihood (0-10), and list specific improvements.",
    ].join("\n"),
    temperature: 0.2,
  });
  return object;
}
