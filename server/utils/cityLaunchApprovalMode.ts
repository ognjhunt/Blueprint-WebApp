export type CityLaunchRunPhase = "plan" | "enrich" | "approve" | "activate" | "full";

export function resolveCityLaunchFounderApproval(input: {
  phase: CityLaunchRunPhase;
  founderApprovedFlag?: boolean;
  requireFounderApproval?: boolean;
}) {
  if (input.founderApprovedFlag === true) {
    return true;
  }

  if (input.phase === "plan" || input.phase === "approve") {
    return false;
  }

  return input.requireFounderApproval !== true;
}

export function shouldDispatchCityLaunchApproval(input: {
  phase: CityLaunchRunPhase;
  founderApproved: boolean;
  requireFounderApproval?: boolean;
}) {
  return (
    input.requireFounderApproval === true
    && input.founderApproved !== true
    && (input.phase === "approve" || input.phase === "full")
  );
}

export function resolveCityLaunchActivationFounderApproval(input: {
  founderApproved?: unknown;
  requireFounderApproval?: unknown;
}) {
  if (input.founderApproved === true) {
    return true;
  }

  if (input.founderApproved === false) {
    return false;
  }

  return input.requireFounderApproval !== true;
}
