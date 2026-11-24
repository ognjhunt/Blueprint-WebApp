// @vitest-environment node
/**
 * What a site reads of a deployment company's own words before Accept (2026-11-24, from a $0 stress test that found a
 * company's contact person and other staff named to the site: "Casey will bring the drawings", "Thanks, Casey",
 * "Mr. Hlington", "Dana Whitfield"). The company's form promises: "The site reads these words, with your company's name,
 * people's names and contact details taken out."
 *
 * The same defence in depth as a site's words (`server/utils/freeTextScreening.ts`): the deterministic pass (the
 * company's held identity, now with each word of its person's name, then any other name-shaped text), the model pass
 * over what it leaves (scripted here), and the deterministic pass again. Until the model pass has succeeded for the
 * exact text, the site reads none of it and is told the words are on their way.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { modelPassFails, modelPassFindsNothing, modelPassRemoves, resetFreeTextScreeningForTests } from "./helpers/freeTextScreening";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { siteReasonOf, knownCompanyIdentity, companyWordsForSite, projectSiteCompanyActivity, WORDS_PENDING } = await import("../utils/jobCompanies");
const { loadScreenings, screenText } = await import("../utils/freeTextScreening");
const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");

const JOB = "job-company-words";
const company = { company: "Stress H Robotics", name: "Casey Hlington", email: "casey@stress-h.example", website: "https://stress-h.example" };
const answer = (inputs: string, state = "interested") => ({ state, inputs, recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION,
  updatedAtIso: "2026-11-24T00:00:00.000Z", company: company.company, email: company.email });
const identity = knownCompanyIdentity(company, answer(""));
/** The whole path the site's page takes: deterministic, the model pass (run now, stored), deterministic again. */
async function forSite(words: string) {
  const input = siteReasonOf(answer(words), identity);
  if (input) await screenText(JOB, "company", input);
  return companyWordsForSite(answer(words), identity, await loadScreenings(JOB));
}
const leaksIn = (cases: Array<[string, string[]]>, read: (words: string) => string) => cases.flatMap(([typed, secrets]) => {
  const shown = read(typed);
  return secrets.filter(secret => shown.includes(secret)).map(secret => `${JSON.stringify(typed)} -> ${JSON.stringify(shown)} (kept ${secret})`);
});

beforeEach(() => {
  state.docs.clear();
  // The job the words belong to: each pass is held against its spending cap (`jobLaneSpend.ts`).
  state.docs.set(`inboundRequests/${JOB}`, { requestId: JOB });
  resetFreeTextScreeningForTests();
});

const CASES: Array<[string, string[]]> = [
  ["We do this daily. Ask for Casey Hlington.", ["Casey", "Hlington"]],
  ["We do this daily. Casey will bring the drawings.", ["Casey"]],
  ["Mr. Hlington leads our installs.", ["Hlington", "Mr."]],
  ["Thanks, Casey", ["Casey"]],
  ["Our lead engineer is Dana Whitfield; she will visit.", ["Dana", "Whitfield"]],
  ["Call 415 555 0101 or casey at stress-h dot example.", ["415 555 0101", "stress-h"]],
  ["Text 1-800-ROBOTIX or see stress-h.robotics for our cells.", ["ROBOTIX", "stress-h"]],
];

describe("what a site reads of a company's own words before Accept", () => {
  it("the deterministic pass takes out the company's people, not only its full contact name", () => {
    expect(leaksIn(CASES, words => siteReasonOf(answer(words), identity) ?? "(no reason shown)")).toEqual([]);
    // A first name that is also a word stays a word in lower case: only the capitalised name goes.
    const will = knownCompanyIdentity({ ...company, name: "Will Marsh" });
    expect(siteReasonOf(answer("We will visit. Will brings the drawings."), will)).toBe("We will visit. The company brings the drawings.");
  });

  it("with the model pass, a name in lower case goes too, and the patterns apply again after it", async () => {
    modelPassRemoves(["dana", "harbor robotics"]);
    expect(await forSite("We do this daily; ask for dana at harbor robotics.")).toBe("We do this daily; ask for [removed] at [removed].");
    modelPassFindsNothing();
    expect(await forSite("Casey will call 415 555 0101 to plan the cell.")).toBe("The company will call [removed] to plan the cell.");
  });

  it("fails closed: the site reads none of the words until the model pass has succeeded for them", async () => {
    modelPassFails();
    expect(await forSite("We do this daily and can start soon.")).toBe(WORDS_PENDING);
    const activity = () => projectSiteCompanyActivity({ aliases: { c: "A" }, sends: [], listed: true,
      approvedDeploymentCompanies: new Set(["c"]), companies: new Map([["c", company]]),
      responses: [{ id: "c", data: { ...answer("We do this daily and can start soon.", "declined") } }] });
    // Without results, nothing the pass must read is shown; the entry says the words are on their way.
    const pending = activity().entries[0] as Record<string, unknown>;
    expect(pending).toMatchObject({ kind: "answered", state: "declined", wordsPending: true });
    expect(pending).not.toHaveProperty("reason");
    // A later pass, once the failed one's wait is over (its stored row is gone here), succeeds.
    state.docs.clear();
    state.docs.set(`inboundRequests/${JOB}`, { requestId: JOB });
    modelPassFindsNothing();
    expect(await forSite("We do this daily and can start soon.")).toBe("We do this daily and can start soon.");
    const shown = projectSiteCompanyActivity({ aliases: { c: "A" }, sends: [], listed: true,
      approvedDeploymentCompanies: new Set(["c"]), companies: new Map([["c", company]]), screenings: await loadScreenings(JOB),
      responses: [{ id: "c", data: { ...answer("We do this daily and can start soon.", "declined") } }] }).entries[0] as Record<string, unknown>;
    expect(shown).toMatchObject({ reason: "We do this daily and can start soon." });
    expect(shown).not.toHaveProperty("wordsPending");
  });

  it("the question, what it verified and what a visit must confirm go the same way", async () => {
    modelPassRemoves(["dana"]);
    const data = { ...answer("Ask dana about the cell.", "interested"), details: { question: "Can dana visit Tuesday?",
      visitMustConfirm: "Floor load; Casey will bring the drawings, text 415-555-0101", verified: "dana checked reach" } };
    for (const inputs of [data.inputs, data.details.question, data.details.visitMustConfirm, data.details.verified]) {
      const input = siteReasonOf({ ...data, inputs }, identity);
      if (input) await screenText(JOB, "company", input);
    }
    const entry = projectSiteCompanyActivity({ aliases: { c: "A" }, sends: [], listed: true, approvedDeploymentCompanies: new Set(["c"]),
      companies: new Map([["c", company]]), screenings: await loadScreenings(JOB), responses: [{ id: "c", data }] }).entries[0];
    const text = JSON.stringify(entry);
    for (const secret of ["dana", "Casey", "415-555-0101", "Hlington"]) expect(text).not.toContain(secret);
    expect(entry).toMatchObject({ reason: "Ask [removed] about the cell.", question: { text: "Can [removed] visit Tuesday?" },
      details: { visitMustConfirm: "Floor load; The company will bring the drawings, text [removed]" } });
  });
});
