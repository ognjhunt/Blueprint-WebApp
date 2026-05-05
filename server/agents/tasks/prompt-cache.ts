export function buildCacheFriendlyPrompt(params: {
  instructions: string;
  returnShape: Record<string, unknown>;
  payload: unknown;
}) {
  return `${params.instructions.trim()}

Return JSON with this exact shape:
${JSON.stringify(params.returnShape, null, 2)}

Dynamic payload:
${JSON.stringify(params.payload, null, 2)}`;
}
