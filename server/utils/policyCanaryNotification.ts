type PolicyCanaryRecord = Record<string, any>;

function text(value: unknown, fallback = "not reported") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function terminalCopy(state: string) {
  if (state === "results_ready") return { subjectState: "results are ready", status: "completed_unqualified" };
  if (state === "cancelled") return { subjectState: "cancelled", status: "cancelled" };
  return { subjectState: "blocked", status: "blocked" };
}

function completedMetrics(record: PolicyCanaryRecord) {
  if (record.state !== "results_ready") return [];
  const projection = record.policy_run_result_projection;
  if (!projection || !Array.isArray(projection.candidate_results)) {
    return ["Completed metrics: unavailable — terminal projection did not include candidate aggregates."];
  }
  return [
    "Completed diagnostic metrics:",
    ...projection.candidate_results.map((candidate: Record<string, any>) => {
      const successes = Number.isInteger(candidate.success_count)
        ? candidate.success_count
        : "not reported";
      const denominator = Number.isInteger(candidate.interpretable_episode_count)
        ? candidate.interpretable_episode_count
        : "not reported";
      const actionDelivery = typeof candidate.action_delivery_rate === "number"
        ? `${Math.round(candidate.action_delivery_rate * 100)}% action delivery`
        : "action delivery not reported";
      return `- ${text(candidate.display_name || candidate.candidate_id)}: ${successes}/${denominator} interpretable successes; ${actionDelivery}.`;
    }),
  ];
}

export function buildPolicyCanaryTerminalEmail(params: {
  record: PolicyCanaryRecord;
  resultUrl: string;
}) {
  const { record, resultUrl } = params;
  const copy = terminalCopy(String(record.state || "blocked"));
  const sceneId = text(record.scene?.id || record.scene_id, "unknown scene");
  const task = record.task
    ? `${text(record.task.id)} · ${text(record.task.label)}`
    : "not reported";
  const robot = text(record.robot?.display_name || record.robot_preset_id);
  const policies = Array.isArray(record.policy_candidates)
    ? record.policy_candidates.map((candidate: Record<string, any>) => (
        text(candidate.display_name || candidate.candidate_id)
      )).join(" vs ")
    : Array.isArray(record.policy_candidate_ids)
      ? record.policy_candidate_ids.map((candidate: unknown) => text(candidate)).join(" vs ")
      : "not reported";
  const episodesPerPolicy = Number(
    record.episode_plan?.episodes_per_policy || 10,
  );
  return {
    title: `Blueprint policy canary ${copy.subjectState}`,
    body: `Scene ${sceneId} policy canary ${copy.status}. Controls pending — results are unqualified.`,
    emailSubject: `Blueprint policy canary ${copy.subjectState} — Scene ${sceneId}`,
    emailText: [
      `Scene: ${sceneId}`,
      `Task: ${task}`,
      `Robot preset: ${robot}`,
      `Policies: ${policies}`,
      `Run size: ${episodesPerPolicy} episodes per policy`,
      `Terminal status: ${copy.status}`,
      "Controls pending — results are unqualified.",
      "This diagnostic run cannot declare a winner, contribute to official ranking, or promote the scene to evaluation ready.",
      ...completedMetrics(record),
      `Open the authenticated result: ${resultUrl}`,
    ].join("\n"),
  };
}
