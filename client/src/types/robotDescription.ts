import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const modelUrl = z.string().trim().url().max(1000).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}, "Use an HTTPS model link without credentials or query parameters.");

/** A submitted description is an input, never simulation qualification. */
export const robotDescriptionSchema = z.discriminatedUnion("source", [
  z.object({source:z.literal("catalog"),configurationId:identifier,configurationDigest:digest}).strict(),
  z.object({source:z.literal("model"),format:z.enum(["urdf","usd","mjcf"]),reference:modelUrl,
    mobility:z.enum(["fixed","mobile","legged"]),details:z.string().trim().max(2000)}).strict(),
]);
export type RobotDescription = z.infer<typeof robotDescriptionSchema>;
export type RobotConfigurationChoice = {id:string;label:string;binding_digest:string};
