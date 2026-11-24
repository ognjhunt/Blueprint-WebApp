/**
 * Stress test round 2 (2026-11-24), the gaps it reproduced in the passes over free text, as asserting tests. No model is
 * called; `NOTHING_SCREENED()` stands for "no model pass has succeeded".
 */
import { describe, expect, it } from "vitest";
import { NOTHING_SCREENED, needsScreening, siteReplyStateForCompany, siteWordsStateForCompany } from "../utils/freeTextScreening";
import { companyWordsForSite, WORDS_PENDING } from "../utils/jobCompanies";
import { COMPANY_RESPONSE_STATEMENT_VERSION, amountReadsAsPhoneNumber, estimateInWords, isApplicationEstimate, isEstimateAmount }
  from "../../client/src/lib/companyResponses";
import { APPLICATION_NAME_HOLDS_CONTACT, APPLICATION_WEBSITE_NOT_OWN, applicantNameHoldsContactDetails, applicantWebsiteOrigin }
  from "../../client/src/lib/companyApplicant";
import { applicantShownToSite } from "../utils/jobCompanies";
import { applicationRefusal, applicationSchema } from "../routes/robot-team-access";
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

describe("a company's name, website and estimate carry no contact detail to the site before Accept", () => {
  it("$41,555,501.99 (415 555 0199) is refused as an estimate, and the site is given no words for it", () => {
    expect(isEstimateAmount(41_555_501.99)).toBe(false);
    expect(estimateInWords("per_hour", { lowUsd: 41_555_501.99, highUsd: 41_555_501.99 })).toBeNull();
  });

  it("caps each way of charging at its own ceiling", () => {
    expect(isApplicationEstimate({ lowUsd: 45, highUsd: 60 }, "per_hour")).toBe(true);
    expect(isApplicationEstimate({ lowUsd: 9_000, highUsd: 10_000 }, "per_hour")).toBe(true);
    expect(isApplicationEstimate({ lowUsd: 9_000, highUsd: 10_001 }, "per_hour")).toBe(false);
    expect(isApplicationEstimate({ lowUsd: 4_000, highUsd: 1_000_000 }, "subscription")).toBe(true);
    expect(isApplicationEstimate({ lowUsd: 4_000, highUsd: 1_001_000 }, "subscription")).toBe(false);
    expect(isApplicationEstimate({ lowUsd: 250_000, highUsd: 10_000_000 }, "purchase")).toBe(true);
    expect(isApplicationEstimate({ lowUsd: 250_000, highUsd: 10_001_000 }, "purchase")).toBe(false);
    expect(isApplicationEstimate({ lowUsd: 0.35, highUsd: 0.5 }, "per_task")).toBe(true);
    expect(estimateInWords("per_hour", { lowUsd: 20_000, highUsd: 20_000 })).toBeNull();
  });

  it("refuses amounts whose digits read as a phone number, and keeps round and small ones", () => {
    for (const amount of [41_555_501.99, 5_550_199, 1_234_567, 12_345.67, 10_000.5, 6_123_456.78])
      expect(amountReadsAsPhoneNumber(amount), String(amount)).toBe(true);
    for (const amount of [0.35, 45, 45.5, 9_999.99, 99_999, 999_999, 1_250_000, 4_000_000, 10_000_000])
      expect(amountReadsAsPhoneNumber(amount), String(amount)).toBe(false);
  });

  it("refuses a company name that holds a contact detail, and keeps a name that is its own website", () => {
    expect(applicantNameHoldsContactDetails("Zed Robotics · call 415 555 0199", "https://zed.example")).toBe(true);
    expect(applicantNameHoldsContactDetails("Zed Robotics (sales@zed.example)", "https://zed.example")).toBe(true);
    expect(applicantNameHoldsContactDetails("Zed Robotics, see zedbots.example", "https://zed.example")).toBe(true);
    expect(applicantNameHoldsContactDetails("Zed Robotics ٤١٥٥٥٥٠١٩٩", "https://zed.example")).toBe(true);
    expect(applicantNameHoldsContactDetails("Covariant.ai", "https://covariant.ai")).toBe(false);
    expect(applicantNameHoldsContactDetails("Zed Robotics", "https://zed.example")).toBe(false);
    expect(applicantNameHoldsContactDetails("3M Robotics 2000", "https://3m.example")).toBe(false);
  });

  it("shows the site only the website's origin, and nothing for a messaging, calling or booking link or a shortener", () => {
    expect(applicantWebsiteOrigin("https://zed.example/contact?phone=4155550199#call")).toBe("https://zed.example");
    expect(applicantWebsiteOrigin("https://4155550199@zed.example:8443/x")).toBe("https://zed.example");
    for (const website of ["https://wa.me/14155550199", "https://api.whatsapp.com/send?phone=14155550199", "https://t.me/zedbots",
      "https://m.me/zedbots", "https://bit.ly/3abc", "https://www.linktr.ee/zed", "tel:+14155550199", "mailto:sales@zed.example",
      "https://4155550199.example", "http://142.250.80.123/", "javascript:alert(1)"])
      expect(applicantWebsiteOrigin(website), website).toBeNull();
  });

  it("the site reads the company's letter when its stored name holds a contact detail, and only its website's origin", () => {
    const answer = { recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION };
    expect(applicantShownToSite(answer, { company: "Zed Robotics · call 415 555 0199", website: "https://zed.example" })).toBeNull();
    expect(applicantShownToSite(answer, { company: "Zed Robotics", website: "https://wa.me/14155550199" }))
      .toEqual({ name: "Zed Robotics", website: null });
    expect(applicantShownToSite(answer, { company: "Zed Robotics", website: "https://zed.example/about/team" }))
      .toEqual({ name: "Zed Robotics", website: "https://zed.example" });
  });

  it("the application form refuses such a name and such a website, saying which", () => {
    const base = { name: "Ada", email: "ada@zed.example", company: "Zed Robotics", website: "https://zed.example" };
    expect(applicationSchema.safeParse(base).success).toBe(true);
    const name = applicationSchema.safeParse({ ...base, company: "Zed Robotics · call 415 555 0199" });
    expect(name.success).toBe(false);
    expect(applicationRefusal(name.error!.issues)).toBe(APPLICATION_NAME_HOLDS_CONTACT);
    const site = applicationSchema.safeParse({ ...base, website: "https://wa.me/14155550199" });
    expect(site.success).toBe(false);
    expect(applicationRefusal(site.error!.issues)).toBe(APPLICATION_WEBSITE_NOT_OWN);
    expect(applicationSchema.safeParse({ ...base, website: "tel:+14155550199" }).success).toBe(false);
  });
});
