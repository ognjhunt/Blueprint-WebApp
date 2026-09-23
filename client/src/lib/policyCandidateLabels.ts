/**
 * Display names for policy candidates. A run can compare any two policies
 * from the Pipeline's candidate registry, so pages never assume which two:
 * they use the name the run delivered, then this list, then the identifier.
 */
const KNOWN_POLICY_LABELS: Record<string, string> = {
  pi05_droid: "π0.5 DROID",
  groot_n17_droid: "GR00T N1.7 DROID",
  cosmos3_nano_policy_droid: "Cosmos 3 Nano Policy DROID",
  molmoact2_droid: "MolmoAct 2 DROID",
  flux3_action_droid: "FLUX 3 Action DROID",
};

export function policyCandidateLabel(candidateId: string, displayName?: string | null) {
  const delivered = displayName?.trim();
  if (delivered && delivered !== candidateId) return delivered;
  return KNOWN_POLICY_LABELS[candidateId] ?? candidateId.replaceAll("_", " ");
}
