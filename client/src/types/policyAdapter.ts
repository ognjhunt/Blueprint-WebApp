import { z } from "zod";

const cameraName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
/** Public protocol settings only. Tokens use the existing encrypted credential store. */
export const policyAdapterSchema = z.object({
  policy_interface_id: z.literal("dreamlabs_dream1.v1"),
  model_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/),
  camera_roles: z.object({ overhead: cameraName, wrist_l: cameraName, wrist_r: cameraName }).strict()
    .refine(roles => new Set(Object.values(roles)).size === 3, "Bind three distinct cameras."),
}).strict();
export type PolicyAdapter = z.infer<typeof policyAdapterSchema>;

export function samePolicyAdapter(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) return true;
  const a = policyAdapterSchema.safeParse(left), b = policyAdapterSchema.safeParse(right);
  return a.success && b.success && JSON.stringify(a.data) === JSON.stringify(b.data);
}
