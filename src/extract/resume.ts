import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { expandHome } from "../util/path.js";

export async function extractResumeText(path: string): Promise<string> {
  const resolved = expandHome(path);
  const ext = extname(resolved).toLowerCase();
  if (ext !== ".pdf") {
    const hint = resolved.includes(" ")
      ? ""
      : ' If your path contains spaces, wrap it in quotes — e.g. --resume "/path/with spaces/resume.pdf".';
    throw new Error(
      `Resume must be a .pdf file (got "${ext || "no extension"}" from path "${resolved}").${hint}`
    );
  }
  const buffer = await readFile(resolved);
  return extractTextFromPdfBuffer(buffer);
}

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  // pdf-parse is CommonJS; dynamic import keeps it ESM-friendly.
  const mod = (await import("pdf-parse")) as unknown as {
    default: (b: Buffer) => Promise<{ text: string }>;
  };
  const result = await mod.default(buffer);
  const text = result.text.trim();
  if (!text) {
    throw new Error("Resume PDF contained no extractable text");
  }
  return text;
}
