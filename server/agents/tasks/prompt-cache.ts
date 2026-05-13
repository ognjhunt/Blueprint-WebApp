export function buildCacheFriendlyPrompt(params: {
  instructions: string;
  returnShape: Record<string, unknown>;
  payload: unknown;
}) {
  const stableStringify = (value: unknown): string => JSON.stringify(sortForStablePrompt(value), null, 2);

  return `${params.instructions.trim()}

Return JSON with this exact shape:
${stableStringify(params.returnShape)}

Dynamic payload:
${stableStringify(params.payload)}`;
}

function sortForStablePrompt(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStablePrompt);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortForStablePrompt(entry)]);
  return Object.fromEntries(entries);
}
