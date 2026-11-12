import { describe, expect, it } from "vitest";
import { REMOVED, containsContactDetails, removeContactDetails } from "@/lib/contactRedaction";

describe("removeContactDetails", () => {
  it.each([
    ["Email jane.doe+ops@acme-foods.co.uk for access", `Email ${REMOVED} for access`],
    ["Write to ops (at) acme (dot) com", `Write to ${REMOVED}`],
    ["See https://acme.example.com/plant?x=1 first", `See ${REMOVED} first`],
    ["Our site www.acmefoods.com has photos", `Our site ${REMOVED} has photos`],
    ["Visit acmefoods.com/jobs", `Visit ${REMOVED}`],
    ["Call +1 (415) 555-0134 any time", `Call ${REMOVED} any time`],
    ["Call +44 20 7946 0958.", `Call ${REMOVED}.`],
    ["Call (415) 555-0134", `Call ${REMOVED}`],
    ["Call 415-555-0134", `Call ${REMOVED}`],
    ["Call 415.555.0134", `Call ${REMOVED}`],
    ["Call 020 7946 0958", `Call ${REMOVED}`],
    ["Call 07700900123", `Call ${REMOVED}`],
    ["Call 4155550134", `Call ${REMOVED}`],
  ])("removes %s", (input, expected) => {
    expect(removeContactDetails(input)).toBe(expected);
    expect(containsContactDetails(input)).toBe(true);
  });

  it.each([
    "Move 12 kg boxes from the line to a pallet, 300 an hour.",
    "Totes are 60 x 40 x 30 cm and weigh 5 to 15 kg (11 to 33 lb).",
    "We run 2 shifts, 24/7 in peak season, 9:00-17:00 otherwise.",
    "About 1 200 000 units a year, 1,200,000 at most.",
    "Started on 2026-11-12, cycle time 4.5 s, 10-15 kg, 60-300 per hour.",
    "Pick 1200 parts per shift at 0.5 m reach, 3 stations, 1/2 of the line.",
    "Order 1234567 is the biggest we make.",
  ])("keeps ordinary numbers: %s", input => {
    expect(removeContactDetails(input)).toBe(input);
    expect(containsContactDetails(input)).toBe(false);
  });

  it("removes all three when planted together", () => {
    const out = removeContactDetails("Stack boxes. Ask bob@plantco.com or 312-555-0199, see plantco.com/about.");
    expect(out).not.toMatch(/bob@|312-555|plantco/);
    expect(out.split(REMOVED).length - 1).toBe(3);
  });
});
