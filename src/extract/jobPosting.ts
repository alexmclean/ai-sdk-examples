import { parse, type HTMLElement } from "node-html-parser";

export interface JobPosting {
  url: string;
  title: string;
  text: string;
}

const MIN_USEFUL_TEXT_LENGTH = 300;

export async function fetchJobPosting(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<JobPosting> {
  const response = await fetchImpl(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; CoverLetterBot/1.0; +https://example.com/bot)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch job posting (${response.status} ${response.statusText})`
    );
  }
  const html = await response.text();
  return extractJobPostingFromHtml(html, url);
}

export function extractJobPostingFromHtml(
  html: string,
  url: string
): JobPosting {
  const root = parse(html);

  const fromNextData = extractFromNextData(root);
  if (fromNextData && fromNextData.text.length >= MIN_USEFUL_TEXT_LENGTH) {
    return { url, ...fromNextData };
  }

  const fromJsonLd = extractFromJsonLd(root);
  if (fromJsonLd && fromJsonLd.text.length >= MIN_USEFUL_TEXT_LENGTH) {
    return { url, ...fromJsonLd };
  }

  const fromBody = extractFromVisibleBody(root);
  if (fromBody && fromBody.text.length >= MIN_USEFUL_TEXT_LENGTH) {
    return { url, ...fromBody };
  }

  // Last-resort: take whatever we found, even if short.
  const best = fromNextData ?? fromJsonLd ?? fromBody;
  if (best && best.text) {
    return { url, ...best };
  }

  throw new Error(
    "Job posting page contained no readable text. The page is likely a JS-rendered SPA — try saving the posting to a file and passing --job-file <path>."
  );
}

interface PartialPosting {
  title: string;
  text: string;
}

function extractFromNextData(root: HTMLElement): PartialPosting | null {
  const script = root.querySelector('script#__NEXT_DATA__');
  if (!script) return null;
  let data: unknown;
  try {
    data = JSON.parse(script.text);
  } catch {
    return null;
  }
  const collected = collectStringsFromJobJson(data);
  if (!collected.text) return null;
  return {
    title: collected.title || pageTitle(root) || "Job Posting",
    text: collected.text,
  };
}

function extractFromJsonLd(root: HTMLElement): PartialPosting | null {
  const blocks = root.querySelectorAll('script[type="application/ld+json"]');
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      if (!isRecord(candidate)) continue;
      const type = candidate["@type"];
      if (type !== "JobPosting") continue;
      const title =
        toStringOrEmpty(candidate.title) || pageTitle(root) || "Job Posting";
      const description = toStringOrEmpty(
        candidate.description ?? candidate.responsibilities
      );
      if (description) {
        return { title, text: stripHtml(description) };
      }
    }
  }
  return null;
}

function extractFromVisibleBody(root: HTMLElement): PartialPosting {
  // Capture title before stripping <title> alongside other head tags.
  const title = pageTitle(root) ?? "Job Posting";
  for (const tag of ["script", "style", "noscript", "svg"]) {
    for (const el of root.querySelectorAll(tag)) el.remove();
  }
  const main =
    pickFirst(root, ["main", "article", "[role=main]", "#content", "body"]) ??
    root;
  return { title, text: collapseWhitespace(main.text) };
}

interface Collected {
  title: string;
  text: string;
}

// Walk an arbitrary JSON tree from a Next.js data blob and collect strings
// that look like job content. Different ATSes (Ashby, Greenhouse-Next, etc.)
// nest the posting differently, so we look for known field names.
function collectStringsFromJobJson(data: unknown): Collected {
  const titleKeys = new Set(["title", "jobTitle", "name"]);
  const bodyKeys = new Set([
    "description",
    "descriptionHtml",
    "descriptionPlain",
    "descriptionParts",
    "content",
    "jobDescription",
    "responsibilities",
    "requirements",
  ]);

  let title = "";
  const textChunks: string[] = [];

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!title && titleKeys.has(key) && typeof value === "string") {
        title = value;
      }
      if (bodyKeys.has(key)) {
        const text = stringifyContent(value);
        if (text) textChunks.push(text);
      }
      visit(value);
    }
  };

  visit(data);
  const text = collapseWhitespace(stripHtml(textChunks.join("\n\n")));
  return { title, text };
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => stringifyContent(v)).filter(Boolean).join("\n");
  }
  if (isRecord(value)) {
    // Some ATSes shape descriptionParts as { text, type } blocks.
    if (typeof value.text === "string") return value.text;
    if (typeof value.html === "string") return value.html;
  }
  return "";
}

function stripHtml(s: string): string {
  if (!s.includes("<")) return s;
  return parse(s).text;
}

function pageTitle(root: HTMLElement): string | null {
  return (
    root.querySelector("title")?.text?.trim() ||
    root.querySelector("h1")?.text?.trim() ||
    null
  );
}

function pickFirst(
  root: HTMLElement,
  selectors: string[]
): HTMLElement | null {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStringOrEmpty(v: unknown): string {
  return typeof v === "string" ? v : "";
}
