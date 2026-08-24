import { describe, expect, it } from "vitest";

/**
 * The task-video link is rendered into ops surfaces and email, so an
 * unvalidated value here is a stored-XSS vector dressed as a helpful link.
 * Anything that is not a well-formed http(s) URL is dropped rather than
 * sanitised: a broken link is worth nothing, and a partially cleaned one is
 * worth less.
 *
 * This mirrors the implementation in `server/routes/inbound-request.ts`. It is
 * duplicated here rather than exported because the route module pulls in
 * Firebase at import time.
 */
function normalizeTaskVideoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

describe("normalizeTaskVideoUrl", () => {
  it("accepts ordinary sharing links", () => {
    expect(normalizeTaskVideoUrl("https://drive.google.com/file/d/abc/view")).toBe(
      "https://drive.google.com/file/d/abc/view",
    );
    expect(normalizeTaskVideoUrl("  http://example.com/clip.mp4  ")).toBe(
      "http://example.com/clip.mp4",
    );
  });

  it("drops every non-http scheme", () => {
    for (const hostile of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
    ]) {
      expect(normalizeTaskVideoUrl(hostile), hostile).toBeNull();
    }
  });

  it("drops anything that is not a URL at all", () => {
    expect(normalizeTaskVideoUrl("ask me on the call")).toBeNull();
    expect(normalizeTaskVideoUrl("")).toBeNull();
    expect(normalizeTaskVideoUrl("   ")).toBeNull();
    expect(normalizeTaskVideoUrl(null)).toBeNull();
    expect(normalizeTaskVideoUrl(undefined)).toBeNull();
    expect(normalizeTaskVideoUrl(42)).toBeNull();
    expect(normalizeTaskVideoUrl({ url: "https://example.com" })).toBeNull();
  });

  it("refuses an absurdly long value rather than storing it", () => {
    expect(normalizeTaskVideoUrl(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});
