# Cover Letter Generator

CLI tool that generates a cover letter from a resume PDF + job posting, then iterates with a self-evaluation loop until quality thresholds are met. Built on the Vercel AI SDK (`ai` v5).

## Run

```
npm start -- --resume <pdf> (--job <url> | --job-file <path>) [--out <dir>] [--max <n>] [--quality <n>] [--ai <n>] [--gen-model <spec>] [--eval-model <spec>]
```

`npm run build` = `tsc --noEmit` (type-check only, no emit). `npm test` = vitest (mocked, no API keys needed).

## Layout

- `src/cli.ts` — entry point, arg parsing, top-level orchestration
- `src/pipeline.ts` — generate→evaluate→revise loop, stops at quality ≥ threshold and AI-likelihood ≤ threshold (defaults: 8 / 3)
- `src/config.ts` — Zod-validated CLI config
- `src/schemas.ts` — `Evaluation`, `PipelineConfig`, `GenerationResult` types
- `src/ai/client.ts` — **model factory: `parseModelSpec` + `getModel`** (the file to edit when adding providers)
- `src/ai/generateLetter.ts` — generation prompt
- `src/ai/evaluate.ts` — evaluation prompt (quality 0–10, AI-likelihood 0–10)
- `src/extract/{resume,jobPosting,jobFile}.ts` — PDF / URL / local-file extractors
- `src/io/writeOutput.ts` — writes `<slug>-cover-letter.md` + `<slug>-eval.json`
- `src/util/{path,slugify}.ts` — `~` expansion, filename slugs

## Model spec format

`getModel(spec)` accepts `"<provider>:<modelId>"` (e.g. `openai:gpt-4o-mini`, `anthropic:claude-sonnet-4-6`, `google:gemini-2.5-pro`) or bare ids matched by regex: `^claude` → anthropic, `^(gpt|o\d)` → openai, `^gemini` → google. Bare ids without a known prefix throw — typos fail fast. `SUPPORTED_PROVIDERS` and the `ProviderId` union both need to grow when a provider is added; the `getModel` switch has a `never` exhaustiveness check that will fail TS if a new provider isn't wired.

Default gen model: `anthropic:claude-sonnet-4-6`. Eval model defaults to gen model unless `--eval-model` is passed.

## Env

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and/or `GOOGLE_GENERATIVE_AI_API_KEY` (only the providers actually used are required). Loaded via `dotenv`.

## Notes

- ES modules, TS strict, `moduleResolution: "Bundler"`, target ES2022.
- `clay-job.txt` at the repo root is a sample job posting, not project source.
- Don't run `npm install` from the sandbox — hand the user the command.
