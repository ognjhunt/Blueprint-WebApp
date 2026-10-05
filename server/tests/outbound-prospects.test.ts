// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
// GOOGLE_APPLICATION_CREDENTIALS may be set where tests run: no default reader may reach a real Firestore.
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));

import {
  auditInferredGates,
  gateAnswerSource,
  withOperatorStatedAnswers,
} from "../../client/src/lib/gateProvenance";
import { decideCaptureDispatch } from "../utils/captureDispatch";
import { bindingGateFieldIds } from "../../client/src/data/siteTaskQualification";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import {
  assertNotHypothesisRecipient,
  convertProspectToRequestPayload,
  guardProspectSend,
  prospectResearchTier,
  type OutboundProspect,
  type RecipientProspectReader,
} from "../utils/outboundProspects";
import { communicationsSendingEnabled } from "../agents/communications-send";

afterEach(() => vi.unstubAllEnvs());

/** Injected recipient reader: no other prospect record carries the address. */
const noRecords = async () => [];

const BINDING = ["sceneStability", "taskShape", "objectVariety", "accessWindow"];

function prospect(overrides: Partial<OutboundProspect> = {}): OutboundProspect {
  return {
    prospectId: "p-1",
    facilityName: "Example Distribution Center",
    facilityAddress: "100 Industrial Way, Columbus OH",
    contactEmail: "ops@example.com",
    observations: [{ claim: "Runs a single day shift", source: "https://example.com/careers" }],
    hypothesisedTask: "Totes come off the line and get stacked onto pallets.",
    inferredGates: { sceneStability: "stable", taskShape: "single" },
    gateAnswerSources: { sceneStability: "inferred", taskShape: "inferred" },
    stage: "drafted",
    reasonForContact: "Single-shift DC within the pilot corridor.",
    createdAtIso: "2026-09-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("a guess can never qualify a site", () => {
  it("treats an answer with no recorded provenance as operator-stated", () => {
    // Every inbound request predates provenance, so absence must mean the
    // operator said it -- otherwise shipping this field would freeze the
    // existing funnel.
    expect(gateAnswerSource(undefined, "sceneStability")).toBe("operator_stated");
    expect(gateAnswerSource({}, "sceneStability")).toBe("operator_stated");
  });

  it("names exactly which binding gates are still guesses", () => {
    const audit = auditInferredGates(BINDING, {
      sceneStability: "inferred",
      taskShape: "operator_stated",
    });

    expect(audit.inferredFieldIds).toEqual(["sceneStability"]);
    expect(audit.allOperatorStated).toBe(false);
  });

  it("ignores an inferred gate that does not bind under this capture mode", () => {
    // Nobody was asked, so nobody has to confirm it.
    const audit = auditInferredGates(BINDING, { serviceArea: "inferred" });
    expect(audit.allOperatorStated).toBe(true);
  });

  it("refuses to dispatch capture on inferred gates, even when everything else passes", () => {
    // The whole safety property in one assertion: an outbound hypothesis is
    // enough to start a conversation and never enough to send a capturer to an
    // address or commit a paid reconstruction.
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
      bindingFieldIds: BINDING,
      gateAnswerSources: { sceneStability: "inferred" },
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
    expect(decision.dispatch === false && decision.detail).toContain("sceneStability");
  });

  it("dispatches once the operator has stated the binding gates themselves", () => {
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
      bindingFieldIds: BINDING,
      gateAnswerSources: Object.fromEntries(
        BINDING.map((field) => [field, "operator_stated" as const]),
      ),
    });

    expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });

  it("leaves inbound requests working exactly as before", () => {
    // No provenance and no binding list: the inbound caller passes neither.
    expect(
      decideCaptureDispatch({ captureRegion: "us", disposition: "qualified", captureMode: "self_capture" }),
    ).toMatchObject({ dispatch: true });
  });

  it("promotes only the gates a reply actually addressed", () => {
    // A warm reply that answers one question does not ratify the other five.
    const promoted = withOperatorStatedAnswers(
      { sceneStability: "inferred", taskShape: "inferred" },
      ["taskShape"],
    );

    expect(promoted).toEqual({ sceneStability: "inferred", taskShape: "operator_stated" });
  });
});

describe("nothing leaves the building unsourced or unwanted", () => {
  it("sends when the hypothesis is specific and sourced", async () => {
    const result = await guardProspectSend(prospect(), { readRecipientProspects: noRecords, isSuppressed: async () => false });
    expect(result).toEqual({ send: true, email: "ops@example.com" });
  });

  it("refuses a recipient who opted out", async () => {
    const result = await guardProspectSend(prospect(), { readRecipientProspects: noRecords, isSuppressed: async () => true });
    expect(result).toMatchObject({ send: false, blocker: "email_suppressed" });
  });

  it("treats an unreadable suppression list as suppressed", async () => {
    // Not knowing whether someone opted out is not permission.
    const result = await guardProspectSend(prospect(), {
      readRecipientProspects: noRecords, isSuppressed: async () => {
        throw new Error("firestore unavailable");
      },
    });

    expect(result).toMatchObject({ send: false, blocker: "email_suppressed" });
  });

  it("refuses an observation with no source", async () => {
    // A hallucinated detail about a stranger's building is checkable in one
    // second and unforgettable.
    const result = await guardProspectSend(
      prospect({ observations: [{ claim: "Runs three shifts", source: "  " }] }),
      { readRecipientProspects: noRecords, isSuppressed: async () => false },
    );

    expect(result).toMatchObject({ send: false, blocker: "unsourced_observation" });
    expect(result.send === false && result.detail).toContain("Runs three shifts");
  });

  it("refuses to send with nothing checkable behind the claim", async () => {
    const result = await guardProspectSend(prospect({ observations: [] }), {
      readRecipientProspects: noRecords, isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "no_sourced_observations" });
  });

  it("refuses a generic send with no specific hypothesis", async () => {
    const result = await guardProspectSend(prospect({ hypothesisedTask: "   " }), {
      readRecipientProspects: noRecords, isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "hypothesis_missing" });
  });

  it("does not contact the same prospect twice in a beta", async () => {
    const result = await guardProspectSend(prospect({ stage: "contacted" }), {
      readRecipientProspects: noRecords, isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "already_contacted" });
  });

  it("refuses a closed prospect with its own blocker, not the redraftable one", async () => {
    // The draft route lets `already_contacted` through so a message nobody
    // approved can be rewritten. Someone who asked us to stop must not ride in
    // on that allowance, so the blocker has to be distinguishable.
    const result = await guardProspectSend(
      prospect({ stage: "closed", closedReason: "Asked not to be contacted." }),
      { readRecipientProspects: noRecords, isSuppressed: async () => false },
    );

    expect(result).toMatchObject({ send: false, blocker: "prospect_closed" });
    expect(result.send === false && result.detail).toContain("Asked not to be contacted.");
  });

  it("refuses a closed prospect even if the suppression list has not caught up", async () => {
    // Closing writes a suppression entry, but the stage is the local fact and
    // must stand on its own rather than depending on a second read succeeding.
    const result = await guardProspectSend(prospect({ stage: "closed" }), {
      readRecipientProspects: noRecords, isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "prospect_closed" });
  });
});

describe("the legacy mailer route and research-derived prospects", () => {
  // Synthetic research admission fields, shaped like the ones intake writes.
  const verifiedResearch = { researchPublicationId: "BP-000042", entityAdmission: "research_provisional",
    communicationsContextReview: { briefId: "research-brief-1", briefDigest: "a".repeat(64) } };
  const hypothesis = { ...verifiedResearch, researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" };
  const research = (fields: Record<string, unknown>, overrides: Partial<OutboundProspect> = {}) =>
    ({ ...prospect(overrides), ...fields }) as OutboundProspect;

  it("refuses an outreach-ready hypothesis with sending enabled, before the suppression lookup", async () => {
    const isSuppressed = vi.fn(async () => false);
    const result = await guardProspectSend(research(hypothesis), { readRecipientProspects: noRecords, isSuppressed, sendingEnabled: () => true });
    expect(result).toMatchObject({ send: false, blocker: "outreach_ready_hypothesis_draft_only" });
    expect(isSuppressed).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>]>([
    ["a site-screen admission", { screenAdmissionId: "d".repeat(64) }],
    ["an unrecognised research admission", { ...verifiedResearch, entityAdmission: "research_unrecognised" }],
    ["an unrecognised tier", { ...verifiedResearch, qualificationTier: "verified_later" }],
    ["a hypothesis tier without other research fields", { qualificationTier: "outreach_ready" }],
  ])("fails closed on %s as a hypothesis", async (_name, fields) => {
    expect(prospectResearchTier(research(fields))).toBe("hypothesis");
    expect(await guardProspectSend(research(fields), { readRecipientProspects: noRecords, isSuppressed: async () => false, sendingEnabled: () => true }))
      .toMatchObject({ send: false, blocker: "outreach_ready_hypothesis_draft_only" });
  });

  it("refuses a verified research prospect while the communications send flag is off", async () => {
    expect(prospectResearchTier(research(verifiedResearch))).toBe("verified");
    expect(await guardProspectSend(research(verifiedResearch), { readRecipientProspects: noRecords, isSuppressed: async () => false, sendingEnabled: () => false }))
      .toMatchObject({ send: false, blocker: "communications_sending_disabled" });
    expect(await guardProspectSend(research({ researchPublicationId: "BP-000042" }), { readRecipientProspects: noRecords, isSuppressed: async () => false, sendingEnabled: () => false }))
      .toMatchObject({ send: false, blocker: "communications_sending_disabled" });
  });

  it("passes a verified research prospect only once the send flag is on", async () => {
    expect(await guardProspectSend(research(verifiedResearch), { readRecipientProspects: noRecords, isSuppressed: async () => false, sendingEnabled: () => true }))
      .toEqual({ send: true, email: "ops@example.com" });
  });

  it("leaves hand-chosen prospects unchanged while the send flag is off", async () => {
    expect(prospectResearchTier(prospect())).toBe("none");
    expect(await guardProspectSend(prospect(), { readRecipientProspects: noRecords, isSuppressed: async () => false, sendingEnabled: () => false }))
      .toEqual({ send: true, email: "ops@example.com" });
  });

  it("reports every other refusal first, so the draft route cannot pass a closed or suppressed research prospect", async () => {
    const off = { sendingEnabled: () => false };
    expect(await guardProspectSend(research(verifiedResearch, { stage: "closed" }), { ...off, readRecipientProspects: noRecords, isSuppressed: async () => false }))
      .toMatchObject({ blocker: "prospect_closed" });
    expect(await guardProspectSend(research(verifiedResearch), { ...off, readRecipientProspects: noRecords, isSuppressed: async () => true }))
      .toMatchObject({ blocker: "email_suppressed" });
    expect(await guardProspectSend(research(verifiedResearch, { observations: [] }), { ...off, readRecipientProspects: noRecords, isSuppressed: async () => false }))
      .toMatchObject({ blocker: "no_sourced_observations" });
  });

  it("refuses an address that another record holds as a hypothesis, before any other refusal or lookup", async () => {
    const isSuppressed = vi.fn(async () => false);
    const readRecipientProspects = vi.fn(async () => [prospect(), research(hypothesis)]);
    // A hand-chosen prospect, already contacted: the draft route would let that blocker through.
    expect(await guardProspectSend(prospect({ contactEmail: " Ops@Example.com ", stage: "contacted" }),
      { isSuppressed, sendingEnabled: () => true, readRecipientProspects }))
      .toMatchObject({ send: false, blocker: "outreach_ready_hypothesis_draft_only" });
    expect(readRecipientProspects).toHaveBeenCalledWith(["Ops@Example.com", "ops@example.com"]);
    expect(isSuppressed).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>]>([
    ["a site-screen admission", { screenAdmissionId: "d".repeat(64) }],
    ["an unrecognised tier", { ...verifiedResearch, qualificationTier: "verified_later" }],
  ])("treats another record with %s as a hypothesis recipient", async (_name, fields) => {
    expect(await guardProspectSend(prospect(), { isSuppressed: async () => false, readRecipientProspects: async () => [research(fields)] }))
      .toMatchObject({ send: false, blocker: "outreach_ready_hypothesis_draft_only" });
  });

  it("passes an address whose other records are hand-chosen or verified", async () => {
    expect(await guardProspectSend(prospect(), { isSuppressed: async () => false,
      readRecipientProspects: async () => [prospect(), research(verifiedResearch)] })).toEqual({ send: true, email: "ops@example.com" });
  });

  it("fails closed on unreadable recipient records only for a research-backed prospect", async () => {
    const unreadable = async () => { throw new Error("firestore unavailable"); };
    expect(await guardProspectSend(research(verifiedResearch), { isSuppressed: async () => false, sendingEnabled: () => true,
      readRecipientProspects: unreadable })).toMatchObject({ send: false, blocker: "recipient_research_origin_unavailable" });
    expect(await guardProspectSend(prospect(), { isSuppressed: async () => false, sendingEnabled: () => true,
      readRecipientProspects: unreadable })).toEqual({ send: true, email: "ops@example.com" });
  });

  it.each(["", "false", "TRUE", "1", "yes", "true"])("reads BLUEPRINT_COMMUNICATIONS_SEND_ENABLED=%j exactly as the send path does", async (value) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", value);
    const result = await guardProspectSend(research(verifiedResearch), { readRecipientProspects: noRecords, isSuppressed: async () => false });
    expect(result.send).toBe(communicationsSendingEnabled());
    expect(result.send).toBe(value === "true");
  });
});

describe("assertNotHypothesisRecipient (injected reader; Firestore mocked out)", () => {
  const hypothesisRecord = { contactEmail: "ops@example.com", researchPublicationId: "BP-000043", qualificationTier: "outreach_ready" };

  it("refuses when any record for the address is a hypothesis, research-backed or not", async () => {
    for (const researchBacked of [true, false]) {
      await expect(assertNotHypothesisRecipient(["ops@example.com"], { researchBacked,
        readProspects: async () => [{ contactEmail: "ops@example.com" }, hypothesisRecord] })).rejects.toThrow("outreach_ready_hypothesis_draft_only");
    }
  });

  it("reads each address once, as written and normalized, and skips non-strings", async () => {
    const readProspects = vi.fn(async () => []);
    await assertNotHypothesisRecipient([" Ops@Example.com", "ops@example.com", null, 7], { researchBacked: true, readProspects });
    expect(readProspects).toHaveBeenCalledOnce();
    expect(readProspects).toHaveBeenCalledWith(["Ops@Example.com", "ops@example.com"]);
  });

  it.each<[string, RecipientProspectReader | undefined, unknown[]]>([
    ["the reader throws", async () => { throw new Error("firestore unavailable"); }, ["ops@example.com"]],
    ["the reader returns no list", async () => ({ docs: [] }) as never, ["ops@example.com"]],
    ["there is no address to read", async () => [], [" ", undefined]],
    ["the default reader has no store", undefined, ["ops@example.com"]],
  ])("fails closed when %s, only for a research-backed send", async (_name, readProspects, recipients) => {
    await expect(assertNotHypothesisRecipient(recipients, { researchBacked: true, readProspects }))
      .rejects.toThrow("recipient_research_origin_unavailable");
    await expect(assertNotHypothesisRecipient(recipients, { researchBacked: false, readProspects })).resolves.toBeUndefined();
  });

  it("passes hand-chosen and verified records", async () => {
    await expect(assertNotHypothesisRecipient(["ops@example.com"], { researchBacked: true, readProspects: async () => [
      { contactEmail: "ops@example.com" }, { contactEmail: "ops@example.com", researchPublicationId: "BP-000042", entityAdmission: "research_provisional" },
    ] })).resolves.toBeUndefined();
  });
});

describe("the gates that bind follow the capture mode", () => {
  it("drops the service-area gate when the site holds the phone", () => {
    // The one gate about our driving rather than their room.
    expect(bindingGateFieldIds("self_capture")).not.toContain("serviceArea");
    expect(bindingGateFieldIds("site_visit")).toContain("serviceArea");
  });

  it("agrees exactly with what triage actually scores", () => {
    // Two implementations of one rule is how they drift, and a drift here is
    // silent: provenance would audit a gate triage never asked about, or miss
    // one it did. Given no answers at all, every binding gate lands in
    // `unanswered` -- so triage names its own binding set, and the two lists
    // have to be the same list.
    for (const mode of ["self_capture", "site_visit"] as const) {
      expect([...triageGateAnswers({}, undefined, mode).unanswered].sort()).toEqual(
        [...bindingGateFieldIds(mode)].sort(),
      );
    }
  });
});

describe("a reply rejoins the inbound funnel", () => {
  it("keeps our guesses only where the operator did not correct them", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: { taskShape: "few_variants", accessWindow: "scheduled" },
      taskStatement: "We move totes to pallets, plus some shrink-wrapping.",
      captureMode: "self_capture",
    });

    expect(payload.siteTaskGates).toEqual({
      sceneStability: "stable", // still ours
      taskShape: "few_variants", // theirs, overriding ours
      accessWindow: "scheduled", // theirs
    });
    expect(payload.gateAnswerSources).toEqual({
      sceneStability: "inferred",
      taskShape: "operator_stated",
      accessWindow: "operator_stated",
    });
  });

  it("still holds dispatch on the gates the reply did not mention", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: { taskShape: "single" },
      taskStatement: "Totes to pallets.",
    });

    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      bindingFieldIds: BINDING,
      gateAnswerSources: payload.gateAnswerSources,
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });

  it("marks the request as outbound so it can be told from one that arrived alone", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: {},
      taskStatement: "Totes to pallets.",
    });

    expect(payload.acquisitionSource).toBe("outbound");
    expect(payload.outboundProspectId).toBe("p-1");
  });
});
