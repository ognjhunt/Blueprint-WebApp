// @vitest-environment node
/**
 * The site's own page says its simulation is ready once the job's simulation package is delivered to the website
 * (`storedCompanySimulation`), the same stored fact that gives an approved deployment company "Download the
 * simulation". A room package (the job's object not in it) counts too: nothing more may ever be built for that job.
 * "We're building the simulation of your site." stays only while nothing is delivered. OFFLINE: the real outlook loader
 * against the fake Firestore, with the reads a status request holds given to it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: null };
});

const { jobOutlook, loadJobOutlook } = await import("../utils/jobOutlook");
const { SIMULATION_BUILDING, SIMULATION_READY } = await import("../../client/src/lib/jobOutlook");

const ID = "req-delivered-sim";
const CAPTURE = `walkthrough-${ID}`;

function job() {
  return { requestId: ID, createdAt: "2026-11-12T10:00:00.000Z",
    request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"), capture_privacy_screen: passedPrivacyScreen(ID) };
}

/** A package reference as the contract's record; `room` is a room package: no object file among its members. */
function simulationPackage(patch: Record<string, unknown> = {}, room = false) {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"5".repeat(64)}`, size_bytes: 1234,
    files: room ? ["README.txt", "scene.usda", "scene/room.usdz", "scene/room_collision.usdz", "success_rule.json"]
      : ["README.txt", "object.usdz", "scene.usda", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000, ...patch };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
}

const BRIEF = { requestId: ID, summary: "Stack 12 kg cartons onto the pallet.", confirmedAtIso: "2026-11-12T10:05:00.000Z" };
const READY_ANSWER = { state: "ready", reason: null } as never;

/** The outlook as the status route reads it: the reads it already holds, with the scene still under way. */
async function outlookWith(session: Record<string, unknown> | undefined,
  scene: { state: string } | null = { state: "in_progress" }) {
  const record = job();
  state.docs.set(`inboundRequests/${ID}`, record);
  if (session) state.docs.set(`captureUploadSessions/${CAPTURE}`, session);
  return loadJobOutlook(ID, { record, captureId: CAPTURE, session,
    preparationStatus: session?.website_preparation ? { state: "handed_off" } as never : null,
    sceneProgression: scene as never, answer: READY_ANSWER, brief: BRIEF as never });
}

beforeEach(() => { state.docs.clear(); });

describe("the site's page once its simulation is delivered", () => {
  it("is ready when a room package is stored, while the scene is still under way", async () => {
    const outlook = await outlookWith({ website_preparation: { request_id: ID }, company_simulation: simulationPackage({}, true) });
    expect(outlook.phase).toBe("simulation_ready");
    expect(outlook.sentence).toBeNull();
    // The page's line for the phase (`SiteAnswer.tsx`).
    expect(SIMULATION_READY).toBe("The simulation of your site is ready.");
  });

  it("is ready when a full package is stored, with no preparation status read", async () => {
    const outlook = await outlookWith({ company_simulation: simulationPackage() }, null);
    expect(outlook.phase).toBe("simulation_ready");
  });

  it("is still being built while nothing is delivered", async () => {
    expect((await outlookWith({ website_preparation: { request_id: ID } })).phase).toBe("building");
    expect((await outlookWith(undefined, null)).phase).toBe("building");
    expect(SIMULATION_BUILDING).toBe("We're building the simulation of your site.");
  });

  it("a package that does not verify, or belongs to another capture, is not a delivery", async () => {
    const forged = { ...simulationPackage(), size_bytes: 99 };
    expect((await outlookWith({ website_preparation: { request_id: ID }, company_simulation: forged })).phase).toBe("building");
    const other = simulationPackage({ capture_id: `walkthrough-${ID}-other` });
    expect((await outlookWith({ website_preparation: { request_id: ID }, company_simulation: other })).phase).toBe("building");
  });

  it("a delivered package never hides the site's own ending or a recorded one", () => {
    const base = { consentRevoked: false, closedByOwner: false, answer: { state: "ready" as const, unsized: false, reason: null },
      windowEnded: false, noGrantEnded: false, preparation: null, scene: null, proof: null, simulationDelivered: true };
    expect(jobOutlook(base).phase).toBe("simulation_ready");
    expect(jobOutlook({ ...base, consentRevoked: true }).phase).toBe("ended_by_site");
    // Changed on purpose 2026-11-27 (outreach audit D4): the window's ending no longer hides a package already
    // delivered, which companies can still download; every other recorded ending still does.
    expect(jobOutlook({ ...base, windowEnded: true }).phase).toBe("simulation_ready");
    expect(jobOutlook({ ...base, windowEnded: true, simulationDelivered: false }).phase).toBe("no_test");
    expect(jobOutlook({ ...base, preparation: { state: "failed_terminal", geometryOnlyEnd: false } }).phase).toBe("no_test");
    expect(jobOutlook({ ...base, simulationDelivered: false }).phase).toBe("building");
  });
});
