/** Small readers for stored Firestore records, shared by the workspace and the job console. */
export function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function iso(value: unknown): string | null {
  if (typeof value === "string" && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString();
  if (value && typeof (value as any).toDate === "function")
    return (value as any).toDate().toISOString();
  return null;
}
