#!/usr/bin/env tsx
/**
 * Read-only report: robot teams whose identity is split across registry rows.
 *
 * A team that asked to evaluate a job through the workspace has an intake row
 * (`team_<company>`, status `applied`) and an account-bound row (random
 * suffix, usually `self_registered`) that its evaluation runs name. New
 * intakes link the two (`canonicalTeamId` / `linkedIntakeTeamIds`); rows
 * written before that change may not be linked. This lists every group the
 * resolver in `server/utils/robotTeamIdentity.ts` would treat as one team,
 * which of them lacks the explicit link, and any group it cannot resolve.
 *
 * It writes nothing — no backfill, no Firestore writes, no messages. Emails
 * are printed as short hashes so the output can be pasted into a ticket.
 *
 *   npx tsx scripts/ops/report-robot-team-identity-splits.ts [--limit 2000] [--json]
 */
import { createHash } from "node:crypto";

import type { RobotTeamRecord } from "../../server/types/robot-team-registry";
import { groupRobotTeamIdentities, normalizeTeamEmail } from "../../server/utils/robotTeamIdentity";

export interface IdentitySplitMember {
  id: string;
  status: string;
  registrationSource: string | null;
  accountBound: boolean;
  emailHashes: string[];
  canonicalTeamId: string | null;
  runCount: number | null;
}

export interface IdentitySplit {
  canonicalId: string | null;
  ambiguous: boolean;
  /** Intake rows that would resolve only by email today, without an explicit pointer. */
  unlinkedMemberIds: string[];
  members: IdentitySplitMember[];
}

function emailHash(value: unknown): string | null {
  const email = normalizeTeamEmail(value);
  return email ? createHash("sha256").update(email).digest("hex").slice(0, 10) : null;
}

/** Pure: which groups of rows are one team split across several records. */
export function buildIdentitySplitReport(rows: readonly RobotTeamRecord[], runCounts: ReadonlyMap<string, number> = new Map()): IdentitySplit[] {
  const byId = new Map(rows.map(row => [row.id, row]));
  return groupRobotTeamIdentities(rows)
    .filter(group => group.memberIds.length > 1 || group.ambiguous)
    .map(group => {
      const members = group.memberIds.map(id => byId.get(id)!).map(row => ({
        id: row.id,
        status: row.status,
        registrationSource: row.registrationSource ?? null,
        accountBound: Boolean(row.accountUid),
        emailHashes: [...new Set([emailHash(row.accountEmail), emailHash(row.contactEmail)].filter((hash): hash is string => Boolean(hash)))],
        canonicalTeamId: row.canonicalTeamId ?? null,
        runCount: runCounts.has(row.id) ? runCounts.get(row.id)! : null,
      }));
      const unlinkedMemberIds = group.canonicalId
        ? members.filter(member => member.id !== group.canonicalId && member.canonicalTeamId !== group.canonicalId
            && !(byId.get(group.canonicalId!)?.linkedIntakeTeamIds ?? []).includes(member.id)
            && !(byId.get(group.canonicalId!)?.selfServeTeamIds ?? []).includes(member.id)
            && !(byId.get(member.id)?.selfServeTeamIds ?? []).includes(group.canonicalId!)
            && !(byId.get(member.id)?.linkedIntakeTeamIds ?? []).includes(group.canonicalId!)).map(member => member.id)
        : [];
      return { canonicalId: group.canonicalId, ambiguous: group.ambiguous, unlinkedMemberIds, members };
    })
    .sort((left, right) => Number(right.ambiguous) - Number(left.ambiguous) || right.members.length - left.members.length);
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
  const limit = Math.max(1, Math.min(Number(readArg("--limit") ?? 2000) || 2000, 10000));
  const { dbAdmin: db } = await import("../../client/src/lib/firebaseAdmin");
  if (!db) throw new Error("Firestore is not configured; set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  const snapshot = await db.collection("robotTeams").limit(limit).get();
  const rows = snapshot.docs.map(doc => ({ ...(doc.data() as RobotTeamRecord), id: doc.id }));
  const candidates = buildIdentitySplitReport(rows);
  const runCounts = new Map<string, number>();
  for (const member of candidates.flatMap(split => split.members)) {
    const runs = await db.collection("evaluationRuns").where("teamId", "==", member.id).limit(100).get();
    runCounts.set(member.id, runs.size);
  }
  const report = buildIdentitySplitReport(rows, runCounts);
  const summary = { readOnly: true, teamsRead: rows.length, truncated: rows.length >= limit, splitGroups: report.length,
    ambiguousGroups: report.filter(split => split.ambiguous).length,
    groupsMissingExplicitLink: report.filter(split => split.unlinkedMemberIds.length > 0).length };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ summary, splits: report }, null, 2));
    return;
  }
  console.log(`Robot-team identity splits (read-only): ${summary.splitGroups} groups from ${summary.teamsRead} rows`
    + `${summary.truncated ? " (truncated; raise --limit)" : ""}; ${summary.ambiguousGroups} ambiguous; `
    + `${summary.groupsMissingExplicitLink} missing an explicit link.`);
  for (const split of report) {
    console.log(`\n${split.ambiguous ? "AMBIGUOUS" : `canonical ${split.canonicalId}`}${split.unlinkedMemberIds.length ? ` · unlinked: ${split.unlinkedMemberIds.join(", ")}` : ""}`);
    for (const member of split.members) {
      console.log(`  ${member.id}  status=${member.status}  source=${member.registrationSource ?? "-"}  account=${member.accountBound ? "bound" : "none"}`
        + `  runs=${member.runCount ?? "?"}  email#=${member.emailHashes.join("/") || "-"}`);
    }
  }
}

if (process.argv[1] && /report-robot-team-identity-splits\.ts$/.test(process.argv[1])) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
