# Cover Letter Generator

Generates a tailored cover letter from a resume PDF and a job posting URL, then self-evaluates it for quality and how AI-generated it sounds. Iterates up to N times to improve weak drafts. Built on the Vercel AI SDK + Anthropic Claude. Schemas enforced with Zod.

## Setup

```sh
npm install
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env
```

## Run

```sh
npm start -- --resume ./resume.pdf --job https://jobs.example.com/posting/123
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--resume` | required | Path to resume PDF |
| `--job` | required | URL of the job posting |
| `--out` | `./output` | Output directory |
| `--max` | `3` | Max iterations |
| `--quality` | `8` | Min quality score (0–10) to stop iterating |
| `--ai` | `4` | Max AI-likelihood score (0–10) to stop iterating |
| `--model` | `claude-sonnet-4-6` | Anthropic model id |

Outputs `<job-slug>-cover-letter.md` and `<job-slug>-eval.json` in the output directory.

## Tests

```sh
npm test
```

The test suite mocks the AI SDK — no API key or network access needed.
