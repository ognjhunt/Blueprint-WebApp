/** A stopped preparation attempt, never a policy score or physical verdict. */
export type TaskOutcome = {
  category: "robot_incompatibility" | "insufficient_evidence" | "processing_failure";
  basis: "conservative_configuration_check" | "missing_evidence" | "execution_failure";
  title: string;
  reason: string;
  scope: string;
  nextStep: string;
  actionOwner: "blueprint" | "site";
  evidence: { label: string; digest: string }[];
  reference?: string;
};
