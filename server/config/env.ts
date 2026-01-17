import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    STRIPE_SECRET_KEY: z.string().trim().min(1).optional(),
    STRIPE_CONNECT_ACCOUNT_ID: z.string().trim().min(1).optional(),
    STRIPE_PUBLIC_BASE_URL: z.string().trim().url().optional(),
    STRIPE_ONBOARDING_REFRESH_URL: z.string().trim().url().optional(),
    STRIPE_ONBOARDING_RETURN_URL: z.string().trim().url().optional(),
    RATE_LIMIT_REDIS_URL: z.string().trim().optional(),
    REDIS_URL: z.string().trim().optional(),
    ALLOWED_ORIGINS: z.string().trim().optional(),
    API_BODY_LIMIT: z.string().trim().optional(),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.STRIPE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message: "STRIPE_SECRET_KEY is required in production.",
        });
      }
      if (!env.STRIPE_CONNECT_ACCOUNT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_CONNECT_ACCOUNT_ID"],
          message: "STRIPE_CONNECT_ACCOUNT_ID is required in production.",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "env";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Environment validation failed:\n${issues}`);
}
