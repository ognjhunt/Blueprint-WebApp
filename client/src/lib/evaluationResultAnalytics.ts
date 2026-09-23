/** The Pipeline candidate registry's order; any two of these can be compared. */
export const POLICY_CANDIDATE_ORDER = [
  "pi05_droid",
  "groot_n17_droid",
  "cosmos3_nano_policy_droid",
  "molmoact2_droid",
  "flux3_action_droid",
] as const;

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
  const index = (POLICY_CANDIDATE_ORDER as readonly string[]).indexOf(candidateId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
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
  // Paired outcomes compare the run's first two policies, whichever they are.
  const [firstId = null, secondId = null] = candidateIds;
  let comparablePairs = 0;
  let discordantPairs = 0;
  let firstWins = 0;
  let secondWins = 0;
  for (const outcomes of pairs.values()) {
    const first = firstId === null ? undefined : outcomes.get(firstId);
    const second = secondId === null ? undefined : outcomes.get(secondId);
    if (typeof first !== "boolean" || typeof second !== "boolean") continue;
    comparablePairs += 1;
    if (first === second) continue;
    discordantPairs += 1;
    if (first) firstWins += 1;
    else secondWins += 1;
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
      firstId,
      secondId,
      firstWins,
      secondWins,
    },
  };
}
