import { getConfiguredEnvValue } from "../config/env";
import type {
  ParsedCityLaunchBuyerTarget,
  ParsedCityLaunchCaptureCandidate,
} from "./cityLaunchResearchParser";

type ContactEvidence = {
  recipientEmail: string;
  source: string;
};

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getAllowedHosts() {
  const configured = getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS") || "";
  return configured
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getSearchAllowedHosts() {
  const configured = getConfiguredEnvValue(
    "BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS",
  ) || "";
  return configured
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getSearchUrl() {
  return getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_URL") || "";
}

function getExplicitEmailsFromHtml(html: string) {
  const matches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((entry) => entry.trim().toLowerCase()))];
}

function hostAllowed(url: URL, allowedHosts: string[]) {
  const hostname = url.hostname.toLowerCase();
  return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function extractCandidateUrlsFromSearchHtml(input: {
  html: string;
  allowedHosts: string[];
}) {
  const hrefs = [...input.html.matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => match[1]?.trim() || "")
    .filter(Boolean);
  const candidates: string[] = [];

  for (const href of hrefs) {
    try {
      const url = new URL(href);
      if (!hostAllowed(url, input.allowedHosts)) {
        continue;
      }
      if (!/contact|team|about|people|company|leadership|staff/i.test(url.pathname)) {
        continue;
      }
      candidates.push(url.href);
    } catch {
      continue;
    }
  }

  return [...new Set(candidates)];
}

function scoreCandidateContactPage(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    let score = 0;

    if (/contact|email|reach-us|get-in-touch/.test(pathname)) {
      score += 100;
    }
    if (/support|sales|business|partnerships/.test(pathname)) {
      score += 60;
    }
    if (/team|people|staff|leadership/.test(pathname)) {
      score += 35;
    }
    if (/about|company/.test(pathname)) {
      score += 15;
    }
    if (/blog|news|press|careers|jobs|legal|privacy/.test(pathname)) {
      score -= 40;
    }

    return score;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

function rankCandidateContactPages(urls: string[]) {
  return [...urls].sort((left, right) => {
    const scoreDelta = scoreCandidateContactPage(right) - scoreCandidateContactPage(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.localeCompare(right);
  });
}

async function discoverCandidatePagesViaGovernedSearch(input: {
  label: string;
  allowedHosts: string[];
}) {
  if (getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ENABLED") !== "1") {
    return [];
  }

  const searchUrl = getSearchUrl();
  if (!searchUrl) {
    return [];
  }

  const searchAllowedHosts = getSearchAllowedHosts();
  try {
    const providerUrl = new URL(searchUrl);
    if (searchAllowedHosts.length === 0 || !hostAllowed(providerUrl, searchAllowedHosts)) {
      return [];
    }

    const query = input.allowedHosts
      .map((host) => `site:${host} "${input.label}" (contact OR team OR about OR email)`)
      .join(" OR ");
    providerUrl.searchParams.set("q", query);

    const response = await fetch(providerUrl.href, {
      method: "GET",
      headers: {
        "User-Agent": "Blueprint city-launch contact discovery search",
      },
    });
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return extractCandidateUrlsFromSearchHtml({
      html,
      allowedHosts: input.allowedHosts,
    });
  } catch {
    return [];
  }
}

async function fetchExplicitEmail(url: string, allowedHosts: string[]) {
  try {
    const parsed = new URL(url);
    if (!hostAllowed(parsed, allowedHosts)) {
      return null;
    }
    const response = await fetch(parsed.href, {
      method: "GET",
      headers: {
        "User-Agent": "Blueprint city-launch contact discovery",
      },
    });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const emails = getExplicitEmailsFromHtml(html);
    if (emails.length === 0) {
      return null;
    }
    return {
      recipientEmail: emails[0],
      source: `Recipient sourced from explicit public contact evidence at ${parsed.href}.`,
    } satisfies ContactEvidence;
  } catch {
    return null;
  }
}

export async function discoverGovernedExternalContactEvidence(input: {
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
}) {
  if (getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ENABLED") !== "1") {
    return {
      matches: new Map<string, ContactEvidence>(),
      warnings: [],
    };
  }

  const allowedHosts = getAllowedHosts();
  if (allowedHosts.length === 0) {
    return {
      matches: new Map<string, ContactEvidence>(),
      warnings: [
        "No governed external directory hosts are configured for city-launch contact discovery.",
      ],
    };
  }

  const entries = [
    ...input.buyerTargets
      .filter((entry) => !entry.contactEmail)
      .map((entry) => ({
        key: normalizeComparableText(entry.companyName),
        label: entry.companyName,
        urls: entry.sourceUrls,
      })),
    ...input.captureCandidates
      .filter((entry) => !entry.contactEmail)
      .map((entry) => ({
        key: normalizeComparableText(entry.name),
        label: entry.name,
        urls: entry.sourceUrls,
      })),
  ];

  const matches = new Map<string, ContactEvidence>();
  for (const entry of entries) {
    const candidateUrls = [
      ...entry.urls,
      ...(await discoverCandidatePagesViaGovernedSearch({
        label: entry.label,
        allowedHosts,
      })),
    ];
    for (const url of rankCandidateContactPages([...new Set(candidateUrls)])) {
      const evidence = await fetchExplicitEmail(url, allowedHosts);
      if (evidence) {
        matches.set(entry.key, evidence);
        break;
      }
    }
  }

  return {
    matches,
    warnings: [],
  };
}
