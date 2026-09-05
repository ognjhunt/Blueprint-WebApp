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
    settle_task_contact_cleared?: boolean;
    settled?: boolean;
    released?: boolean;
    native_safety_ok?: boolean;
    retreat?: {
      satisfied?: boolean;
      readback_complete?: boolean;
      minimum_observed_clearance_m?: number | null;
      required_clearance_m?: number;
    };
  };
  failure_reason_plain_english?: string | null;
  failed_criteria?: string[];
  task_success_contract?: {
    criteria?: {
      temporal_invariants?: { no_drop?: { mode?: "required" | "ignored" } };
      gripper_state?: { mode?: "released" | "closed_at_most" | "ignored" };
      terminal_task_contact?: { mode?: "cleared" | "maintained" | "ignored" };
      retreat?: { mode?: "required"; minimum_clearance_m?: number };
    };
  };
  event_ledger?: {
    drop_events?: Array<{
      step_index?: number;
      contact_lost_step?: number;
      unsupported_started_step?: number;
      minimum_height_step?: number;
      support_recontact_step?: number | null;
      time_seconds?: number;
      unsupported_started_time_seconds?: number;
      support_recontact_time_seconds?: number;
      fall_m?: number;
      [key: string]: unknown;
    }>;
    peak_task_contact_force_n?: number | null;
    observed_contact_classes?: string[];
    observed_forbidden_contact_classes?: string[];
    containment_excursion_steps?: number[];
    workspace_excursion_steps?: number[];
    maximum_retries_observed?: number | null;
    maximum_regrasps_observed?: number | null;
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
  const drops = receipt.event_ledger?.drop_events || [];
  const noDropRequired = receipt.task_success_contract?.criteria?.temporal_invariants
    ?.no_drop?.mode === "required";

  let title = "Task was not completed";
  let explanation = "The deterministic scorer did not report a more specific terminal reason.";
  let tone: PolicyCanaryEpisodeOutcomeSummary["tone"] = "block";

  if (receipt.task_succeeded === true || outcome === "placed_and_settled") {
    title = drops.length ? "Task completed after an unsupported fall" : "Task completed";
    explanation = drops.length
      ? `The event ledger recorded ${drops.length} unsupported fall${drops.length === 1 ? "" : "s"}; the object then recovered and satisfied the terminal task criteria. This contract did not prohibit that event.`
      : "The object finished inside the target and satisfied the deterministic terminal criteria.";
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
  } else if (outcome === "native_retreat_readback_missing") {
    title = "Gripper retreat result unavailable";
    explanation = "The native position and contact measurements needed to verify gripper clearance were incomplete.";
    tone = "warn";
  }
  if (receipt.task_succeeded === false && receipt.failure_reason_plain_english) {
    explanation = receipt.failure_reason_plain_english;
  }

  const facts = [
    { label: "Object moved", value: centimeters(measurements.maximum_translation_m) },
    { label: "Maximum lift", value: centimeters(measurements.maximum_lift_m) },
    { label: "Inside target", value: yesNo(measurements.settle_destination_inside) },
  ];
  if (receipt.task_success_contract?.criteria?.gripper_state?.mode === "released") {
    facts.push({ label: "Released", value: yesNo(measurements.released) });
  }
  if (receipt.task_success_contract?.criteria?.terminal_task_contact?.mode === "cleared") {
    facts.push({
      label: "Final robot contact cleared",
      value: yesNo(measurements.settle_task_contact_cleared),
    });
  }
  if (receipt.task_success_contract?.criteria?.retreat?.mode === "required") {
    const retreat = measurements.retreat;
    facts.push(
      { label: "Gripper retreat verified", value: retreat?.readback_complete === true
        ? yesNo(retreat.satisfied) : "Not reported" },
      { label: "Minimum gripper clearance", value: centimeters(retreat?.minimum_observed_clearance_m) },
      { label: "Required gripper clearance", value: centimeters(
        receipt.task_success_contract.criteria.retreat.minimum_clearance_m,
      ) },
    );
  }
  facts.push(
    { label: "Support height valid", value: yesNo(measurements.settle_support_height_ok) },
    { label: "Safety checks passed", value: yesNo(measurements.native_safety_ok) },
    {
      label: "Unsupported falls",
      value: drops.length
        ? `${drops.length} unsupported fall${drops.length === 1 ? "" : "s"} · ${noDropRequired ? "prohibited" : "recovery allowed"}`
        : "None observed",
    },
    {
      label: "Peak task force",
      value: typeof receipt.event_ledger?.peak_task_contact_force_n === "number"
        ? `${receipt.event_ledger.peak_task_contact_force_n.toFixed(2)} N`
        : "Not reported",
    },
    {
      label: "Failed criteria",
      value: receipt.failed_criteria?.length
        ? receipt.failed_criteria.map((value) => value.replaceAll("_", " ")).join(", ")
        : "None",
    },
    {
      label: "Observed contacts",
      value: receipt.event_ledger?.observed_contact_classes?.length
        ? receipt.event_ledger.observed_contact_classes.join(", ")
        : "None reported",
    },
    {
      label: "Containment / workspace excursions",
      value: `${receipt.event_ledger?.containment_excursion_steps?.length || 0} / ${receipt.event_ledger?.workspace_excursion_steps?.length || 0}`,
    },
    {
      label: "Retries / regrasps",
      value: `${receipt.event_ledger?.maximum_retries_observed ?? "Not reported"} / ${receipt.event_ledger?.maximum_regrasps_observed ?? "Not reported"}`,
    },
  );
  drops.forEach((event, index) => {
    const startStep = event.unsupported_started_step ?? event.contact_lost_step ?? event.step_index;
    const endStep = event.support_recontact_step ?? event.minimum_height_step;
    const startTime = event.unsupported_started_time_seconds ?? event.time_seconds;
    const endTime = event.support_recontact_time_seconds;
    const stepText = typeof startStep === "number"
      ? `step${typeof endStep === "number" && endStep !== startStep ? `s ${startStep}–${endStep}` : ` ${startStep}`}`
      : "step unavailable";
    const timeText = typeof startTime === "number"
      ? ` · ${startTime.toFixed(2)}${typeof endTime === "number" && endTime !== startTime ? `–${endTime.toFixed(2)}` : ""} s`
      : "";
    facts.push({
      label: `Unsupported fall ${index + 1}`,
      value: `${centimeters(event.fall_m)} · ${stepText}${timeText}`,
    });
  });
  return {
    title,
    explanation,
    tone,
    facts,
  };
}
