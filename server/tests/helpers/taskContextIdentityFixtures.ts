/**
 * Briefs for the task context's identity rule (`websiteTaskContext.ts`): ones whose text holds nothing of the site,
 * one with accents and doubled spaces (which the cleaning must leave alone), a confirmed one that names its sealed
 * parent, and one whose text types the site's identity. Shared by the test and by the one-off run that froze what
 * the projection returned before the rule existed.
 */
import type { SiteTaskBriefRecord } from "../../utils/siteTaskBrief";

export const REQUEST_ID = "capture-0b6f6f43-7a2c-4e7e-9a41-5a7c2f3d8e10";

/** The job record's rights, as a job shared under recording v4 holds them. */
export const RIGHTS_RECORD = { request: { buyerType: "site_operator", capture_mode: "self_capture",
  consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: "2026-11-12T10:00:00.000Z" } } };

const base = {
  requestId: REQUEST_ID, proposed: [], unresolved: [], operatorUnknown: null, confirmedAtIso: null,
} as unknown as SiteTaskBriefRecord;

/** Nothing of the site anywhere: an unconfirmed brief with answers, object details and a success definition. */
export const PLAIN_BRIEF = { ...base,
  summary: "Move the blue tray from the counter to the back shelf, 3 times an hour.",
  operatorAnswers: { where: "Back room", how_often: "3 times an hour" },
  operatorTaskDetails: { item_weight: "about 2 kg", item_make_model: "house tray" },
  successCriteria: { successDefinition: "Tray on the shelf", successRate: 90, cycleTimeSeconds: 30, unknown: false },
} as unknown as SiteTaskBriefRecord;

/** Nothing of the site, but text the cleaning would fold or tidy if it touched it: accents, doubled and edge spaces. */
export const FOLDABLE_BRIEF = { ...base,
  summary: "  Move the café trays  to the back shelf ,then wipe the counter .  ",
  operatorAnswers: { where: "Crème room  (north side)" },
} as unknown as SiteTaskBriefRecord;

/** Its unconfirmed parent: the proposals as the reader made them, before the site answered and confirmed. */
export const PROPOSED_BRIEF = { ...base,
  summary: "Stack the 12 kg cartons onto the pallet by the dock.",
  proposed: [{ fieldId: "where", value: "By the dock", basis: "description" }],
  operatorAnswers: null,
} as unknown as SiteTaskBriefRecord;
/** The site confirmed it, accepting the proposal unchanged: a confirmation successor that names its sealed parent. */
export const CONFIRMED_BRIEF = { ...PROPOSED_BRIEF, confirmedAtIso: "2026-11-13T09:00:00.000Z",
  operatorAnswers: { where: "By the dock" } } as unknown as SiteTaskBriefRecord;

/** The site's identity, as a job record holds it (the fixture strings stand for encrypted fields). */
export const SITE = { siteName: "Zorblax Provisions", organisation: "Quillfeather Holdings", first: "Thaddeus", last: "Vexworthy",
  email: "thaddeus.vexworthy@zorblax-plant.example", phone: "+1 (628) 555-0199",
  address: "4417 Marrowbone Avenue, Suite 12, Glimmerton, OR 97035" };
export const IDENTITY_RECORD = { ...RIGHTS_RECORD,
  contact: { firstName: SITE.first, lastName: SITE.last, company: SITE.organisation, email: SITE.email, phone: SITE.phone },
  request: { ...RIGHTS_RECORD.request, siteName: SITE.siteName, siteLocation: SITE.address,
    siteLocationMetadata: { formattedAddress: SITE.address, city: "Glimmerton", postalCode: "97035", country: "US" } } };
/** What none of the cleaned text may carry. */
export const PLANTED = ["Zorblax", "Quillfeather", "Thaddeus", "Vexworthy", "zorblax-plant", "555-0199", "(628)", "Marrowbone",
  "Glimmerton", "97035", "Brindle"];

/** The site types its identity into its sentence, its answers, its object details and its success definition. */
export const IDENTITY_BRIEF = { ...base,
  summary: "Stack 12 kg cartons onto the pallet at Zorblax Provisions, 4417 Marrowbone Avenue, Glimmerton. "
    + "Ask Thaddeus Vexworthy on +1 (628) 555-0199 or thaddeus.vexworthy@zorblax-plant.example. Overflow to 88 Brindle Road.",
  operatorAnswers: { where: "Dock 2 at Zorblax Provisions", contact: "Thaddeus on +1 (628) 555-0199", shifts: "2 shifts" },
  operatorTaskDetails: { item_weight: "about 12 kg", item_make_model: "Quillfeather Holdings own-brand carton" },
  successCriteria: { successDefinition: "Pallet wrapped; Thaddeus signs it off", successRate: 95, cycleTimeSeconds: 40, unknown: false },
} as unknown as SiteTaskBriefRecord;
