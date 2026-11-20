import { z } from "zod";

// Exact categorical declarations and interests; never verified performance.
export const targetingDimensions = ["roles", "regions", "industries", "embodiments", "policyCategories", "taskFamilies", "capabilities"] as const;
export type TargetingDimension = typeof targetingDimensions[number];
const categories = z.array(z.string().trim().min(1).max(80)).max(30);
export const targetingCategoriesSchema = z.object({
  roles: categories.optional(), regions: categories.optional(), industries: categories.optional(),
  embodiments: categories.optional(), policyCategories: categories.optional(),
  taskFamilies: categories.optional(), capabilities: categories.optional(),
}).strict();
export type TargetingCategories = z.infer<typeof targetingCategoriesSchema>;
export const retentionRequirementsSchema = z.object({
  maxRetentionDays: z.number().int().min(0).max(36500).optional(),
  noTraining: z.boolean().optional(), requiredRightsScopes: categories.optional(),
}).strict();
export const updatePreferencesInputSchema = z.object({
  newsletter: z.boolean(), newJobAlerts: z.boolean(),
  interests: targetingCategoriesSchema.default({}),
  declaredCategories: targetingCategoriesSchema.default({}),
  requirements: retentionRequirementsSchema.default({}),
}).strict();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesInputSchema>;
/**
 * v1: one box bundled job emails with Blueprint updates, off unless ticked. v2 (owner, 2026-11-20): job emails are on
 * for every approved deployment company and the one box is Blueprint updates only; Settings holds both switches.
 * v3 (launch copy, owner approval in the consent pull request): the sign-up box says the same words as the application's,
 * the new-job fact sits on its own line above it, and the Settings switch reads "Email me about each new job".
 */
export const UPDATE_PREFERENCES_VERSIONS = ["optional-updates-v1", "optional-updates-v2", "optional-updates-v3"] as const;
export const CURRENT_UPDATE_PREFERENCES_VERSION = "optional-updates-v3" as const;
export type UpdatePreferences = UpdatePreferencesInput & {
  source: "signup" | "application" | "settings";
  updatedAtIso: string;
  version: typeof UPDATE_PREFERENCES_VERSIONS[number];
};
// These fields are included in the owner's existing public-card approval.
// Missing values stay unknown, particularly rights and retention.
export const listingTargetingSchema = z.object({
  categories: targetingCategoriesSchema.default({}),
  requiredRecipient: targetingCategoriesSchema.default({}),
  retentionDays: z.number().int().min(0).max(36500).optional(),
  trainingUseAllowed: z.boolean().optional(), rightsScopes: categories.optional(),
}).strict();
export type ListingTargeting = z.infer<typeof listingTargetingSchema>;
