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

export function formatTaskEvaluationMaxSpend(value: number): string {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "2.00";
}

export function taskEvaluationSpendCoversProfile(
  approvedValue: string,
  requiredValue: number | undefined,
): boolean {
  const approved = Number(approvedValue);
  return Number.isFinite(approved)
    && approved > 0
    && (requiredValue === undefined || approved >= requiredValue);
}
