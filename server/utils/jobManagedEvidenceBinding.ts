import { z } from "zod";

export const jobManagedEvidenceBindingSchema = z.object({
  job_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  brief_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export type JobManagedEvidenceBinding = z.infer<typeof jobManagedEvidenceBindingSchema>;
