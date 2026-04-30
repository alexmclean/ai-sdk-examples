# Cover Letter Generator

Generates a tailored cover letter from a resume PDF and a job posting URL, then self-evaluates it for quality and how AI-generated it sounds. Iterates up to N times to improve weak drafts. Built on the Vercel AI SDK with Anthropic Claude, OpenAI GPT, and Google Gemini support — you can use one provider to write and a different one to evaluate, for a real second opinion. Schemas enforced with Zod.

## Setup

```sh
npm install
cp .env.example .env
# Add at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY (whichever providers you'll use).
```

## Run

```sh
npm start -- --resume ./resume.pdf --job https://jobs.example.com/posting/123
```

Cross-provider example — Claude writes, GPT grades:

```sh
npm start -- \
  --resume ./resume.pdf \
  --job https://jobs.example.com/posting/123 \
  --gen-model anthropic:claude-sonnet-4-6 \
  --eval-model openai:gpt-4o-mini
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--resume` | required | Path to resume PDF |
| `--job` | one of these | URL of the job posting |
| `--job-file` | one of these | Local file with the posting (text/md/html) — escape hatch for SPAs |
| `--out` | `./output` | Output directory |
| `--max` | `3` | Max iterations |
| `--quality` | `8` | Min quality score (0–10) to stop iterating |
| `--ai` | `3` | Max AI-likelihood score (0–10) to stop iterating |
| `--gen-model` | `anthropic:claude-sonnet-4-6` | Model that writes the letter |
| `--eval-model` | same as `--gen-model` | Model that grades the letter |
| `--model` | — | Convenience: sets both gen and eval models |

Model spec format: `<provider>:<model-id>`, e.g. `openai:gpt-4o-mini`, `anthropic:claude-sonnet-4-6`, or `google:gemini-2.5-pro`. Supported providers: `anthropic`, `openai`, `google`. Bare ids work too when the prefix is unambiguous (`claude-*`, `gpt-*`, `o1*`, `o3*`, `gemini-*`).

Outputs `<job-slug>-cover-letter.md` and `<job-slug>-eval.json` in the output directory.

## Tests

```sh
npm test
```

The test suite mocks the AI SDK — no API key or network access needed.
