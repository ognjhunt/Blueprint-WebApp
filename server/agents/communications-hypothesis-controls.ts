/** Owner-controlled, default-off brake for hypothesis inference and contact research. */
export const HYPOTHESIS_DRAFTS_FLAG = "BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED";
export const HYPOTHESIS_DRAFTS_DISABLED = "hypothesis_drafts_disabled";
export const hypothesisDraftsEnabled = () => process.env[HYPOTHESIS_DRAFTS_FLAG] === "true";
