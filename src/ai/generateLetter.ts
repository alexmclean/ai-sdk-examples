import { generateText, type LanguageModel } from "ai";
import type { Evaluation } from "../schemas.js";

const SYSTEM_PROMPT = `You are an experienced career coach who writes cover letters that sound like they were written by a thoughtful human candidate.

Hard rules:
- 250-400 words. One page. No headers, no bullet lists.
- Open with a specific, concrete hook tied to the company or role — never "I am writing to express my interest" or any variant.
- Reference at least two specific items from the resume that map directly to the job description.
- Use varied sentence rhythm. Mix short sentences with longer ones. Avoid tricolons ("X, Y, and Z") in every paragraph.
- Avoid these AI tells: "leverage", "passionate about", "proven track record", "demonstrated ability", "I am excited to", "robust", "synergy", "in today's fast-paced", "delve into", em-dashes used as stylistic flourishes, perfectly parallel structure across paragraphs.
- Sign-off: "Sincerely," then a placeholder line "[Your Name]".
- Output the letter only. No preamble, no commentary, no markdown fences.`;

export interface GenerateLetterArgs {
  resume: string;
  jobPosting: string;
  jobTitle: string;
  priorLetter?: string;
  feedback?: Evaluation;
}

export async function generateLetter(
  model: LanguageModel,
  args: GenerateLetterArgs
): Promise<string> {
  const prompt = args.priorLetter
    ? buildRevisePrompt(args)
    : buildInitialPrompt(args);

  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.8,
  });

  const cleaned = text.trim();
  if (!cleaned) {
    throw new Error("Model returned an empty cover letter");
  }
  return cleaned;
}

function buildInitialPrompt(args: GenerateLetterArgs): string {
  return [
    `Job title: ${args.jobTitle}`,
    "",
    "Job posting:",
    args.jobPosting,
    "",
    "Candidate resume:",
    args.resume,
    "",
    "Write the cover letter now.",
  ].join("\n");
}

function buildRevisePrompt(args: GenerateLetterArgs): string {
  const fb = args.feedback;
  const improvements =
    fb?.specificImprovements.length
      ? fb.specificImprovements.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "(no specific items)";
  return [
    `Job title: ${args.jobTitle}`,
    "",
    "Job posting:",
    args.jobPosting,
    "",
    "Candidate resume:",
    args.resume,
    "",
    "Previous draft:",
    args.priorLetter,
    "",
    "Reviewer feedback:",
    `Quality score: ${fb?.qualityScore ?? "n/a"}/10 — ${fb?.qualityNotes ?? ""}`,
    `AI-likelihood score: ${fb?.aiLikelihoodScore ?? "n/a"}/10 — ${fb?.aiLikelihoodNotes ?? ""}`,
    "",
    "Specific improvements requested:",
    improvements,
    "",
    "Rewrite the letter to address every point above. Do not introduce new AI-tells while fixing other issues. Output the revised letter only.",
  ].join("\n");
}
