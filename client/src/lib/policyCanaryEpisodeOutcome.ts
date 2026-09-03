export type PolicyCanaryScoreReceipt = {
  status?: string;
  outcome?: string;
  task_succeeded?: boolean;
  measurements?: {
    maximum_translation_m?: number;
    maximum_lift_m?: number;
    settle_destination_inside?: boolean;
    settle_orientation_ok?: boolean;
    settle_support_height_ok?: boolean;
    settle_support_contact_ok?: boolean;
    settled?: boolean;
    released?: boolean;
    native_safety_ok?: boolean;
  };
};

export type PolicyCanaryEpisodeOutcomeSummary = {
  title: string;
  explanation: string;
  facts: Array<{ label: string; value: string }>;
  tone: "proof" | "warn" | "block";
};

function centimeters(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)} cm`
    : "Not reported";
}

function yesNo(value: unknown) {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : "Not reported";
}

export function humanPolicyCanaryEpisodeOutcome(
  receipt: PolicyCanaryScoreReceipt,
): PolicyCanaryEpisodeOutcomeSummary {
  const measurements = receipt.measurements || {};
  const outcome = String(receipt.outcome || "").trim();
  const outsideTarget = measurements.settle_destination_inside === false;
  const supportFailed = measurements.settle_support_height_ok === false;
  const orientationFailed = measurements.settle_orientation_ok === false;
  const liftedMeaningfully = Number(measurements.maximum_lift_m || 0) >= 0.02;

  let title = "Task was not completed";
  let explanation = "The deterministic scorer did not report a more specific terminal reason.";
  let tone: PolicyCanaryEpisodeOutcomeSummary["tone"] = "block";

  if (receipt.task_succeeded === true || outcome === "placed_and_settled") {
    title = "Task completed";
    explanation = "The object finished inside the target, settled safely, and the robot released it.";
    tone = "proof";
  } else if (outcome === "collision_or_containment_failure") {
    title = "Collision or workspace violation";
    explanation = "The run crossed a deterministic safety or containment boundary before completing the task.";
  } else if (outcome === "release_incomplete") {
    title = "Reached the target, but did not release";
    explanation = "The object finished inside the target, but the robot did not release and move clear, so the final placement was not independently settled.";
  } else if (
    outcome === "moved_below_success_contract"
    && supportFailed
    && orientationFailed
  ) {
    title = liftedMeaningfully ? "Dropped or toppled the object" : "Knocked the object over";
    explanation = outsideTarget
      ? "The object ended below the allowed support height, at the wrong orientation, and outside the target."
      : "The object ended below the allowed support height and at the wrong orientation.";
  } else if (outcome === "moved_below_success_contract" && outsideTarget) {
    title = "Moved the object, but missed the target";
    explanation = "The object moved during the episode but did not finish inside the target region.";
  } else if (outcome === "never_moved") {
    title = "The object did not move";
    explanation = "Robot actions were delivered, but the object never moved far enough to count as task progress.";
  } else if (outcome === "native_safety_readback_missing") {
    title = "Safety result unavailable";
    explanation = "The episode ran, but the native safety readback needed to interpret the outcome was not delivered.";
    tone = "warn";
  } else if (outcome === "native_support_contact_readback_missing") {
    title = "Support-contact result unavailable";
    explanation = "The episode ran, but the support-contact readback needed to interpret the final object state was not delivered.";
    tone = "warn";
  }

  return {
    title,
    explanation,
    tone,
    facts: [
      { label: "Object moved", value: centimeters(measurements.maximum_translation_m) },
      { label: "Maximum lift", value: centimeters(measurements.maximum_lift_m) },
      { label: "Inside target", value: yesNo(measurements.settle_destination_inside) },
      { label: "Released", value: yesNo(measurements.released) },
      { label: "Support height valid", value: yesNo(measurements.settle_support_height_ok) },
      { label: "Safety checks passed", value: yesNo(measurements.native_safety_ok) },
    ],
  };
}
