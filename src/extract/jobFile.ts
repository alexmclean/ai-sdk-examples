import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { expandHome } from "../util/path.js";
import { extractJobPostingFromHtml, type JobPosting } from "./jobPosting.js";

export async function readJobPostingFromFile(
  path: string
): Promise<JobPosting> {
  const resolved = expandHome(path);
  const raw = await readFile(resolved, "utf8");
  const ext = extname(resolved).toLowerCase();

  if (ext === ".html" || ext === ".htm") {
    return extractJobPostingFromHtml(raw, `file://${resolved}`);
  }

  const text = raw.trim();
  if (!text) {
    throw new Error(`Job file is empty: ${resolved}`);
  }
  const title = firstNonEmptyLine(text) || basename(resolved, ext);
  return { url: `file://${resolved}`, title, text };
}

function firstNonEmptyLine(s: string): string {
  for (const line of s.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, 120);
  }
  return "";
}
