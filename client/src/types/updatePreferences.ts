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
export type UpdatePreferences = UpdatePreferencesInput & {
  source: "signup" | "application" | "settings";
  updatedAtIso: string;
  version: "optional-updates-v1";
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
