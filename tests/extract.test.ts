import { describe, expect, it } from "vitest";
import {
  extractJobPostingFromHtml,
  fetchJobPosting,
} from "../src/extract/jobPosting.js";

const SAMPLE_HTML = `
<!doctype html>
<html>
  <head>
    <title>Senior TypeScript Engineer — ACME</title>
    <style>body { color: red }</style>
    <script>console.log('tracking');</script>
  </head>
  <body>
    <header>nav</header>
    <main>
      <h1>Senior TypeScript Engineer</h1>
      <p>We are looking for a thoughtful engineer who has shipped production TypeScript at scale.</p>
      <ul><li>5+ years experience</li><li>Loves tests</li></ul>
    </main>
    <noscript>enable javascript</noscript>
  </body>
</html>
`;

describe("extractJobPostingFromHtml", () => {
  it("pulls title and visible body text", () => {
    const posting = extractJobPostingFromHtml(
      SAMPLE_HTML,
      "https://example.com/job"
    );
    expect(posting.title).toBe("Senior TypeScript Engineer — ACME");
    expect(posting.text).toContain("thoughtful engineer");
    expect(posting.text).toContain("5+ years experience");
  });

  it("strips script and style content", () => {
    const posting = extractJobPostingFromHtml(SAMPLE_HTML, "https://x");
    expect(posting.text).not.toContain("console.log");
    expect(posting.text).not.toContain("color: red");
    expect(posting.text).not.toContain("enable javascript");
  });

  it("collapses whitespace", () => {
    const posting = extractJobPostingFromHtml(
      "<html><body><main>foo\n\n\n   bar\t\tbaz</main></body></html>",
      "https://x"
    );
    expect(posting.text).toBe("foo bar baz");
  });

  it("falls back to h1 when there is no <title>", () => {
    const html = "<html><body><main><h1>Hiring: PM</h1></main></body></html>";
    const posting = extractJobPostingFromHtml(html, "https://x");
    expect(posting.title).toBe("Hiring: PM");
  });

  it("throws when there's no readable text", () => {
    expect(() =>
      extractJobPostingFromHtml(
        "<html><body><script>x</script></body></html>",
        "https://x"
      )
    ).toThrow(/no readable text/);
  });

  it("falls back to __NEXT_DATA__ JSON when the body is empty (SPA case)", () => {
    const description =
      "We are hiring an Engineering Manager for our Context team. " +
      "You will lead a team building agentic search systems and partner closely with product. " +
      "Strong ML/infra background expected, with prior people-management experience required.";
    const nextData = {
      props: {
        pageProps: {
          posting: {
            title: "Engineering Manager, Context",
            descriptionHtml: `<p>${description}</p>`,
          },
        },
      },
    };
    const html = `
      <!doctype html><html><head><title>SPA</title></head>
      <body>
        <div id="root"></div>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
      </body></html>
    `;
    const posting = extractJobPostingFromHtml(html, "https://jobs.example.com/x");
    expect(posting.title).toBe("Engineering Manager, Context");
    expect(posting.text).toContain("agentic search");
    expect(posting.text).toContain("people-management");
  });

  it("falls back to JobPosting JSON-LD when the body is empty", () => {
    const description = "x".repeat(400);
    const ld = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Backend Engineer",
      description,
    };
    const html = `<html><head></head><body><script type="application/ld+json">${JSON.stringify(ld)}</script></body></html>`;
    const posting = extractJobPostingFromHtml(html, "https://x");
    expect(posting.title).toBe("Senior Backend Engineer");
    expect(posting.text.length).toBeGreaterThan(300);
  });
});

describe("fetchJobPosting", () => {
  it("uses the injected fetch and returns an extracted posting", async () => {
    const fakeFetch = (async () =>
      new Response(SAMPLE_HTML, {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const posting = await fetchJobPosting(
      "https://example.com/job",
      fakeFetch
    );
    expect(posting.title).toContain("Senior TypeScript Engineer");
    expect(posting.url).toBe("https://example.com/job");
  });

  it("throws on non-2xx responses", async () => {
    const fakeFetch = (async () =>
      new Response("nope", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(
      fetchJobPosting("https://example.com/missing", fakeFetch)
    ).rejects.toThrow(/404/);
  });
});
