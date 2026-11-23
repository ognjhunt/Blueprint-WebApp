// @vitest-environment node
import { describe, expect, it } from "vitest";
import { usStateFromTypedPlace, withTypedUsState } from "../utils/typedPlaceState";

describe("the state a typed United States place ends with", () => {
  it.each([
    ["Austin, Texas", "Texas"], ["Austin, TX", "Texas"], ["Austin, TX, USA", "Texas"], ["Austin, tx, U.S.A.", "Texas"],
    ["Texas", "Texas"], ["Austin,Texas,United States", "Texas"], ["  Austin ,  new   york  ", "New York"],
    ["Acme Foods, Texas", "Texas"], ["Seattle, Washington", "Washington"], ["Seattle, WA", "Washington"],
    ["Washington, DC", "District of Columbia"], ["Washington, D.C.", "District of Columbia"],
    ["District of Columbia", "District of Columbia"], ["Gary, IN", "Indiana"], ["Portland, OR, US", "Oregon"],
    ["Georgia", "Georgia"],
  ])("%j gives %j", (typed, state) => {
    expect(usStateFromTypedPlace(typed)).toBe(state);
  });

  it.each([
    "123 Main St", "Austin", "Austin TX", "Austin, TX 78701", "123 Main St, Austin, TX 78701", "Texas Roadhouse",
    "Kansas City", "INDIANAPOLIS", "Portland Oregon", "OREGON TRAIL", "Joining, Indianapolis", "Ordway", "Inland Empire",
    "Washington", "USA", "Texas, Mexico", "Perth, WA, Australia", "", "   ", ",,,", "Austin, Texass", "Austin, T X",
  ])("%j gives nothing", (typed) => {
    expect(usStateFromTypedPlace(typed)).toBeNull();
  });

  it("refuses anything but a string of a typed place's length", () => {
    for (const value of [null, undefined, 12, {}, ["Texas"], `${"a".repeat(300)}, Texas`]) expect(usStateFromTypedPlace(value)).toBeNull();
  });
});

describe("the stored place for a typed United States place", () => {
  it("adds the state alone for a job in the United States with no structured state", () => {
    expect(withTypedUsState(null, "Acme Foods, 12 Main St, Austin, Texas", "us")).toEqual({ source: "typed_state", state: "Texas" });
    expect(withTypedUsState({ source: "photon", country: "US" }, "Austin, TX", null))
      .toEqual({ source: "photon", country: "US", state: "Texas" });
  });

  it("keeps a structured state, and never reads text for a job outside the United States", () => {
    const picked = { source: "google_places", city: "Austin", state: "Texas", country: "US" };
    expect(withTypedUsState(picked, "Portland, OR", "us")).toBe(picked);
    expect(withTypedUsState(null, "Georgia", "non_us")).toBeNull();
    expect(withTypedUsState(null, "Georgia", null)).toBeNull();
    expect(withTypedUsState({ source: "photon", country: "GE" }, "Georgia", "us")).toEqual({ source: "photon", country: "GE" });
    expect(withTypedUsState(null, "123 Main St", "us")).toBeNull();
  });
});
