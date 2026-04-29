import "dotenv/config";
import { ZodError } from "zod";
import { getModel } from "./ai/client.js";
import { buildConfig, parseArgv } from "./config.js";
import { runPipeline } from "./pipeline.js";

const USAGE = `Usage: npm start -- --resume <path.pdf> (--job <url> | --job-file <path>) [options]

Options:
  --resume <path>     Path to resume PDF (required)
  --job <url>         Job posting URL
  --job-file <path>   Local file with the job posting (text, .md, or .html)
                      Use this when the posting is on a JS-rendered SPA
                      (Workday, LinkedIn, sometimes Ashby) — paste the
                      visible text into a file.
  --out <dir>         Output directory (default: ./output)
  --max <n>           Max iterations (default: 3)
  --quality <n>       Quality threshold 0-10 (default: 8)
  --ai <n>            Max AI-likelihood 0-10 (default: 4)
  --model <id>        Anthropic model id (default: claude-sonnet-4-6)
`;

async function main(): Promise<void> {
  const raw = parseArgv(process.argv.slice(2));
  if (!raw.resume || (!raw.job && !raw["job-file"])) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  const config = buildConfig(raw);
  const model = getModel(config.model);

  const { files, result, jobTitle } = await runPipeline(config, {
    model,
    log: (msg) => process.stdout.write(`[cover-letter] ${msg}\n`),
  });

  process.stdout.write(
    [
      "",
      `Job:     ${jobTitle}`,
      `Letter:  ${files.letterPath}`,
      `Eval:    ${files.evalPath}`,
      `Quality: ${result.evaluation.qualityScore}/10  ·  AI-likelihood: ${result.evaluation.aiLikelihoodScore}/10`,
      "",
    ].join("\n")
  );
}

main().catch((err: unknown) => {
  if (err instanceof ZodError) {
    process.stderr.write(`Invalid input:\n${err.message}\n`);
    process.exit(2);
  }
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
