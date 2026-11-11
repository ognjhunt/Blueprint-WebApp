/**
 * Deployment evidence: who has put a robot model, or its maker's robots, to
 * work on a kind of job, each row quoted word for word from a public source.
 *
 * `server/data/deploymentEvidence.v1.json`. Levels:
 * - `production`: in ongoing commercial use at a named customer or site, or a
 *   stated count of units or cycles, on this kind of job;
 * - `pilot`: a named customer trial or a dated integrator case study;
 * - `offered`: the maker or an integrator markets the model for this kind of
 *   job, with no named customer.
 *
 * `model_ids` lists catalog ids only where the source names that model; an
 * empty list is maker-level and applies to that maker's models. A row with no
 * source, quote, level, job family or maker is dropped, never shown, and its
 * valid siblings stay usable.
 */
import { z } from "zod";

import {
  EVIDENCE_LEVELS, JOB_FAMILIES, type AnswerEvidence, type EvidenceLevel, type JobFamily,
} from "../../client/src/lib/siteAnswer";
import evidenceJson from "../data/deploymentEvidence.v1.json";
import type { BodyType } from "./robotSpecCatalog";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const deploymentEvidenceRowSchema = z.object({
  id: z.string().min(1).max(120),
  manufacturer: z.string().trim().min(1).max(120),
  model_ids: z.array(z.string().regex(/^[a-z0-9_]{1,80}$/)).max(40).default([]),
  /** Optional: a maker-level row that speaks only of one kind of robot. */
  body_type: z.enum(["fixed_arm", "mobile_manipulator", "humanoid"]).nullable().optional(),
  job_family: z.enum(JOB_FAMILIES),
  level: z.enum(EVIDENCE_LEVELS),
  summary: z.string().trim().min(1).max(400),
  quote: z.string().trim().min(1).max(1200),
  source_url: z.string().url().refine((url) => /^https?:\/\//.test(url), "http(s) only"),
  source_title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(200),
  published_on: isoDate.nullable().optional(),
  retrieved_on: isoDate.optional(),
}).passthrough();
export type DeploymentEvidenceRow = z.infer<typeof deploymentEvidenceRowSchema>;

const fileSchema = z.object({
  schema_version: z.literal("deployment_evidence.v1"),
  retrieved_on: isoDate,
  rows: z.array(z.unknown()),
}).passthrough();

export interface DeploymentEvidence {
  retrievedOn: string;
  rows: DeploymentEvidenceRow[];
  /** Rows dropped as malformed: their position and why. */
  rejected: Array<{ index: number; id: string | null; issue: string }>;
}

/** Validate the file: a wrong schema throws; each malformed row is dropped and listed. */
export function parseDeploymentEvidence(raw: unknown): DeploymentEvidence {
  const file = fileSchema.parse(raw);
  const rows: DeploymentEvidenceRow[] = [];
  const rejected: DeploymentEvidence["rejected"] = [];
  file.rows.forEach((row, index) => {
    const parsed = deploymentEvidenceRowSchema.safeParse(row);
    if (parsed.success) rows.push(parsed.data);
    else {
      const id = row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : null;
      rejected.push({ index, id, issue: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ") });
    }
  });
  return { retrievedOn: file.retrieved_on, rows, rejected };
}

export const EVIDENCE_RANK: Readonly<Record<EvidenceLevel, number>> = { production: 3, pilot: 2, offered: 1 };

export type EvidenceLookup = (modelId: string, manufacturer: string, bodyType: BodyType | string, jobFamily: JobFamily) => AnswerEvidence[];

const sameMaker = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A lookup over the given rows: rows for this model and this kind of job,
 * strongest first (level, then model before maker, then id), each once.
 */
export function evidenceLookup(rows: readonly DeploymentEvidenceRow[]): EvidenceLookup {
  return (modelId, manufacturer, bodyType, jobFamily) => rows
    .filter((row) => row.job_family === jobFamily && sameMaker(row.manufacturer, manufacturer))
    .map((row) => {
      if (row.model_ids.length) return row.model_ids.includes(modelId) ? { row, scope: "model" as const } : null;
      return !row.body_type || row.body_type === bodyType ? { row, scope: "maker" as const } : null;
    })
    .filter((entry): entry is { row: DeploymentEvidenceRow; scope: "model" | "maker" } => Boolean(entry))
    .sort((a, b) => EVIDENCE_RANK[b.row.level] - EVIDENCE_RANK[a.row.level]
      || (a.scope === b.scope ? 0 : a.scope === "model" ? -1 : 1) || a.row.id.localeCompare(b.row.id))
    .map(({ row, scope }) => ({
      level: row.level, scope, summary: row.summary, quote: row.quote, sourceUrl: row.source_url,
      sourceTitle: row.source_title, publisher: row.publisher, publishedOn: row.published_on ?? null,
    }));
}

let cached: { evidence: DeploymentEvidence; lookup: EvidenceLookup } | null = null;

/** The shipped evidence, validated once per process. */
export function deploymentEvidence(): DeploymentEvidence {
  if (!cached) {
    const evidence = parseDeploymentEvidence(evidenceJson as unknown);
    cached = { evidence, lookup: evidenceLookup(evidence.rows) };
  }
  return cached.evidence;
}

/** The shipped evidence for one model on one kind of job, strongest first. */
export function evidenceFor(modelId: string, manufacturer: string, bodyType: BodyType | string, jobFamily: JobFamily): AnswerEvidence[] {
  deploymentEvidence();
  return cached!.lookup(modelId, manufacturer, bodyType, jobFamily);
}
