// @vitest-environment node
/**
 * The pure parts of the internal test company's page read (`server/utils/internalTestCompanyPage.ts`): the job summary's
 * link said in words even where the PDF draws it over several lines, the answer cut to what the Pipeline's signed call
 * reads, and the last pass that leaves out every field named for a token, a secret, a signature, an address or an email.
 * The route itself, end to end, is in `internal-test-company.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, storageAdmin: null, default: {} }));

const JOB_URL = "https://jobs.example.invalid/a-long-origin-for-this-test/jobs/itest-0123456789abcdef0123456789abcdef01234567";

describe("the internal test company's page read", () => {
  it("says the job's link in words, also where the PDF cut it over several lines, and every other address", async () => {
    const { summaryLinesWithoutLinks, SUMMARY_LINK_SAID, ADDRESS_SAID } = await import("../utils/internalTestCompanyPage");
    const cut = [JOB_URL.slice(0, 50), JOB_URL.slice(50)];
    expect(summaryLinesWithoutLinks(["The page opens for a signed-in, approved deployment company:", ...cut, "The job, in the site's words"],
      JOB_URL)).toEqual(["The page opens for a signed-in, approved deployment company:", SUMMARY_LINK_SAID, "The job, in the site's words"]);
    expect(summaryLinesWithoutLinks([JOB_URL], JOB_URL)).toEqual([SUMMARY_LINK_SAID]);
    // A line that only starts the link is not the link; it is still no address.
    expect(summaryLinesWithoutLinks([JOB_URL.slice(0, 30)], JOB_URL)).toEqual([ADDRESS_SAID]);
    expect(summaryLinesWithoutLinks(["See www.example.invalid/x or write to someone@example.invalid."], JOB_URL))
      .toEqual([`See ${ADDRESS_SAID} or write to ${ADDRESS_SAID}.`]);
  });

  it("cuts the summary's text at a line, and says so, when it would not fit", async () => {
    const { fittedSummaryText } = await import("../utils/internalTestCompanyPage");
    const lines = Array.from({ length: 200 }, (_, index) => `Line ${index} of the job summary, as the PDF draws it.`);
    expect(fittedSummaryText(lines.slice(0, 3), 10_000)).toEqual({ text: lines.slice(0, 3).join("\n"), truncated: false });
    const fitted = fittedSummaryText(lines, 2_000);
    expect(fitted.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(fitted.text))).toBeLessThanOrEqual(2_000);
    expect(fitted.text.startsWith("Line 0 of the job summary")).toBe(true);
    expect(fitted.text.endsWith("[cut here: the rest of the summary did not fit]")).toBe(true);
    expect(fittedSummaryText(lines, 10)).toEqual({ text: "", truncated: true });
  });

  it("leaves out every field named for a token, a secret, a signature, a password, a ticket, an address or an email", async () => {
    const { redacted, ADDRESS_SAID } = await import("../utils/internalTestCompanyPage");
    expect(redacted({ kept: "words", url: "https://x.invalid/a", viewerUrl: "/a", claimToken: "t", client_secret: "s",
      signature: "sig", password: "p", mediaTicket: "m", to_email: "a@b.invalid",
      rows: [{ label: "Size", value: "see https://x.invalid/b" }] }))
      .toEqual({ kept: "words", rows: [{ label: "Size", value: `see ${ADDRESS_SAID}` }] });
  });
});
