/** A stopped preparation attempt, never a policy score or physical verdict. */
export type TaskOutcome = {
  /** `held`: Blueprint cannot simulate this kind of job yet; never a robot verdict. */
  category: "robot_incompatibility" | "insufficient_evidence" | "processing_failure" | "held";
  basis: "conservative_configuration_check" | "conservative_pre_spend_fit_check" | "missing_evidence" | "execution_failure"
    | "simulation_not_available";
  title: string;
  reason: string;
  scope: string;
  nextStep: string;
  /** `none`: a hold with no step scheduled for anyone. */
  actionOwner: "blueprint" | "site" | "none";
  evidence: { label: string; digest: string }[];
  reference?: string;
};
