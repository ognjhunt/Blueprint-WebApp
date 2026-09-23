/**
 * Why a planned run cannot be paid for yet, in words a robot team can act on.
 *
 * The plan returns machine codes per site (`lineBlockers`). Showing those raw,
 * or collapsing them all into "not ready, check back soon", leaves a team with
 * nothing to do. Each code maps to the one sentence that says who has to act:
 * the team (connect an account, send a runnable policy), the site owner, or us.
 */
const MESSAGES: Array<{ match: (code: string) => boolean; text: string; rank: number }> = [
  {
    match: (code) => code === "team_account_required",
    text: "Connect a verified Blueprint account above to run this plan.",
    rank: 0,
  },
  {
    match: (code) => code === "agent_execution_checkpoint_runtime_not_admissible",
    text: "Paid runs need your policy as an endpoint we can call or a container image. A model artifact can't be run yet; register one of the others to continue.",
    rank: 1,
  },
  {
    match: (code) => code === "site_rights_not_cleared",
    text: "The site owner hasn't cleared this task for robot evaluation yet. Nothing is charged.",
    rank: 2,
  },
  {
    match: (code) => code === "agent_execution_store_unavailable" || code === "agent_execution_preparation_unavailable",
    text: "We couldn't prepare this run just now. Nothing is charged; try again in a few minutes.",
    rank: 4,
  },
];

const SCENE_NOT_READY =
  "This site's simulation scene isn't ready for paid runs yet. Nothing is charged, and the plan stays free to read.";

/** The single most useful sentence for a set of blocker codes. */
export function describeRunBlockers(codes: readonly string[]): string | null {
  if (!codes.length) return null;
  let best: { text: string; rank: number } | null = null;
  for (const code of codes) {
    const known = MESSAGES.find((message) => message.match(code));
    const candidate = known ?? { text: SCENE_NOT_READY, rank: 3 };
    if (!best || candidate.rank < best.rank) best = candidate;
  }
  return best?.text ?? null;
}

/** One sentence per distinct reason across a plan's rows, most actionable first. */
export function describePlanBlockers(
  lineBlockers: ReadonlyArray<{ sceneId: string; blockers: readonly string[] }> | undefined,
): string[] {
  const sentences = new Set<string>();
  for (const line of lineBlockers ?? []) {
    const sentence = describeRunBlockers(line.blockers);
    if (sentence) sentences.add(sentence);
  }
  return [...sentences];
}
