export type CityLaunchRunPhase = "plan" | "enrich" | "approve" | "activate" | "full";

export function resolveCityLaunchFounderApproval(input: {
  phase: CityLaunchRunPhase;
  founderApprovedFlag?: boolean;
  requireFounderApproval?: boolean;
}) {
  if (input.founderApprovedFlag === true) {
    return true;
  }

  return false;
}

export function shouldDispatchCityLaunchApproval(input: {
  phase: CityLaunchRunPhase;
  founderApproved: boolean;
  requireFounderApproval?: boolean;
}) {
  if (input.founderApproved) {
    return false;
  }

  return (
    input.requireFounderApproval === true
    || input.phase === "approve"
    || input.phase === "activate"
    || input.phase === "full"
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

  return false;
}
