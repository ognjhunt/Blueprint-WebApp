import { describe, expect, it } from "vitest";
import { removeIdentifyingDetails } from "@/lib/contactRedaction";

/**
 * The company reviewer's attack table (S/review-e2e/review-identity-probe.test.ts, 19:40Z), ported: each row is either
 * removed, or kept as the stated limit (nicknames, abbreviations, landmarks, a reordered address, a street with no
 * street word, a state spelled differently from the record). Then the ordinary sentences, which must come back unchanged.
 */
const known = { names: ["ZEBRAPLANT Foods", "Acme Logistics", "Wilhelmina Zebraplant", "Wilhelmina", "Zebraplant"],
  organisations: ["ZEBRAPLANT Foods", "Acme Logistics"],
  addresses: ["77 Quokka Lane, Suite 5, Springfield, IL 62704", "Springfield"], contacts: ["owner@site-plant.example", "+1 415 555 0134"] };
const HELD = /zebra|z\.e\.b|quokka|springfield|62704|wilhelmina|acme|site-plant|415|555|0134/i;

const removed: string[] = [
  "Stack cartons at ZEBRAPLANT Foods, 77 QUOKKA Lane, Springfield.",
  "Stack cartons at zebraplant foods.",
  "Stack cartons at Zebra Plant Foods.",
  "Stack cartons at Z.E.B.R.A.P.L.A.N.T. Foods.",
  "Stack cartons at ZEBRAPLANT's dock.",
  "Stack cartons at ZEBRAPLANT’s dock.",
  "Stack cartons at Zébraplant Foods.",
  "Stack cartons at Zebraplant-Foods.",
  "Stack cartons at ZEBRAPLANTFOODS.",
  "ZEBRA PLANT foods runs this.",
  "Stack cartons at Suite 5, 77 Quokka Lane.",
  "Stack cartons in Springfield.",
  "Stack cartons at our Springfield plant.",
  "Stack cartons at the Quokka Ln site.",
  "Ask Wilhelmina.",
  "Ask Mr. Zebraplant.",
  "Stack cartons at ACME LOGISTICS.",
  "Stack cartons at Acme.",
  "Acme handles it.",
  "Postal 62704.",
  "Email owner at site-plant dot example.",
  "Call 415-555-0134.",
  "We are the Springfield, Illinois site of a big grocer.",
  "Our site at 500 Industrial Pkwy, Building C.",
];
/** The stated limit: what still gets through, with the reason. */
const keptAsLimit: Array<[string, string, RegExp]> = [
  ["an abbreviation", "Stack cartons at ZP Foods.", /ZP Foods/],
  ["a reordered address", "Stack cartons at Quokka Lane 77.", /77/],
  ["a nickname", "Ask Willa (Wilhelmina's nickname).", /Willa/],
  ["a nickname", "Ask Mina.", /Mina/],
  ["a street with no street word", "Behind 1200 West Madison.", /1200 West Madison/],
  ["a landmark", "At Pier 39 in San Francisco.", /Pier 39 in San Francisco/],
  ["a state spelled differently from the record", "We are the Springfield, Illinois site of a big grocer.", /Illinois/],
];
const ordinary = [
  "Pick 2 totes and place them on the conveyor.", "Move 40 boxes an hour from 3 racks to 1 pallet.", "Load 12 kg cartons onto 2 pallets.",
  "Sort fresh produce into crates.", "Carry parts north to the line.", "Pick from shelf 4 and place at station 12.",
  "Stack 6 boxes high in aisle 3 by the main road door.", "Move 300 parts per shift down lane 2.", "Run 2 shifts, 5 days a week, from 6 am.",
  "Put 10 Drive units on the bench.", "Fill 20 bins at 1 Place then 2 Place.", "Unload 15 Court files.", "Take 5 St Bernards for a walk.",
];

describe("the reviewer's attack table", () => {
  it.each(removed)("removes: %s", sentence => {
    expect(removeIdentifyingDetails(sentence, known)).not.toMatch(HELD);
  });
  it.each(keptAsLimit)("keeps (stated limit: %s): %s", (_why, sentence, survives) => {
    expect(removeIdentifyingDetails(sentence, known)).toMatch(survives);
  });
});

describe("ordinary job sentences are untouched", () => {
  it.each(ordinary)("with nothing known: %s", sentence => {
    expect(removeIdentifyingDetails(sentence, { names: [], addresses: [], contacts: [] })).toBe(sentence);
  });
  it.each(ordinary)("with the site's identity held: %s", sentence => {
    expect(removeIdentifyingDetails(sentence, known)).toBe(sentence);
  });
  it("a generic word of a site's name is never removed alone, and a distinctive one only where capitalised", () => {
    const fresh = { names: ["Fresh Foods"], organisations: ["Fresh Foods"], addresses: [], contacts: [] };
    expect(removeIdentifyingDetails("Sort fresh produce into crates.", fresh)).toBe("Sort fresh produce into crates.");
    const acme = { names: ["Acme Logistics"], organisations: ["Acme Logistics"], addresses: [], contacts: [] };
    expect(removeIdentifyingDetails("We call Acme to move 40 acme-brand boxes.", acme)).toBe("We call the site to move 40 acme-brand boxes.");
  });
  it("still removes a street we do not hold when a name word precedes the street word, or a unit follows", () => {
    for (const [sentence, expected] of [["We work at 5 Mill Place.", "We work."], ["Deliver from 1200 N Main St, Suite 300 every morning.", "Deliver every morning."],
      ["Ship from 9 Court, Unit 4 daily.", "Ship daily."]])
      expect(removeIdentifyingDetails(sentence, { names: [], addresses: [], contacts: [] })).toBe(expected);
  });
});

// Planner, 2026-11-12, H3 decision: privacy wins over a mangled sentence. A distinctive word of the name is removed
// alone wherever it is capitalised, the first word of a sentence included; ordinary workplace and place words, months,
// weekdays and directions are never removed alone, while the full name still is. An article left before "the site" goes.
describe("capitalised words of a site's name", () => {
  const org = (name: string) => ({ names: [name], organisations: [name], addresses: [], contacts: [] });
  it.each([
    ["Acme handles it.", "Acme Logistics", "The site handles it."],
    ["Stack cartons at the Acme dock. Acme runs two shifts.", "Acme Logistics", "Stack cartons at the site dock. The site runs two shifts."],
    ["Load at a Acme dock.", "Acme Logistics", "Load at the site dock."],
    ["Use the March batch.", "March Foods", "Use the March batch."],
    ["Start on Monday with the Monday crew.", "Monday Market", "Start on Monday with the Monday crew."],
    ["Carry parts North to the Line.", "North Star Foods", "Carry parts North to the Line."],
    ["Station 4 takes the totes.", "Station Casinos", "Station 4 takes the totes."],
    ["Robot picks Boxes at Station 4.", "Station Casinos", "Robot picks Boxes at Station 4."],
    ["Follow the Safety rules.", "Safety Kleen", "Follow the Safety rules."],
    ["Work for Safety Kleen.", "Safety Kleen", "Work for the site."],
    ["The Robot arm picks Boxes.", "Robot Boxes", "The Robot arm picks Boxes."],
    ["Robot Boxes runs the line.", "Robot Boxes", "The site runs the line."],
  ])("%s (site %s)", (sentence, name, expected) => {
    expect(removeIdentifyingDetails(sentence, org(name))).toBe(expected);
  });
  it.each(ordinary)("ordinary sentences stay whole for sites named with everyday words: %s", sentence => {
    for (const name of ["Station Casinos", "Safety Kleen", "Robot Boxes", "March Foods", "North Star Foods", "Main Street Market"])
      expect(removeIdentifyingDetails(sentence, org(name))).toBe(sentence);
  });
  it("never leaves a doubled article before the site", () => {
    for (const sentence of ["Use the Zebraplant batch.", "Use a Zebraplant pallet.", "Work at the the Zebraplant dock."]) {
      const out = removeIdentifyingDetails(sentence, org("Zebraplant Foods"));
      expect(out).not.toMatch(/\b(the|a|an)\s+the site\b/i);
      expect(out).toContain("the site");
    }
  });
});
