export type MarketplaceQueryParserContext = {
  knownLocationTypes: string[];
  knownPolicies: Array<{ slug: string; title: string }>;
  knownObjectTags: string[];
};

export type MarketplaceQueryParseResult = {
  hard: Record<string, unknown>;
  soft: Record<string, unknown>;
  chips: Array<{ key: string; label: string; value: string }>;
  warnings: string[];
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "data",
  "demos",
  "demo",
  "episodes",
  "episode",
  "for",
  "from",
  "get",
  "i",
  "in",
  "is",
  "it",
  "need",
  "of",
  "on",
  "or",
  "please",
  "show",
  "that",
  "the",
  "to",
  "trajectories",
  "trajectory",
  "want",
  "with",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumberToken(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept "10", "10.5", ".8", "10,000"
  const cleaned = trimmed.replace(/,/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parseCountToken(rawNumber: string, rawSuffix?: string | null): number | null {
  const base = normalizeNumberToken(rawNumber);
  if (base === null) return null;
  const suffix = (rawSuffix || "").trim().toLowerCase();
  const multiplier = suffix === "k" ? 1000 : 1;
  const value = Math.round(base * multiplier);
  return value > 0 ? value : null;
}

function tokenizeForSignals(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t && !STOPWORDS.has(t));
}

function detectLocationType(
  lower: string,
  knownLocationTypes: string[],
): string | null {
  const available = new Set(knownLocationTypes);

  const candidates: Array<{ value: string; patterns: RegExp[] }> = [
    {
      value: "Kitchens",
      patterns: [/\bkitchen(s)?\b/, /\bcommercial kitchen(s)?\b/],
    },
    {
      value: "Grocery / Retail",
      patterns: [
        /\bgrocery\b/,
        /\bretail\b/,
        /\bcheckout\b/,
        /\brestock(ing)?\b/,
      ],
    },
    {
      value: "Warehouses",
      patterns: [
        /\bwarehouse(s)?\b/,
        /\bpallet(izing)?\b/,
        /\bcross[- ]?dock\b/,
        /\bracking\b/,
      ],
    },
    {
      value: "Labs",
      patterns: [/\blab(s)?\b/, /\bassembly\b/, /\bbench\b/],
    },
    {
      value: "Utility Rooms",
      patterns: [/\butility\b/, /\bcontrol panel\b/, /\belectrical panel\b/],
    },
    {
      value: "Home / Assistive",
      patterns: [/\bhome\b/, /\bassistive\b/, /\blaundry\b/],
    },
  ];

  for (const candidate of candidates) {
    if (!available.has(candidate.value)) {
      continue;
    }
    if (candidate.patterns.some((pattern) => pattern.test(lower))) {
      return candidate.value;
    }
  }

  return null;
}

function detectPolicySignal(lower: string, knownPolicies: Array<{ slug: string; title: string }>) {
  const hits: string[] = [];

  for (const policy of knownPolicies) {
    if (!policy?.slug) continue;
    if (lower.includes(policy.slug.toLowerCase())) {
      hits.push(policy.slug);
    }
  }

  const phraseMap: Array<{ patterns: RegExp[]; slug: string }> = [
    {
      slug: "dexterous-pick-place",
      patterns: [/\bpick\s*[- ]?\s*and\s*[- ]?\s*place\b/, /\bpick[- ]?place\b/],
    },
    {
      slug: "mixed-sku-logistics",
      patterns: [/\brestock(ing)?\b/, /\bpallet(izing)?\b/, /\blogistics\b/],
    },
    {
      slug: "laundry-folding-assist",
      patterns: [/\blaundry\b/, /\bfold(ing)?\b/],
    },
    {
      slug: "panel-interaction-suite",
      patterns: [
        /\bpanel interaction\b/,
        /\bcontrol panel\b/,
        /\bswitch toggl(ing|e)\b/,
        /\bbutton pressing\b/,
      ],
    },
  ];

  for (const entry of phraseMap) {
    if (entry.patterns.some((pattern) => pattern.test(lower))) {
      hits.push(entry.slug);
    }
  }

  // Deduplicate but keep stable ordering.
  return Array.from(new Set(hits));
}

function detectRobotModels(lower: string) {
  const robotModels: string[] = [];
  const compatibleWith: string[] = [];

  if (/\bfranka\b|\bpanda\b/.test(lower)) {
    robotModels.push("Franka");
  }
  if (/\bur5\b|\buniversal robot(s)?\b/.test(lower)) {
    robotModels.push("UR5");
  }
  if (/\baloha\b/.test(lower)) {
    robotModels.push("ALOHA");
  }

  if (/\bopenvla\b/.test(lower)) {
    compatibleWith.push("OpenVLA");
  }
  if (/\bpi0\b/.test(lower)) {
    compatibleWith.push("Pi0");
  }
  if (/\bsmolvla\b/.test(lower)) {
    compatibleWith.push("SmolVLA");
  }
  if (/\bgr00t\b/.test(lower)) {
    compatibleWith.push("GR00T");
  }

  return {
    robotModels: Array.from(new Set(robotModels)),
    compatibleWith: Array.from(new Set(compatibleWith)),
  };
}

export function parseMarketplaceQuery(
  q: string,
  ctx: MarketplaceQueryParserContext,
): MarketplaceQueryParseResult {
  const query = (q || "").trim();
  const lower = query.toLowerCase();

  const hard: Record<string, unknown> = {};
  const soft: Record<string, unknown> = {};
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const warnings: string[] = [];

  if (!query) {
    return { hard, soft, chips, warnings };
  }

  // --- Hard: minQualityScore ---
  {
    // Examples: "quality > 0.8", "quality score above 80%", "quality >= .9"
    const match = lower.match(
      /\bquality(?:\s*score)?\s*(?:>=|=>|>|at\s*least|above|over)\s*([0-9]+(?:\.[0-9]+)?|\.[0-9]+)\s*(%)?/,
    );
    if (match) {
      const rawNumber = match[1];
      const rawPercent = match[2];
      const parsed = normalizeNumberToken(rawNumber);
      if (parsed === null) {
        warnings.push("Could not parse quality score threshold.");
      } else {
        const normalized = rawPercent ? parsed / 100 : parsed;
        const clamped = clamp(normalized, 0, 1);
        hard.minQualityScore = clamped;
        chips.push({
          key: "minQualityScore",
          label: "Quality",
          value: `>= ${clamped.toFixed(2)}`,
        });
      }
    } else if (/\bquality\b/.test(lower) && /\b(>=|>|above|over)\b/.test(lower)) {
      // User asked for a quality threshold but we couldn't extract a number.
      warnings.push("Quality threshold detected, but no numeric value found.");
    }
  }

  // --- Hard: minEpisodes ---
  {
    // Examples: "10K demos", "10,000 trajectories", "50k episodes"
    const matches = lower.matchAll(
      /\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?|\.[0-9]+)\s*(k)?\s*(episodes?|demos?|trajector(?:y|ies))\b/g,
    );
    let maxValue: number | null = null;
    for (const match of matches) {
      const value = parseCountToken(match[1], match[2]);
      if (value === null) continue;
      maxValue = maxValue === null ? value : Math.max(maxValue, value);
    }
    if (maxValue !== null) {
      hard.minEpisodes = maxValue;
      chips.push({
        key: "minEpisodes",
        label: "Episodes",
        value: `>= ${maxValue.toLocaleString()}`,
      });
    }
  }

  // --- Hard: locationType (when explicit) ---
  {
    const detected = detectLocationType(lower, ctx.knownLocationTypes);
    if (detected) {
      hard.locationType = detected;
      chips.push({
        key: "locationType",
        label: "Archetype",
        value: detected,
      });
    }
  }

  // --- Soft: tabletop signal (boost-only) ---
  if (/\btabletop\b/.test(lower)) {
    soft.tabletop = true;
    chips.push({
      key: "tabletop",
      label: "Signal",
      value: "tabletop",
    });
  }

  // --- Policy signals ---
  {
    const policyHits = detectPolicySignal(lower, ctx.knownPolicies);
    if (policyHits.length > 0) {
      const wantsEpisodes = /\b(episodes?|demos?|trajector(?:y|ies))\b/.test(lower);
      // If the query is explicitly about demos/trajectories, treat the first hit as a strict filter.
      if (wantsEpisodes) {
        hard.policySlug = policyHits[0];
        chips.push({
          key: "policySlug",
          label: "Policy",
          value: policyHits[0],
        });
      } else {
        soft.policySlugs = policyHits;
        chips.push({
          key: "policySlugs",
          label: "Signal",
          value: `policy: ${policyHits.join(", ")}`,
        });
      }
    }
  }

  // --- Robot/model mentions (boost-only) ---
  {
    const { robotModels, compatibleWith } = detectRobotModels(lower);
    if (robotModels.length > 0) {
      soft.robotModels = robotModels;
      chips.push({
        key: "robotModels",
        label: "Robot",
        value: robotModels.join(", "),
      });
    }
    if (compatibleWith.length > 0) {
      soft.compatibleWith = compatibleWith;
      chips.push({
        key: "compatibleWith",
        label: "Model",
        value: compatibleWith.join(", "),
      });
    }
  }

  // --- Object tag hints (soft) ---
  {
    const tokens = new Set(tokenizeForSignals(query));
    const knownTags = ctx.knownObjectTags || [];
    const hits = knownTags.filter((tag) => tokens.has(tag.toLowerCase()));
    if (hits.length > 0) {
      soft.objectTags = hits.slice(0, 6);
      chips.push({
        key: "objectTags",
        label: "Signal",
        value: `objects: ${hits.slice(0, 3).join(", ")}${hits.length > 3 ? "…" : ""}`,
      });
    }
  }

  return { hard, soft, chips, warnings };
}

