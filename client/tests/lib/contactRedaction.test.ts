import { describe, expect, it } from "vitest";
import { REMOVED, containsContactDetails, identifyingDetailsRemoved, removeContactDetails, removeIdentifyingDetails } from "@/lib/contactRedaction";

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
    ["Write to owner at site-plant dot com today", `Write to ${REMOVED} today`],
    ["See site-plant dot example", `See ${REMOVED}`],
    ["Look up siteplant .com", `Look up ${REMOVED}`],
    ["Mail owner@siteplant now", `Mail ${REMOVED} now`],
    ["Our instagram @siteplant shows it", `Our instagram ${REMOVED} shows it`],
    ["Mail owner＠site-plant.example", `Mail ${REMOVED}`],
    ["Mail o\u200Bwner@site\u200B-plant.example", `Mail ${REMOVED}`],
    ["See ｗｗｗ.siteplant.com", `See ${REMOVED}`],
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
    "We move totes at 9 kg each, at the dock, and the forklift is at bay 4.",
    "One person at a time, 5 to 15 kg, about 30 cm, 60-300 an hour.",
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

describe("removeIdentifyingDetails: the site's own known identity, and street addresses", () => {
  const known = { names: ["ZEBRAPLANT Foods", "Acme Holdings", "Wilhelmina Zebraplant", "Wilhelmina", "Zebraplant", "Dana Submitter"],
    addresses: ["77 QUOKKA Lane, Springfield, IL 62704, US"], contacts: ["owner@site-plant.example", "+1 415 555 0134"] };
  const gone = (out: string) => {
    for (const planted of ["ZEBRAPLANT", "Zebraplant", "QUOKKA", "Quokka", "quokka", "77", "Springfield", "springfield", "62704",
      "Wilhelmina", "wilhelmina", "Acme", "Dana", "site-plant", "415"]) expect(out).not.toContain(planted);
  };

  it("removes the review's example: no ZEBRAPLANT, no 77, no QUOKKA Lane", () => {
    const out = removeIdentifyingDetails("Stack cartons at ZEBRAPLANT Foods, 77 QUOKKA Lane, Springfield.", known);
    expect(out).toBe("Stack cartons at the site.");
    gone(out);
  });

  it.each([
    ["the site's name in another case and spacing", "zebraplant   FOODS stacks cartons", "the site stacks cartons"],
    ["the site's name with punctuation between its words", "Zebraplant-Foods stacks cartons", "the site stacks cartons"],
    ["the organisation", "acme holdings owns the line", "the site owns the line"],
    ["the contact's full name and first name", "Ask WILHELMINA zebraplant or wilhelmina", "Ask the site or the site"],
    ["the submitter's name", "Dana  Submitter films it", "the site films it"],
    ["the site's email and phone", "Mail OWNER@SITE-PLANT.EXAMPLE or call +1 (415) 555-0134", "Mail [removed] or call [removed]"],
    ["the address split across the sentence", "Cartons on 77 quokka lane go to the dock in Springfield.", "Cartons go to the dock."],
    ["the state and postal code part", "Ship from IL 62704 daily", "Ship daily"],
  ])("removes %s", (_name, input, expected) => {
    const out = removeIdentifyingDetails(input, known);
    expect(out).toBe(expected);
    gone(out);
  });

  it.each([
    ["Move totes from 12 Mill Road, Unit 4, 60601 to the dock.", "Move totes to the dock."],
    ["Cartons come from 400 Industrial parkway daily.", "Cartons come daily."],
    ["We work at 5 Mill Place.", "We work."],
    ["Deliver from 1200 N Main St, Suite 300 every morning.", "Deliver every morning."],
  ])("removes a street address we do not hold: %s", (input, expected) => {
    expect(removeIdentifyingDetails(input, { names: [], addresses: [], contacts: [] })).toBe(expected);
  });

  it.each([
    "stack 12 cartons on 3 pallets",
    "Pick from aisle 4 and drop at station 2.",
    "Pick 2 totes and place them on the line.",
    "Move 3 boxes to the court yard, 2 shifts a day, 24/7.",
    "Lift 12 kg boxes 30 cm onto pallet 7, then drive the cart back.",
  ])("leaves ordinary numbers and quantities: %s", input => {
    expect(removeIdentifyingDetails(input, { names: [], addresses: [], contacts: [] })).toBe(input);
    expect(removeIdentifyingDetails(input, known)).toBe(input);
  });

  it("says when something was removed", () => {
    expect(identifyingDetailsRemoved("Stack cartons at ZEBRAPLANT Foods.", known)).toBe(true);
    expect(identifyingDetailsRemoved("Stack cartons on 3 pallets.", known)).toBe(false);
  });
});
