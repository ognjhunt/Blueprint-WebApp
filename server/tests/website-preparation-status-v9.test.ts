// @vitest-environment node
/**
 * Status v9: v8 with what a deployment company reads about the job's object (the Pipeline's `website_packet_facts.v1`).
 * The by-hand job packet export is retired (2026-11-19): its object, height and uncertainty lines and Blueprint's
 * estimates of what the site did not say reach the company's job page this way, each line cleaned of contact details
 * and street addresses, and an estimate of something the site answered is left out for the site's own answer.
 */
import { describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/unknownPipelineCode", () => ({ noteUnknownPipelineCode: vi.fn(async () => undefined),
  noteUnknownPipelineCodes: vi.fn(async () => undefined) }));

const status = await import("../utils/websitePreparationStatus");
const { packetFactsForCompany } = await import("../utils/companyJobPage");
const { applyRemovals, NOTHING_SCREENED } = await import("../utils/freeTextScreening");
type Screenings = import("../utils/freeTextScreening").Screenings;
/** A model pass that has read every text and takes out the given pieces (none: it finds nothing), and what it read. */
function modelPass(pieces: string[] = []): Screenings & { read: string[] } {
  const read: string[] = [];
  const stateOf = (_writer: string, text: string) => { read.push(text); return { state: "shown" as const, text: applyRemovals(text, pieces) }; };
  return { read, missing: [], stateOf, shown: (writer, text) => stateOf(writer, text).text };
}
type Selector = import("../utils/websitePreparationStatus").WebsitePreparationSelector;
type Stored = import("../utils/websitePreparationStatus").StoredWebsitePreparation;
type Deps = import("../utils/websitePreparationStatus").WebsitePreparationDeps;

const selector: Selector = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
  completion_marker_generation: "90071992547409931", producer_delivery_key: `sha256:${"a".repeat(64)}`,
  source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"c".repeat(64)}` };
const sealed = (value: Record<string, unknown>) => ({ ...value, status_digest: crossRuntimeArtifactDigest(value, "status_digest") });
function base(version: "v8" | "v9", revision = 3) {
  return { ...selector, schema_version: `website_preparation_status.${version}`, state: "handed_off", code: "preparation_handed_off",
    attempt_count: 1, revision, correlation_id: crossRuntimeDigest({ selector, revision }), terminal_reason: null,
    outcome: null, question: null, robot_fit_precheck: null, robot_fit: null };
}
const line = (text: string, answers: string | null = null) => ({ text, answers });
/** As the Pipeline writes them for test job 4 (a table lamp to a glass wall shelf). */
const facts = (change: Record<string, unknown> = {}) => ({ schema_version: "website_packet_facts.v1",
  object: [line("Object: table lamp."),
    line("Sizes that matter for holding it, from the video: 37 cm across the narrower side of its footprint, 40 cm across the wider, 67 cm tall."),
    line("Longest side: about 67 cm (Blueprint's estimate; the site did not say).", "item_size_longest_side"),
    line("Starts: the middle of its base at (0.277, -0.182, 0.539) m, about 54 cm above the floor (40 cm to 72 cm across the scale band)."),
    line("Goes to: glass wall shelf; centre (0.470, -1.211, 1.308) m; about 131 cm above the floor (98 cm to 174 cm across the scale band).")],
  measured: [line("How closely the video's geometry and the reconstruction line up around the task (registration residual, trimmed RMS): 8 cm, in the scene's estimated metres.")],
  estimated: [line("Scale: set by the 3D reconstruction's own estimate, not measured at the site. Sizes, heights and distances may be 0.75 to 1.33 times those given here (the scale band)."),
    line("Weight: about 3.1 kg (0.34 to 28 kg). An estimate, not weighed.", "item_weight"),
    line("How many an hour: 1 to 4 (Blueprint's estimate; the site did not say).", "items_per_hour"),
    line("How many days a week it runs: 5 to 7 (Blueprint's estimate; the site did not say).")],
  truncated: false, ...change });
const v8 = () => sealed({ ...base("v8") });
const v9 = (packet: unknown = facts()) => sealed({ ...base("v9"), packet_facts: packet });
const parses = (value: unknown) => status.websitePreparationReceiptSchema.safeParse(value).success;

function harness() {
  let stored: Stored | null = null;
  let canonical: unknown = v8();
  const deps: Deps = {
    async readLedger() { return canonical; },
    async verifyCurrent() { return { fingerprint: "f", owner: "o" }; },
    async readStored() { return stored; },
    async commit(input, receipt) { stored = status.mergeWebsitePreparationStatus(stored, input, receipt); },
    async pending() { return []; }, async acknowledge() {}, async findEvent() { return null; },
  };
  return { deps, get stored() { return stored; }, ledger(value: unknown) { canonical = value; } };
}
const nobody = { names: [], addresses: [], contacts: [] };

describe("status v9", () => {
  it("asks for 9 and reads up to 16 KiB", () => {
    expect(status.WEBSITE_PREPARATION_STATUS_VERSION).toBe("9");
    expect(status.WEBSITE_PREPARATION_STATUS_MAX_BYTES).toBe(16_384);
  });

  it("parses v9 with or without packet facts, and refuses a key or a question the contract does not name", () => {
    expect(parses(v9())).toBe(true);
    expect(parses(v9(null))).toBe(true);
    expect(parses(v9(facts({ extra: 1 })))).toBe(false);
    expect(parses(v9(facts({ object: [{ text: "Object: lamp.", answers: "wanted_by" }] })))).toBe(false);
    expect(parses(v9(facts({ object: [{ text: "", answers: null }] })))).toBe(false);
    expect(parses({ ...v8(), packet_facts: facts() })).toBe(false);
  });

  it("stores v9, keeps reading a v8 answer, and gives the packet facts only from a v9 row", async () => {
    const h = harness();
    await status.syncWebsitePreparationStatus(selector, h.deps);
    expect(status.storedPacketFacts(h.stored)).toBeNull();
    h.ledger(v9());
    expect((await status.syncWebsitePreparationStatus(selector, h.deps)).schema_version).toBe("website_preparation_status.v9");
    expect(status.storedPacketFacts(h.stored)?.object[0]).toEqual(line("Object: table lamp."));
    expect(status.storedPacketFacts({ selector, status: { ...v9(), packet_facts: { bogus: true } }, notification: null })).toBeNull();
  });
});

describe("the packet facts as a company reads them", () => {
  it("shows Blueprint's estimates where the site did not answer, and names the questions they answer", () => {
    const page = packetFactsForCompany(status.packetFactsSchema.parse(facts()), null, nobody, modelPass());
    expect(page.packetFacts!.object).toContain("Longest side: about 67 cm (Blueprint's estimate; the site did not say).");
    expect(page.packetFacts!.estimated).toContain("Weight: about 3.1 kg (0.34 to 28 kg). An estimate, not weighed.");
    // Every figure line passes the contact scan unchanged: coordinates and ranges are not phone numbers.
    expect(page.packetFacts!.object).toEqual(facts().object.map(row => row.text));
    expect(page.estimated.sort()).toEqual(["perHour", "size", "weight"]);
  });

  it("leaves out Blueprint's estimate of what the site answered, but not of what it was not sure of", () => {
    const answers = { weight: "5_15kg", size: "unsure", perHour: "60_300", hours: "two_shifts", updatedAtIso: "2026-11-19T10:00:00.000Z" } as const;
    const page = packetFactsForCompany(status.packetFactsSchema.parse(facts()), answers, nobody, modelPass());
    const all = [...page.packetFacts!.object, ...page.packetFacts!.estimated];
    expect(all.some(text => text.startsWith("Weight:"))).toBe(false);
    expect(all.some(text => text.startsWith("How many an hour"))).toBe(false);
    expect(all).toContain("Longest side: about 67 cm (Blueprint's estimate; the site did not say).");
    expect(all).toContain("How many days a week it runs: 5 to 7 (Blueprint's estimate; the site did not say).");
    // Only the size: the site was not sure of it, so Blueprint's estimate is still shown and the fit summary points to it.
    expect(page.estimated).toEqual(["size"]);
  });

  it("leaves out whole any line with the site's identity, a street address or a contact detail in it", () => {
    const planted = facts({ object: [line("Object: Zorblax Provisions carton."),
      line("Goes to: the shelf at 4417 Marrowbone Avenue, Suite 12, Glimmerton, OR 97035; about 131 cm above the floor."),
      line("Starts: by the sign reading call 628 555 0199 or zorblax@plant.example."),
      line("Starts: about 54 cm above the floor.")] });
    const known = { names: ["Zorblax Provisions"], organisations: ["Zorblax Provisions"], addresses: [], contacts: [] };
    const page = packetFactsForCompany(status.packetFactsSchema.parse(planted), null, known, modelPass());
    const text = JSON.stringify(page);
    for (const value of ["Zorblax", "Marrowbone", "Glimmerton", "97035", "555 0199", "@plant", "131 cm", "[removed]", "The site carton"])
      expect(text).not.toContain(value);
    expect(page.packetFacts!.object).toEqual(["Starts: about 54 cm above the floor."]);
  });

  it("leaves out a line with a name the record does not hold, and one the model pass takes a piece out of", () => {
    const planted = facts({ object: [line("Object: produce crate."), line("Goes to: Dana Whitfield's returns cart."),
      line("Starts: on the harbor fresh foods pallet."), line("Starts: about 54 cm above the floor.")], measured: [], estimated: [] });
    const pass = modelPass(["harbor fresh foods"]);
    const page = packetFactsForCompany(status.packetFactsSchema.parse(planted), null, nobody, pass);
    expect(page.packetFacts).toEqual({ object: ["Object: produce crate.", "Starts: about 54 cm above the floor."], measured: [], estimated: [] });
    // One pass for the whole set, without the line the name pass already left out.
    expect(pass.read).toEqual(["Object: produce crate.\nStarts: on the harbor fresh foods pallet.\nStarts: about 54 cm above the floor."]);
  });

  it("reads Blueprint's own name to the model pass as a phrase it leaves alone, and shows the line as written", () => {
    const pass = modelPass(["Blueprint"]);
    const page = packetFactsForCompany(status.packetFactsSchema.parse(facts()), null, nobody, pass);
    expect(page.packetFacts!.object).toContain("Longest side: about 67 cm (Blueprint's estimate; the site did not say).");
    expect(pass.read[0]).toContain("Longest side: about 67 cm (the company's estimate; the site did not say).");
    expect(pass.read[0]).not.toContain("Blueprint");
  });

  it("shows no line, and says they are pending, until the model pass has read them", () => {
    const page = packetFactsForCompany(status.packetFactsSchema.parse(facts()), null, nobody, NOTHING_SCREENED());
    expect(page).toEqual({ packetFacts: null, estimated: [], pending: true });
    // Without a reading passed in, it fails closed the same way.
    expect(packetFactsForCompany(status.packetFactsSchema.parse(facts()), null, nobody).pending).toBe(true);
  });

  it("a result whose lines no longer line up keeps none", () => {
    const pass: Screenings = { missing: [], stateOf: (_w, text) => ({ state: "shown", text: text.replace("\n", " [removed] ") }),
      shown: (_w, text) => text };
    const page = packetFactsForCompany(status.packetFactsSchema.parse(facts()), null, nobody, pass);
    expect(page.packetFacts).toEqual({ object: [], measured: [], estimated: [] });
    expect(page.estimated).toEqual([]);
  });

  it("says plainly when there are no packet facts yet", () => {
    expect(packetFactsForCompany(null, null, nobody)).toEqual({ packetFacts: null, estimated: [], pending: false });
  });
});
