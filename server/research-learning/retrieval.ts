import { z } from "zod";
import { digest, hash, id, instant } from "./contract";
import { originalDate, safeText, scopeSourceSnapshot, verifySourceSnapshot, type SourceGrant, type SourceRequest } from "./prior-research";

export const PROGRESSIVE_RETRIEVAL_CONTRACT = {
  version: "blueprint.progressive-research-retrieval.v1", liveDirectoryReaderEnabled: false,
  operations: ["search_compact_directory", "fetch_scoped_details", "broaden_query", "request_host_detail_scope"] as const,
  missingCapabilityMeans: "unknown", shortlistIsFinal: false,
  instructions: "Start with compact prior findings and open questions. Search a paged directory index by task, region, company or capability; selectively fetch evidence. Broaden queries and investigate unknowns. Index access does not grant detail or tool authority.",
} as const;
const ids = z.array(id).max(100).refine(values => new Set(values).size === values.length);
const entrySchema = z.object({ entryId: id, teamId: id.nullable(), companyId: id, capabilityIds: ids,
  name: safeText(200), taskTags: z.array(safeText(120)).max(20), regionTags: z.array(safeText(120)).max(20),
  hasUnknowns: z.boolean(), hasConflicts: z.boolean(), sourceCheckedDates: z.array(originalDate).max(20),
}).strict();
const indexSchema = z.object({ version: z.literal("blueprint.research-discovery-index.v1"), indexHash: hash,
  source: z.object({ recordRef: safeText(500), sourceHash: hash, projectionHash: hash.optional(), asOf: instant }).strict(),
  coverage: z.enum(["cached_capabilities_only", "authorized_robot_team_directory"]), completeForSource: z.boolean(),
  entries: z.array(entrySchema).max(10000).refine(entries => new Set(entries.map(entry => entry.entryId)).size === entries.length),
}).strict();
export type DiscoveryIndex = z.infer<typeof indexSchema>;
const grantSchema = z.object({ principalId: id, indexHash: hash, expiresAt: instant }).strict();
export type DiscoveryGrant = z.infer<typeof grantSchema>;
const tags = z.array(safeText(120)).max(100).refine(values => new Set(values).size === values.length);
const querySchema = z.object({ taskTags: tags, regionTags: tags, companyIds: ids, capabilityIds: ids,
  pageSize: z.number().int().min(1).max(25), cursor: z.object({ indexHash: hash, queryHash: hash, offset: z.number().int().min(0) }).strict().nullable(),
}).strict();
export type DiscoveryQuery = z.infer<typeof querySchema>;

/** Host directory providers may use the same contract for a complete authorized
 * robotTeams index. This slice only builds the explicitly bounded cached index. */
export function cachedDiscoveryIndex(source: unknown, grant: SourceGrant, request: SourceRequest, now: string): DiscoveryIndex {
  const original = verifySourceSnapshot(source), snapshot = scopeSourceSnapshot(original, grant, request, now), rootId = original.parentSnapshotId ?? original.snapshotId;
  const content = { version: "blueprint.research-discovery-index.v1" as const,
    source: { recordRef: `blueprintResearchLearning/default/sourceSnapshots/${rootId}`,
      sourceHash: rootId, projectionHash: snapshot.contentHash, asOf: snapshot.asOf },
    coverage: "cached_capabilities_only" as const, completeForSource: false,
    entries: snapshot.capabilities.map(record => ({ entryId: record.capabilityId, teamId: null, companyId: record.companyId, capabilityIds: [record.capabilityId],
      name: snapshot.companies.find(company => company.companyId === record.companyId)!.name,
      taskTags: record.taskTags, regionTags: record.geographyTags,
      hasUnknowns: record.facts.some(fact => ["unknown", "unsupported"].includes(fact.status)), hasConflicts: record.facts.some(fact => fact.status === "conflicted"),
      sourceCheckedDates: [...new Set(record.facts.flatMap(fact => fact.sources.map(source => source.sourceCheckedAt)))].sort() })) };
  return indexSchema.parse({ ...content, indexHash: digest(content) });
}

/** Ranking never removes nonmatching/unknown rows. Agents can page through the
 * entire authorized index or broaden to an empty query, then request details. */
export function searchDiscoveryIndex(value: unknown, grantValue: DiscoveryGrant, queryValue: DiscoveryQuery, now: string) {
  const index = indexSchema.parse(value), grant = grantSchema.parse(grantValue), query = querySchema.parse(queryValue), at = instant.parse(now);
  const { indexHash, ...content } = index;
  if (digest(content) !== indexHash || grant.indexHash !== indexHash || grant.expiresAt <= at || index.source.asOf > at) throw new Error("learning_discovery_scope_or_hash_invalid");
  const { cursor, pageSize, ...criteria } = query, queryHash = digest(criteria);
  if (cursor && (cursor.indexHash !== indexHash || cursor.queryHash !== queryHash || cursor.offset > index.entries.length)) throw new Error("learning_discovery_cursor_invalid");
  const overlap = (asked: string[], actual: string[]) => asked.some(value => actual.some(item => item.toLowerCase() === value.toLowerCase()));
  const ranked = index.entries.map(entry => {
    const task = overlap(criteria.taskTags, entry.taskTags), region = overlap(criteria.regionTags, entry.regionTags),
      company = criteria.companyIds.includes(entry.companyId), capability = overlap(criteria.capabilityIds, entry.capabilityIds);
    return { ...entry, score: Number(task) + Number(region) + Number(company) + Number(capability),
      taskMatch: task ? "indexed_tag_match" : !criteria.taskTags.length ? "not_requested" : entry.taskTags.length ? "other_indexed_tasks" : "unknown",
      regionMatch: region ? "indexed_tag_match" : !criteria.regionTags.length ? "not_requested" : entry.regionTags.length ? "other_indexed_regions" : "unknown" };
  }).sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId));
  const offset = cursor?.offset ?? 0, end = Math.min(offset + pageSize, ranked.length);
  return { version: "blueprint.research-discovery-page.v1", principalId: grant.principalId, indexHash, source: index.source,
    coverage: index.coverage, completeForSource: index.completeForSource, totalIndexed: index.entries.length, rows: ranked.slice(offset, end),
    nextCursor: end < ranked.length ? { indexHash, queryHash, offset: end } : null,
    detailAuthority: "separate_host_issued_CRM_and_capability_grant", capabilityAbsenceIsEvidenceOfIncompatibility: false,
    broaden: { ...criteria, taskTags: [], regionTags: [], companyIds: [], capabilityIds: [], pageSize, cursor: null } };
}
