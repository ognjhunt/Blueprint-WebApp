/**
 * Stress round 2 (2026-11-24): lines from a model's reading of the site's video and sentence reached companies through
 * the identity pass alone. From the round's reproduction (`stress-r2-redaction.test.ts`, "packet facts"): a business
 * name and a person's name in a packet fact line, and the same in the reading's object name in a job's title. No model
 * is called; `NOTHING_SCREENED()` stands for "no model pass has succeeded", and a scripted pass for one that has.
 */
import { describe, expect, it } from "vitest";
import { applyRemovals, NOTHING_SCREENED, type Screenings } from "../utils/freeTextScreening";
import { companyJobHeadline, packetFactsForCompany } from "../utils/companyJobPage";

const known = { names: [], addresses: ["77 Quokka Lane, Springfield, IL 62704"], contacts: ["lead@quokka-plant.example"] };
/** A model pass that has read every text and takes out the given pieces. */
const modelPass = (pieces: string[]): Screenings => {
  const stateOf = (_writer: string, text: string) => ({ state: "shown" as const, text: applyRemovals(text, pieces) });
  return { missing: [], stateOf, shown: (writer, text) => stateOf(writer, text).text };
};

describe("lines from the video reading (packet facts) get every pass", () => {
  const facts = { schema_version: "website_packet_facts.v1" as const,
    object: [{ text: "Object: Harbor Fresh Foods produce crate.", answers: null },
      { text: "Goes to: Dana Whitfield's returns cart; centre (1.2, 0.4, 0.8) m.", answers: null }],
    measured: [], estimated: [], truncated: false };

  it("a business name and a person's name in a packet fact line do not reach the company", () => {
    const { packetFacts } = packetFactsForCompany(facts, null, known);
    const text = JSON.stringify(packetFacts);
    expect(text).not.toContain("Harbor Fresh");
    expect(text).not.toContain("Dana Whitfield");
  });

  it("nor once the model pass has read them, which judges every name the record does not hold", () => {
    // Since 2026-11-27 (owner) the model pass, not a capitalised-word rule, judges a name the record does not hold.
    const lower = { ...facts, object: [{ text: "Object: harbor fresh foods produce crate.", answers: null }, ...facts.object] };
    const read = packetFactsForCompany(lower, null, known, modelPass(["harbor fresh foods", "Dana Whitfield's"]));
    const text = JSON.stringify(read.packetFacts);
    expect(text).not.toMatch(/harbor fresh/i);
    expect(text).not.toContain("Dana Whitfield");
    expect(text).not.toContain("[removed]");
    expect(read.pending).toBe(false);
  });

  it("the same object name is dropped from the headline, as written in any case", () => {
    const record = { walkthrough_job_estimates: { job_estimates: { object: "Harbor Fresh Foods produce crate" } } };
    expect(companyJobHeadline(record, "Pick and place", "Pick and place", known)).not.toMatch(/harbor fresh/i);
    expect(companyJobHeadline(record, "Pick and place", "Pick and place", known, modelPass(["harbor"]))).not.toMatch(/harbor/i);
    const plain = { walkthrough_job_estimates: { job_estimates: { object: "produce crate" } } };
    // Not before the model pass has read it; then as written.
    expect(companyJobHeadline(plain, "Pick and place", "Pick and place", known, NOTHING_SCREENED())).not.toContain("produce crate");
    expect(companyJobHeadline(plain, "Pick and place", "Pick and place", known, modelPass([]))).toContain("produce crate");
  });
});
