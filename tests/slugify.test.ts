import { describe, expect, it } from "vitest";
import { slugify } from "../src/util/slugify.js";

describe("slugify", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugify("Senior Software Engineer")).toBe("senior-software-engineer");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Manager")).toBe("cafe-manager");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(slugify("Foo // Bar — Baz!!")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello world---")).toBe("hello-world");
  });

  it("truncates to maxLength without leaving a trailing dash", () => {
    const long = "a".repeat(40) + " " + "b".repeat(40);
    const out = slugify(long, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("-")).toBe(false);
  });

  it("falls back when input has no usable characters", () => {
    expect(slugify("***")).toBe("cover-letter");
    expect(slugify("")).toBe("cover-letter");
  });
});
