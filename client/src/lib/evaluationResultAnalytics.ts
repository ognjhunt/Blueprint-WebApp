export const CANONICAL_POLICY_CANDIDATE_IDS = [
  "pi05_droid",
  "groot_n17_droid",
] as const;

export type CanonicalPolicyCandidateId = typeof CANONICAL_POLICY_CANDIDATE_IDS[number];

export type EvaluationEpisodeForAnalytics = {
  episode_id: string;
  episode_kind: "control" | "learned_candidate";
  subject_id: string;
  score: {
    task_succeeded?: boolean | null;
  };
  variation?: {
    cell_id: string;
    family_id: string;
    label?: string;
    seed?: number;
  };
  metrics?: {
    contact_count?: number | null;
  };
  failure?: {
    code: string;
    phase?: string;
    summary?: string;
  } | null;
  evidence?: {
    complete?: boolean;
  };
};

export type CandidateMetricSummary = {
  candidateId: string;
  scoredEpisodes: number;
  successfulEpisodes: number;
  successRate: number | null;
  failureCount: number;
  contactCount: number | null;
  evidenceCompleteEpisodes: number;
};

export type VariationFamilySummary = {
  familyId: string;
  label: string;
  candidates: CandidateMetricSummary[];
};

function summarizeCandidate(
  episodes: EvaluationEpisodeForAnalytics[],
  candidateId: string,
): CandidateMetricSummary {
  const candidateEpisodes = episodes.filter((episode) => episode.subject_id === candidateId);
  const scored = candidateEpisodes.filter((episode) => typeof episode.score.task_succeeded === "boolean");
  const successfulEpisodes = scored.filter((episode) => episode.score.task_succeeded).length;
  const reportedContacts = candidateEpisodes
    .map((episode) => episode.metrics?.contact_count)
    .filter((count): count is number => typeof count === "number" && Number.isFinite(count));
  return {
    candidateId,
    scoredEpisodes: scored.length,
    successfulEpisodes,
    successRate: scored.length ? successfulEpisodes / scored.length : null,
    failureCount: candidateEpisodes.filter((episode) => episode.failure).length,
    contactCount: reportedContacts.length
      ? reportedContacts.reduce((total, count) => total + count, 0)
      : null,
    evidenceCompleteEpisodes: candidateEpisodes.filter((episode) => episode.evidence?.complete).length,
  };
}

function candidateOrder(candidateId: string) {
  const canonicalIndex = CANONICAL_POLICY_CANDIDATE_IDS.indexOf(
    candidateId as CanonicalPolicyCandidateId,
  );
  return canonicalIndex === -1 ? Number.MAX_SAFE_INTEGER : canonicalIndex;
}

function orderedCandidateIds(episodes: EvaluationEpisodeForAnalytics[]) {
  const observed = new Set(
    episodes
      .filter((episode) => episode.episode_kind === "learned_candidate")
      .map((episode) => episode.subject_id),
  );
  return [...observed].sort((left, right) => (
    candidateOrder(left) - candidateOrder(right) || left.localeCompare(right)
  ));
}

export function buildEvaluationResultAnalytics(episodes: EvaluationEpisodeForAnalytics[]) {
  const learnedEpisodes = episodes.filter((episode) => episode.episode_kind === "learned_candidate");
  const candidateIds = orderedCandidateIds(learnedEpisodes);
  const familyIds = [...new Set(
    learnedEpisodes
      .map((episode) => episode.variation?.family_id)
      .filter((familyId): familyId is string => Boolean(familyId)),
  )];
  const failures = new Map<string, number>();
  const pairs = new Map<string, Map<string, boolean>>();
  for (const episode of learnedEpisodes) {
    if (!episode.failure?.code) continue;
    failures.set(episode.failure.code, (failures.get(episode.failure.code) ?? 0) + 1);
  }
  for (const episode of learnedEpisodes) {
    if (
      !episode.variation?.cell_id
      || typeof episode.variation.seed !== "number"
      || typeof episode.score.task_succeeded !== "boolean"
    ) continue;
    const key = `${episode.variation.cell_id}\0${episode.variation.seed}`;
    const outcomes = pairs.get(key) ?? new Map<string, boolean>();
    outcomes.set(episode.subject_id, episode.score.task_succeeded);
    pairs.set(key, outcomes);
  }
  let comparablePairs = 0;
  let discordantPairs = 0;
  let pi05Wins = 0;
  let grootWins = 0;
  for (const outcomes of pairs.values()) {
    const pi05 = outcomes.get("pi05_droid");
    const groot = outcomes.get("groot_n17_droid");
    if (typeof pi05 !== "boolean" || typeof groot !== "boolean") continue;
    comparablePairs += 1;
    if (pi05 === groot) continue;
    discordantPairs += 1;
    if (pi05) pi05Wins += 1;
    else grootWins += 1;
  }

  return {
    candidates: candidateIds.map((candidateId) => summarizeCandidate(learnedEpisodes, candidateId)),
    families: familyIds.map((familyId): VariationFamilySummary => {
      const familyEpisodes = learnedEpisodes.filter(
        (episode) => episode.variation?.family_id === familyId,
      );
      return {
        familyId,
        label: familyEpisodes.find((episode) => episode.variation?.label)?.variation?.label
          ?? familyId.replaceAll("_", " "),
        candidates: candidateIds.map((candidateId) => summarizeCandidate(familyEpisodes, candidateId)),
      };
    }),
    failures: [...failures.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code)),
    controlEpisodes: episodes.filter((episode) => episode.episode_kind === "control").length,
    paired: {
      comparablePairs,
      discordantPairs,
      ties: comparablePairs - discordantPairs,
      pi05Wins,
      grootWins,
    },
  };
}
