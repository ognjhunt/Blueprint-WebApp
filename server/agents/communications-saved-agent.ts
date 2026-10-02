import { COMMUNICATIONS_MODEL, communicationsDigest } from "./communications-contract";
import { COMMUNICATIONS_DEFINITION } from "./communications-instructions";

/** The saved provider copy is checked against company-owned Git instructions.
 * This binding grants no inference, tools, consent or sending authority. */
export const COMMUNICATIONS_SAVED_AGENT_ID = "agent_a201787af8ff465fa846c694fcfe11870db1c58a4f5c4deea8";
export const COMMUNICATIONS_SAVED_CONFIGURATION = Object.freeze({
  model: COMMUNICATIONS_MODEL, instructions: COMMUNICATIONS_DEFINITION.instructions,
  reasoning: { effort: "max" }, text: { verbosity: "low" },
  tools: [], multi_agent: { enabled: false }, service_tier: "auto",
});
export const COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST = communicationsDigest(COMMUNICATIONS_SAVED_CONFIGURATION);

export function verifiedCommunicationsSavedAgent(value: any) {
  if (value?.id !== COMMUNICATIONS_SAVED_AGENT_ID || value?.model !== COMMUNICATIONS_MODEL
    || value?.instructions !== COMMUNICATIONS_DEFINITION.instructions
    || value?.reasoning?.effort !== "max" || value?.text?.verbosity !== "low"
    || value?.service_tier !== "auto" || !Array.isArray(value?.tools) || value.tools.length !== 0
    || value?.multi_agent?.enabled !== false) throw new Error("communications_saved_agent_definition_changed");
  return { agentId: COMMUNICATIONS_SAVED_AGENT_ID, definitionVersion: COMMUNICATIONS_DEFINITION.version,
    instructionsDigest: COMMUNICATIONS_DEFINITION.instructionsDigest,
    configurationDigest: COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST };
}
