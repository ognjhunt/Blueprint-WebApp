const DEFAULT_AUTHORITY_WINDOW_MS = 6 * 60 * 60 * 1000;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalDateTimeValue(value: Date): string {
  return [
    value.getFullYear(),
    "-",
    padDatePart(value.getMonth() + 1),
    "-",
    padDatePart(value.getDate()),
    "T",
    padDatePart(value.getHours()),
    ":",
    padDatePart(value.getMinutes()),
  ].join("");
}

export function defaultTaskEvaluationAuthorityExpiry(
  now = new Date(),
): string {
  return formatLocalDateTimeValue(
    new Date(now.getTime() + DEFAULT_AUTHORITY_WINDOW_MS),
  );
}

type RequiredAuthorizationCarrier = {
  required_authorization?: { max_spend_usd?: unknown } | null;
} | null | undefined;

export function requiredTaskEvaluationMaxSpendUsd(
  profile: RequiredAuthorizationCarrier,
): number | null {
  const value = profile?.required_authorization?.max_spend_usd;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function prefillTaskEvaluationMaxSpend(
  profile: RequiredAuthorizationCarrier,
  current: string,
): string {
  const required = requiredTaskEvaluationMaxSpendUsd(profile);
  if (required === null) return current;
  return required.toFixed(2);
}
