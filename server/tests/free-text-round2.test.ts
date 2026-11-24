/**
 * Stress test round 2 (2026-11-24), the gaps it reproduced in the passes over free text, as asserting tests. No model is
 * called; `NOTHING_SCREENED()` stands for "no model pass has succeeded".
 */
import { describe, expect, it } from "vitest";
import { NOTHING_SCREENED, needsScreening, siteReplyStateForCompany, siteWordsStateForCompany } from "../utils/freeTextScreening";
import { companyWordsForSite, WORDS_PENDING } from "../utils/jobCompanies";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { REMOVED, containsContactDetails, foldDigits, removeContactDetails, removeIdentifyingDetails, removeNamesNotHeld }
  from "../../client/src/lib/contactRedaction";

const known = { names: [], addresses: ["77 Quokka Lane, Springfield, IL 62704"], contacts: ["lead@quokka-plant.example"] };
const company = { names: [], addresses: [], contacts: [] };
const nobody = { names: [], addresses: [], contacts: [] };

/** Texts with no letter in them: contact details a person could type as their whole reply. */
const DIGITS_ONLY = ["612 345 678", "612.345.678", "021 234 567", "415_555_0199", "415•555•0199", "415|555|0199",
  "415 📞 555 📞 0199", "٤١٥٥٥٥٠١٩٩", "४१५५५५०१९९"];

describe("a text of digits alone is read by the pass before the other side reads it, and its phone number goes", () => {
  for (const text of DIGITS_ONLY) {
    it(`a site's reply ${JSON.stringify(text)} is not shown to a company before any model pass`, () => {
      const read = siteReplyStateForCompany(text, known, NOTHING_SCREENED());
      expect(read.state === "shown" ? read.text : "(not shown)").not.toContain(text);
    });
    it(`a site's sentence ${JSON.stringify(text)} is not shown to a company before any model pass`, () => {
      const read = siteWordsStateForCompany(text, known, NOTHING_SCREENED());
      expect(read.state === "shown" ? read.text : "(not shown)").not.toContain(text);
    });
    it(`a company's note ${JSON.stringify(text)} is not shown to the site before any model pass`, () => {
      const shown = companyWordsForSite({ recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, inputs: text },
        company, NOTHING_SCREENED(), "co-1");
      expect(shown === WORDS_PENDING || shown === null ? "(not shown)" : shown).not.toContain(text);
    });
    it(`the pattern pass takes ${JSON.stringify(text)} out as a phone number`, () => {
      expect(removeContactDetails(text)).toBe(REMOVED);
      expect(removeContactDetails(`Call ${text} for the dock.`)).toBe(`Call ${REMOVED} for the dock.`);
      expect(containsContactDetails(text)).toBe(true);
    });
  }

  it("needs the pass for each of them, and for any text of seven digits or more", () => {
    expect(DIGITS_ONLY.filter(text => !needsScreening(text))).toEqual([]);
    expect(needsScreening("1234567")).toBe(true);
    expect(needsScreening("١٢٣٤٥٦٧")).toBe(true);
  });

  it("needs no pass for text with neither a letter nor seven digits", () => {
    for (const text of [REMOVED, `${REMOVED} ${REMOVED}`, "40", "12.5", "1200", "☎ [removed] ☎", "the site"]) expect(needsScreening(text)).toBe(false);
  });

  it("reads every script's digits as ASCII digits", () => {
    expect(foldDigits("٤١٥ ४१५ ৪১৫ ๔๑๕ 415")).toBe("415 415 415 415 415");
  });

  it("takes out a phone number joined by emoji or other marks, and in keycap digits", () => {
    for (const text of ["4️⃣1️⃣5️⃣5️⃣5️⃣5️⃣0️⃣1️⃣9️⃣9️⃣", "415 ☎️ 555 ☎️ 0199", "415 -- 555 -- 0199", "415 -•- 555 -•- 0199", "(415)·555·0199",
      "+34 612 345 678", "+34 ٦١٢ ٣٤٥ ٦٧٨"])
      expect(removeContactDetails(`Ring ${text} today`)).toBe(`Ring ${REMOVED} today`);
  });
});

describe("ordinary job text keeps its numbers (round 1's allow-list)", () => {
  const forCompany = (sentence: string) => removeNamesNotHeld(removeIdentifyingDetails(sentence, nobody));
  it.each([
    "Pick up the sealed carton from the end of the conveyor and place it on the cart.",
    "Pallets are 1200 x 800 mm and weigh 40 kg.",
    "Pallets are 1200 × 800 mm, boxes 600 × 400 × 300 mm.",
    "Carry cartons along route 2 during the 2nd shift.",
    "Stack US 50 gallon drums two high.",
    "About 1 200 000 units a year, 1,200,000 at most.",
    "We move 612 345 678 units a year.",
    "Between 4,000-6,000 cartons a week, 1.5-2.5 kg each.",
    "Started on 2026-11-12 09:00, cycle time 4.5 s, 10-15 kg, 60-300 per hour.",
    "We run 2 shifts, 24/7 in peak season, 9:00-17:00 otherwise.",
    "Starts: the middle of its base at (0.277, -0.182, 0.539) m, about 54 cm above the floor.",
    "Offsets 1.25,0.40,0.80 m and 0.5 1.5 2.5 3.5 s.",
    "Order 1234567 is the biggest we make.",
    "Stations 1, 2, 3, 4, 5, 6 and 7 feed the line.",
  ])("keeps: %s", sentence => {
    expect(forCompany(sentence)).toBe(sentence);
  });

  it("reads a number in another script's digits as the same number, never as a phone", () => {
    expect(removeContactDetails("٤٠ kg")).toBe("40 kg");
    expect(containsContactDetails("٤٠ kg")).toBe(false);
  });

  it("keeps the rules a recorded job's context was bound to (2026-11-19) as they were", () => {
    expect(removeContactDetails("612 345 678", "2026-11-19")).toBe("612 345 678");
    expect(removeContactDetails("٤١٥٥٥٥٠١٩٩", "2026-11-19")).toBe("٤١٥٥٥٥٠١٩٩");
  });
});
