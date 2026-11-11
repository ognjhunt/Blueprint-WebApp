/**
 * Deployment evidence: who has put a robot model to work on a kind of job,
 * each row quoted word for word from a public source.
 *
 * `server/data/deploymentEvidence.v2.json` (`deployment_evidence.v2`). The
 * schema makes the wrong record impossible to write:
 *
 * - `applies_to`: the catalog models the row is evidence for. Never empty;
 *   every id must exist in the robot spec catalog and belong to the row's
 *   maker. There are no maker-wide rows: a source that names neither a catalog
 *   model nor its family is not a row.
 * - `names`: `model` when the quote names that exact model; `family` when it
 *   names the family those models belong to, given in `family` (present
 *   exactly then).
 * - `customer`: the end customer's name, `"unnamed"` when the source reports
 *   live production without naming it, or null.
 * - `level`: `production` = in ongoing use at an end customer (a customer is
 *   required, named or "unnamed"); `pilot` = a trial at a named end customer
 *   (a name is required); `offered` = marketed for the job, including an
 *   integrator's product built on the arm, with no end customer (null).
 *   Whether a quote's wording shows ongoing use or volume is the reviewer's
 *   call, not the schema's.
 *
 * A row that breaks any rule is dropped, never shown, and listed in
 * `rejected`; its valid siblings stay usable.
 */
import { z } from "zod";

import {
  EVIDENCE_LEVELS, JOB_FAMILIES, type AnswerEvidence, type EvidenceLevel, type JobFamily,
} from "../../client/src/lib/siteAnswer";
import evidenceJson from "../data/deploymentEvidence.v2.json";
import { robotSpecCatalog, type RobotSpecCatalog } from "./robotSpecCatalog";

export const DEPLOYMENT_EVIDENCE_SCHEMA = "deployment_evidence.v2" as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const words = (max: number) => z.string().trim().min(1).max(max);

export const deploymentEvidenceRowSchema = z.object({
  id: words(120),
  manufacturer: words(120),
  applies_to: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).min(1).max(40)
    .refine((ids) => new Set(ids).size === ids.length, "a model is listed twice"),
  names: z.enum(["model", "family"]),
  family: words(120).nullable(),
  customer: words(200).nullable(),
  job_family: z.enum(JOB_FAMILIES),
  level: z.enum(EVIDENCE_LEVELS),
  summary: words(400),
  quote: words(1200),
  source_url: z.string().url().refine((url) => /^https?:\/\//.test(url), "http(s) only"),
  source_title: words(300),
  publisher: words(200),
  published_on: isoDate.nullable().optional(),
  retrieved_on: isoDate.optional(),
}).strict().superRefine((row, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (row.names === "family" && row.family === null) issue("family", "a row that names a family says which");
  if (row.names === "model" && row.family !== null) issue("family", "a row that names the model has no family");
  if (row.level === "production" && row.customer === null) issue("customer", "production use needs an end customer");
  if (row.level === "pilot" && (row.customer === null || row.customer === "unnamed")) issue("customer", "a pilot needs a named end customer");
  if (row.level === "offered" && row.customer !== null) issue("customer", "an offer has no end customer");
});
export type DeploymentEvidenceRow = z.infer<typeof deploymentEvidenceRowSchema>;

const fileSchema = z.object({
  schema_version: z.literal(DEPLOYMENT_EVIDENCE_SCHEMA),
  retrieved_on: isoDate,
  rows: z.array(z.unknown()),
}).passthrough();

export interface DeploymentEvidence {
  retrievedOn: string;
  rows: DeploymentEvidenceRow[];
  /** Rows dropped as malformed: their position and why. */
  rejected: Array<{ index: number; id: string | null; issue: string }>;
}

/** Every model the row applies to is in the catalog and made by the row's maker; else why not. */
function catalogIssues(row: DeploymentEvidenceRow, catalog: RobotSpecCatalog): string[] {
  const byId = new Map(catalog.models.map((model) => [model.model_id, model]));
  return row.applies_to.flatMap((id) => {
    const model = byId.get(id);
    if (!model) return [`applies_to: ${id} is not in the robot catalog`];
    return model.manufacturer === row.manufacturer ? [] : [`applies_to: ${id} is made by ${model.manufacturer}, not ${row.manufacturer}`];
  });
}

/**
 * Validate the file against the robot catalog: a wrong schema version throws; each row that breaks a rule
 * is dropped and listed, and a repeated id keeps only its first row.
 */
export function parseDeploymentEvidence(raw: unknown, catalog: RobotSpecCatalog = robotSpecCatalog()): DeploymentEvidence {
  const file = fileSchema.parse(raw);
  const rows: DeploymentEvidenceRow[] = [];
  const rejected: DeploymentEvidence["rejected"] = [];
  const seen = new Set<string>();
  file.rows.forEach((row, index) => {
    const id = row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : null;
    const parsed = deploymentEvidenceRowSchema.safeParse(row);
    const issues = parsed.success
      ? [...catalogIssues(parsed.data, catalog), ...(seen.has(parsed.data.id) ? ["id: repeated"] : [])]
      : parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`);
    if (parsed.success && !issues.length) {
      rows.push(parsed.data);
      seen.add(parsed.data.id);
    } else rejected.push({ index, id, issue: issues.join("; ") });
  });
  return { retrievedOn: file.retrieved_on, rows, rejected };
}

export const EVIDENCE_RANK: Readonly<Record<EvidenceLevel, number>> = { production: 3, pilot: 2, offered: 1 };

export type EvidenceLookup = (modelId: string, jobFamily: JobFamily) => AnswerEvidence[];

/**
 * A lookup over the given rows: the rows that apply to this model on this kind of job, strongest first
 * (level, then a source that names the model before one that names its family, then id), each once.
 */
export function evidenceLookup(rows: readonly DeploymentEvidenceRow[]): EvidenceLookup {
  return (modelId, jobFamily) => rows
    .filter((row) => row.job_family === jobFamily && row.applies_to.includes(modelId))
    .sort((a, b) => EVIDENCE_RANK[b.level] - EVIDENCE_RANK[a.level]
      || (a.names === b.names ? 0 : a.names === "model" ? -1 : 1) || a.id.localeCompare(b.id))
    .map((row) => ({
      level: row.level, scope: row.names, family: row.names === "family" ? row.family : null,
      summary: row.summary, quote: row.quote, sourceUrl: row.source_url,
      sourceTitle: row.source_title, publisher: row.publisher, publishedOn: row.published_on ?? null,
    }));
}

let cached: { evidence: DeploymentEvidence; lookup: EvidenceLookup } | null = null;

/** The shipped evidence, validated against the mirrored catalog once per process. */
export function deploymentEvidence(): DeploymentEvidence {
  if (!cached) {
    const evidence = parseDeploymentEvidence(evidenceJson as unknown);
    cached = { evidence, lookup: evidenceLookup(evidence.rows) };
  }
  return cached.evidence;
}

/** The shipped evidence for one model on one kind of job, strongest first. */
export function evidenceFor(modelId: string, jobFamily: JobFamily): AnswerEvidence[] {
  deploymentEvidence();
  return cached!.lookup(modelId, jobFamily);
}
