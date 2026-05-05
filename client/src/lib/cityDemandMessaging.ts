export type DemandCityKey = "austin" | "san-francisco";

export interface DemandCityMessaging {
  key: DemandCityKey;
  label: string;
  shortLabel: string;
  proofHeading: string;
  proofBody: string;
  proofPoints: string[];
  requestHeroTitle: string;
  requestHeroBody: string;
  requestResponseBody: string;
  requestCardTitle: string;
  requestCardBody: string;
  requestCardPoints: string[];
}

const DEMAND_CITY_MESSAGING: Record<DemandCityKey, DemandCityMessaging> = {
  austin: {
    key: "austin",
    label: "Austin, TX",
    shortLabel: "Austin",
    proofHeading: "Austin demand is relationship-led, so the proof needs to get specific fast.",
    proofBody:
      "For Austin buyer work, lead with one exact site, the facility type, and a proof path that is easy to inspect after a Texas Robotics, founder, university, or industrial intro.",
    proofPoints: [
      "Name the referral path up front when the motion came through Texas Robotics, a founder intro, a university contact, or an industrial partner.",
      "Keep facility type, recency, and provenance visible before broader world-model framing.",
      "A fast hosted-review path matters more here than broad awareness copy.",
    ],
    requestHeroTitle: "Give the Austin buyer enough exact-site proof to move quickly.",
    requestHeroBody:
      "Use this form to anchor the request in one real facility, the exact workflow question, and the trust path behind the intro. Austin buyers are more likely to respond to high-trust proof than to broad product positioning.",
    requestResponseBody:
      "Blueprint reviews the site, workflow, and intro context first so the follow-up can stay narrow: exact-site proof path, provenance clarity, and a fast hosted-review next step if the request looks workable.",
    requestCardTitle: "Austin request lens",
    requestCardBody:
      "This city leans on high-trust introductions rather than mass demand, so the request should make the exact-site relevance clear right away.",
    requestCardPoints: [
      "Reference whether the request came through Texas Robotics, a founder intro, a university contact, or an industrial partner.",
      "Call out the facility type and what exact-site proof the buyer needs before deeper work.",
      "Keep rights, privacy, and provenance visible without turning the request into a qualification worksheet.",
    ],
  },
  "san-francisco": {
    key: "san-francisco",
    label: "San Francisco, CA",
    shortLabel: "San Francisco",
    proofHeading: "San Francisco buyers will pressure-test technical clarity immediately.",
    proofBody:
      "For San Francisco buyer work, lead with exact-site proof, current-stack fit, and what can be reviewed asynchronously after a BARA-style matchmaking, founder, or partner referral.",
    proofPoints: [
      "Make it clear whether the motion came through buyer matchmaking, a founder intro, a proof-led event, or a partner referral.",
      "Put exact-site proof, stack compatibility, and async sample review ahead of generic AI language.",
      "Raise human-gated commercialization, privacy, and access topics earlier instead of burying them.",
    ],
    requestHeroTitle: "Frame the San Francisco request for a technical buyer fast.",
    requestHeroBody:
      "Use this form to anchor the request in one real site, the current stack, and the exact review question. San Francisco buyers will move faster when the proof path is technical, specific, and honest about what still needs human approval.",
    requestResponseBody:
      "Blueprint reviews the site, workflow, and technical constraints first so the reply can point toward package access, hosted evaluation, or a narrow follow-up on stack fit and human-gated topics.",
    requestCardTitle: "San Francisco request lens",
    requestCardBody:
      "This city has denser buyer and partner channels, but the proof needs to hold up under sharper technical scrutiny.",
    requestCardPoints: [
      "Name the current stack or review workflow when async sample review matters to the buyer.",
      "Be explicit about the exact-site requirement versus an adjacent-site proof path.",
      "Raise commercialization, rights, privacy, or sensitive access topics early when they are likely to slow a serious follow-up.",
    ],
  },
};

export function normalizeDemandCity(value: string | null | undefined): DemandCityKey | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (!normalized) return null;

  if (["austin", "austin-tx"].includes(normalized)) {
    return "austin";
  }

  if (
    [
      "san-francisco",
      "san-francisco-ca",
      "sf",
      "bay-area",
      "san-francisco-bay-area",
    ].includes(normalized)
  ) {
    return "san-francisco";
  }

  return null;
}

export function getDemandCityMessaging(
  value: string | null | undefined,
): DemandCityMessaging | null {
  const cityKey = normalizeDemandCity(value);
  return cityKey ? DEMAND_CITY_MESSAGING[cityKey] : null;
}

export function withDemandCityQuery(href: string, cityKey: DemandCityKey | null): string {
  if (!cityKey) return href;

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}city=${cityKey}`;
}
