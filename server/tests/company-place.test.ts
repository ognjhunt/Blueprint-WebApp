// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { sharedRecordingGrant } from "./helpers/sharedJob";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
// Fixture strings stand for encrypted fields ("encrypted:…"); "unreadable" stands for a field that cannot be decrypted.
vi.mock("../utils/field-encryption", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/field-encryption")>(),
  decryptFieldValue: vi.fn(async (value: unknown) => {
    if (value === "unreadable") throw new Error("cannot decrypt");
    return String(value ?? "").replace(/^encrypted:/, "");
  }),
}));

const { companyPlaceOf, countryOf } = await import("../utils/companyJobPage");
const { RECORDING_VERSION_PLACE_LEVEL } = await import("../utils/teamJobAccess");

const VERSION = sharedRecordingGrant().statement_version;

function job(place: Record<string, unknown> = {}, grant: Record<string, unknown> = sharedRecordingGrant()) {
  return { request: { capture_region: "us", consent_attestation: grant, siteLocation: "Somewhere typed 12",
    siteLocationMetadata: { country: "encrypted:US", state: "encrypted:Texas", city: "encrypted:Austin",
      postalCode: "encrypted:78701", formattedAddress: "encrypted:1 Main St, Austin, TX 78701", lat: 30.2, lng: -97.7, ...place } } };
}

describe("the place a company sees", () => {
  it("ships with one statement version that shows more than the country: v6, the city and state", () => {
    expect(RECORDING_VERSION_PLACE_LEVEL).toEqual({ "2026-11-23.v6": "city" });
  });

  it("with the shipped map, a job recorded under v6 shows its city and state", async () => {
    const v6 = { ...sharedRecordingGrant(), statement_version: "2026-11-23.v6" };
    expect(await companyPlaceOf(job({}, v6))).toBe("Austin, Texas, United States");
    expect(await companyPlaceOf(job({ city: null }, v6))).toBe("Texas, United States");
    expect(await companyPlaceOf(job({}, { ...v6, withdrawn_at_iso: "2026-11-23T12:00:00.000Z" }))).toBe("United States");
  });

  it("with the shipped map, a job recorded under v4 still shows the country alone", async () => {
    const record = job();
    expect(await companyPlaceOf(record)).toBe(await countryOf(record));
    expect(await companyPlaceOf(record)).toBe("United States");
    const regionOnly = { request: { capture_region: "us", consent_attestation: sharedRecordingGrant() } };
    expect(await companyPlaceOf(regionOnly)).toBe("United States");
    expect(await companyPlaceOf({ request: {} })).toBeNull();
  });

  it("shows the state, or the city and state, as the accepted statement's level allows", async () => {
    expect(await companyPlaceOf(job(), { [VERSION]: "state" })).toBe("Texas, United States");
    expect(await companyPlaceOf(job(), { [VERSION]: "city" })).toBe("Austin, Texas, United States");
  });

  it("shows the country alone for a statement version not in the map", async () => {
    expect(await companyPlaceOf(job(), { "some-other-version": "city" })).toBe("United States");
    expect(await companyPlaceOf(job({}, { ...sharedRecordingGrant(), statement_version: "older" }), { older: "city" }))
      .toBe("United States");
  });

  it("shows the country alone when the grant was withdrawn", async () => {
    const withdrawn = { ...sharedRecordingGrant(), withdrawn_at_iso: "2026-11-20T00:00:00.000Z" };
    expect(await companyPlaceOf(job({}, withdrawn), { [VERSION]: "city" })).toBe("United States");
  });

  it("falls to the coarser level when the city is missing, unreadable or not a place name", async () => {
    const levels = { [VERSION]: "city" as const };
    for (const city of [undefined, null, "", "unreadable", "Austin 2", "A".repeat(61)]) {
      expect(await companyPlaceOf(job({ city }), levels)).toBe("Texas, United States");
    }
  });

  it("falls to the country alone when the state is missing, unreadable or not a place name", async () => {
    for (const level of ["state", "city"] as const) {
      for (const state of [undefined, null, "", "unreadable", "TX 78701", "T".repeat(61)]) {
        expect(await companyPlaceOf(job({ state }), { [VERSION]: level })).toBe("United States");
      }
    }
  });

  it("never reads the address, postal code, typed place or coordinates", async () => {
    const shown = await companyPlaceOf(job(), { [VERSION]: "city" });
    for (const hidden of ["Main", "78701", "Somewhere", "30.2", "97.7"]) expect(shown).not.toContain(hidden);
  });
});
