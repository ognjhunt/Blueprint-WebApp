/**
 * The Pipeline's autonomous candidate choice for a finished job evaluation.
 *
 * A fixed rule, not a person, picks from the published simulation result
 * (`website_candidate_selection.v1`). It is a bounded estimate for development
 * only, never a physical guarantee or ADP evidence. Deployment companies come
 * from the catalog row of the exact configuration; with none recorded, none is
 * named. Registry teams are joined only where a recorded name matches.
 */
import { z } from "zod";
import type { JobCandidateSelection } from "../../client/src/types/jobMarketplace";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import type { BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(1_000_000);
const rank = z.number().int().min(1).max(256);
const rate = z.number().finite().min(0).max(1);
const text = z.string().min(1).max(2048);

const chosen = z.object({
  candidate_id: identifier, configuration_digest: digest, display_name: z.string().trim().min(1).max(200),
  success_rate: rate, episodes_scored: count, episodes_succeeded: count,
  configuration_id: identifier.nullable(), policy_route_id: identifier.nullable(),
  deployment_companies: z.array(text).max(32),
  relationship: z.enum(["publisher_demonstrated", "company_deployment", "public_controller_integration", "planning_candidate"]).nullable(),
  evidence_url: text.nullable(), related_teams: z.array(text).max(32),
  partner_blockers: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,127}$/)).max(16),
}).strict();
const row = z.object({
  candidate_id: identifier, display_name: z.string().trim().min(1).max(200), priority_rank: rank,
  plan_status: z.enum(["selected", "waitlisted", "unavailable", "deferred", "infeasible"]),
  result_status: z.enum(["pending", "waitlisted", "preparing", "launching", "running", "reconciliation_required", "completed", "blocked", "unavailable", "deferred", "infeasible"]),
  blockers: z.array(z.string().min(1).max(300)).max(100),
  episodes_planned: count, episodes_scored: count, episodes_succeeded: count, episodes_failed: count, episodes_void: count,
  success_rate: rate.nullable(), session_result_digest: digest.nullable(),
  choice_blocker: z.enum(["not_evaluated", "no_scored_episodes", "scripted_baseline_reference_only"]).nullable(),
  result_rank: rank.optional(),
}).strict();

export const betaCandidateSelectionSchema = z.object({
  schema_version: z.literal("website_candidate_selection.v1"),
  campaign_id: identifier, site_id: identifier, plan_digest: digest, publication_digest: digest,
  publication_revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  result_status: z.enum(["completed", "blocked"]), catalog_digest: digest,
  catalog_basis: z.enum(["campaign_catalog", "current_default_catalog_not_campaign_catalog", "catalog_unavailable"]),
  rule: z.literal("success_rate_then_scored_then_void_then_priority_then_identifier.v1"),
  decided_by: z.literal("deterministic_rule_no_human_input"),
  status: z.enum(["chosen", "no_successful_candidate", "no_evaluated_candidate"]),
  chosen: chosen.nullable(), tied_with: z.array(identifier).max(256), candidates: z.array(row).min(1).max(256),
  claim_ceiling: z.literal("simulation_estimate"), selection_digest: digest,
}).strict().superRefine((value, ctx) => {
  const rows = new Map(value.candidates.map(row => [row.candidate_id, row]));
  const eligible = value.candidates.filter(row => row.choice_blocker === null);
  const best = value.chosen && rows.get(value.chosen.candidate_id);
  // Only a scored, successful, first-ranked row can be the choice, and a choice
  // without a recorded company says why no partner is named.
  if (rows.size !== value.candidates.length
    || value.candidates.some(row => (row.choice_blocker === null) !== (row.result_rank !== undefined)
      || row.choice_blocker === null && (row.result_status !== "completed" || row.episodes_scored === 0))
    || value.status !== (value.chosen ? "chosen" : eligible.length ? "no_successful_candidate" : "no_evaluated_candidate")
    || (!value.chosen && eligible.some(row => row.episodes_succeeded > 0))
    || (value.chosen &&(!best || best.choice_blocker !== null || best.result_rank !== 1 || best.episodes_succeeded === 0
      || best.success_rate !== value.chosen.success_rate || best.episodes_scored !== value.chosen.episodes_scored
      || best.episodes_succeeded !== value.chosen.episodes_succeeded || best.display_name !== value.chosen.display_name
      || (!value.chosen.deployment_companies.length && !value.chosen.partner_blockers.length)))
    || value.tied_with.some(id => !value.chosen || id === value.chosen.candidate_id || rows.get(id)?.choice_blocker !== null))
    ctx.addIssue({ code: "custom", message: "Candidate selection and its rows disagree" });
});
export type BetaCandidateSelection = z.infer<typeof betaCandidateSelectionSchema>;

export function parseBetaCandidateSelection(value: unknown): BetaCandidateSelection | null {
  const parsed = betaCandidateSelectionSchema.safeParse(value);
  if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "selection_digest") !== parsed.data.selection_digest) return null;
  return parsed.data;
}

/**
 * Every row restates the accepted publication exactly. Terminal candidate rows
 * never change, so a choice stays bound across budget-only revisions.
 */
export function selectionMatchesPublication(selection: BetaCandidateSelection, publication: BetaPolicyScreeningPublication) {
  const published = new Map(publication.candidates.map(row => [row.candidate_id, row]));
  return selection.campaign_id === publication.campaign_id && selection.site_id === publication.site_id
    && selection.plan_digest === publication.plan_digest && selection.catalog_digest === publication.catalog_digest
    && selection.result_status === publication.status && selection.candidates.length === published.size
    && selection.candidates.every(row => {
      const value = published.get(row.candidate_id);
      return value !== undefined && value.display_name === row.display_name && value.status === row.result_status
        && value.episodes_planned === row.episodes_planned && value.episodes_scored === row.episodes_scored
        && value.episodes_succeeded === row.episodes_succeeded && value.episodes_failed === row.episodes_failed
        && value.episodes_void === row.episodes_void && value.success_rate === row.success_rate
        && value.session_result_digest === row.session_result_digest
        && (row.choice_blocker !== null || value.execution_evidence_kind !== "scripted_simulator_state_baseline");
    })
    && (!selection.chosen || published.get(selection.chosen.candidate_id)?.configuration_digest === selection.chosen.configuration_digest);
}

/** The stored selection for the job's views, or nothing when it no longer matches the accepted publication. */
export function projectCandidateSelection(stored: unknown, publication: BetaPolicyScreeningPublication): JobCandidateSelection | undefined {
  const record = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  const selection = parseBetaCandidateSelection(record.record);
  if (!selection || !selectionMatchesPublication(selection, publication)) return undefined;
  const teams = Array.isArray(record.registry_teams) ? record.registry_teams.filter((team): team is { id: string; name: string } =>
    typeof team?.id === "string" && typeof team?.name === "string").map(({ id, name }) => ({ id, name })) : [];
  const value = selection.chosen;
  return { status: selection.status, selectionDigest: selection.selection_digest, tiedWith: selection.tied_with,
    chosen: value && { candidateId: value.candidate_id, name: value.display_name, successRate: value.success_rate,
      scored: value.episodes_scored, succeeded: value.episodes_succeeded, configurationId: value.configuration_id,
      policyRouteId: value.policy_route_id, deploymentCompanies: value.deployment_companies, relationship: value.relationship,
      evidenceUrl: value.evidence_url, relatedTeams: value.related_teams, partnerBlockers: value.partner_blockers,
      registryTeams: teams },
    candidates: selection.candidates.map(row => ({ candidateId: row.candidate_id, resultRank: row.result_rank ?? null,
      choiceBlocker: row.choice_blocker })) };
}

/** Registry rows are Blueprint's operating records; a site sees only the companies the catalog records. */
export function withoutRegistryTeams<T extends { screening?: { selection?: JobCandidateSelection } }>(item: T): T {
  const selection = item.screening?.selection;
  return selection?.chosen ? { ...item, screening: { ...item.screening, selection: { ...selection,
    chosen: { ...selection.chosen, registryTeams: [] } } } } : item;
}
