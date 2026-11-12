/**
 * Firestore reads for the founder's job console. Read-only and bounded.
 *
 * One page scans at most `SCAN_LIMIT` inbound requests newest-first, keeps the
 * site jobs, and batches every enrichment read across the page: briefs and
 * capture sessions by `getAll`, evaluation requests and runs by `in` queries
 * of at most 30 ids. A page can hold fewer rows than asked for when a stage or
 * search filter is applied; `nextCursor` continues the scan where it stopped.
 * A job with footage also reads Blueprint's scene and screening the way its job
 * page does (`loadWebsiteSceneProgression`), a few queries per job.
 * No index beyond Firestore's automatic single-field ones is required.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import { ROBOT_TEAMS_COLLECTION } from "../types/robot-team-registry";
import { object, text } from "./workspace-projection";
import { loadWebsiteSceneProgression } from "./websiteSceneProgression";
import { buildJobTimeline, projectJobFacts, projectRuns, type RawEvaluationRequest, type RawJobInputs, type RawRun } from "./jobConsoleFacts";
import { deriveJobStage, type JobConsoleDetail, type JobConsoleRow, type JobStage } from "./jobConsoleStage";

export const SCAN_LIMIT = 200;
export const PAGE_LIMIT_MAX = 50;
const IN_CHUNK = 30;
const ENRICH_BATCH = 50;

type Doc = { id: string; data: () => Record<string, any> | undefined; exists?: boolean };

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

export function isSiteJobRecord(record: Record<string, any> | undefined): boolean {
  return Boolean(record) && object(record!.request).buyerType === "site_operator" && !record!.workspace_evaluation;
}

async function decryptSite(record: Record<string, any>) {
  try {
    const decrypted = await decryptInboundRequestForAdmin(record as any) as unknown as Record<string, any>;
    return {
      siteName: text(object(decrypted.request).siteName),
      siteLocation: text(object(decrypted.request).siteLocation),
      company: text(object(decrypted.contact).company),
    };
  } catch {
    return null;
  }
}

async function getAllDocs(collection: string, ids: string[]): Promise<Map<string, Record<string, any>>> {
  const out = new Map<string, Record<string, any>>();
  if (!db || !ids.length) return out;
  for (const group of chunks(ids, 100)) {
    const snapshots = await db.getAll(...group.map((id) => db!.collection(collection).doc(id)));
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.exists ? snapshot.data() : undefined;
      if (data) out.set(group[index], data);
    });
  }
  return out;
}

async function queryIn(collection: string, field: string, values: string[], limit: number): Promise<Doc[]> {
  if (!db || !values.length) return [];
  const results = await Promise.all(chunks(values, IN_CHUNK).map((group) =>
    db!.collection(collection).where(field, "in", group).limit(limit).get()));
  return results.flatMap((snapshot) => snapshot.docs as unknown as Doc[]);
}

/** Every read one batch of site jobs needs, in a constant number of round trips. */
async function loadInputs(docs: Doc[]): Promise<RawJobInputs[]> {
  const ids = docs.map((doc) => doc.id);
  const [briefs, sessions, requestDocs, runDocs] = await Promise.all([
    getAllDocs("siteTaskBriefs", ids),
    getAllDocs("captureUploadSessions", ids.map((id) => `walkthrough-${id}`)),
    queryIn("inboundRequests", "workspace_evaluation.opportunityId", ids, 500),
    queryIn("evaluationRuns", "sceneId", ids, 1000),
  ]);
  const runs = runDocs.map((doc) => ({ ...(doc.data() as RawRun), runId: text(doc.data()?.runId) || doc.id }));

  // Team names: runs and recommendations carry a team id; an evaluation request
  // carries only the requesting account, whose bound team names it.
  const teamIds = new Set<string>(runs.map((run) => run.teamId).filter(Boolean));
  const ownerUids = [...new Set(requestDocs.map((doc) => text(doc.data()?.account_owner_uid)).filter(Boolean))];
  const ownerTeams = new Map<string, { id: string; name: string }>();
  for (const doc of await queryIn(ROBOT_TEAMS_COLLECTION, "accountUid", ownerUids, 200)) {
    const data = doc.data() ?? {};
    if (!ownerTeams.has(text(data.accountUid))) ownerTeams.set(text(data.accountUid), { id: doc.id, name: text(data.name) });
  }
  const teams = await getAllDocs(ROBOT_TEAMS_COLLECTION, [...teamIds]);
  const teamNames = new Map<string, string>();
  teams.forEach((team, id) => teamNames.set(id, text(team.name) || id));
  ownerTeams.forEach((team) => teamNames.set(team.id, team.name || team.id));

  return Promise.all(docs.map(async (doc) => {
    const record = doc.data() ?? {};
    const evaluationRequests: RawEvaluationRequest[] = requestDocs
      .filter((request) => object(request.data()?.workspace_evaluation).opportunityId === doc.id)
      .map((request) => {
        const data = request.data() ?? {};
        return { id: request.id, record: data, teamName: ownerTeams.get(text(data.account_owner_uid))?.name || null };
      });
    return {
      requestId: doc.id,
      record,
      site: await decryptSite(record),
      brief: briefs.get(doc.id) ?? null,
      captureSession: sessions.get(`walkthrough-${doc.id}`) ?? null,
      sceneProgression: sessions.has(`walkthrough-${doc.id}`)
        ? await loadWebsiteSceneProgression(doc.id, `walkthrough-${doc.id}`) : null,
      evaluationRequests,
      runs: runs.filter((run) => (run as unknown as { sceneId?: string }).sceneId === doc.id),
      teamNames,
    };
  }));
}

export function rowFromInputs(inputs: RawJobInputs): JobConsoleRow {
  const facts = projectJobFacts(inputs);
  return { ...facts, ...deriveJobStage(facts) };
}

function matchesSearch(row: JobConsoleRow, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [row.siteName, row.siteLocation, row.company, row.requestId]
    .some((value) => value.toLowerCase().includes(needle));
}

export async function listJobConsoleRows(params: {
  limit: number;
  cursor?: string | null;
  stage?: JobStage | null;
  q?: string | null;
}): Promise<{ rows: JobConsoleRow[]; nextCursor: string | null; scanned: number }> {
  if (!db) throw new Error("job_console_store_unavailable");
  const limit = Math.max(1, Math.min(PAGE_LIMIT_MAX, Math.floor(params.limit)));
  let query = db.collection("inboundRequests").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (params.cursor) {
    const start = await db.collection("inboundRequests").doc(params.cursor).get();
    if (start.exists) query = query.startAfter(start);
  }
  const snapshot = await query.limit(SCAN_LIMIT).get();
  const scannedDocs = snapshot.docs as unknown as Doc[];
  const rows: JobConsoleRow[] = [];
  let lastConsumed: string | null = null;
  let stoppedEarly = false;
  const q = (params.q ?? "").trim();

  // Enrich in batches and stop as soon as the page is full, so a page with
  // no filter costs one batch rather than the whole scan window.
  let index = 0;
  outer: while (index < scannedDocs.length) {
    const window = scannedDocs.slice(index, index + ENRICH_BATCH);
    const siteDocs = window.filter((doc) => isSiteJobRecord(doc.data()));
    const inputs = await loadInputs(siteDocs);
    const byId = new Map(inputs.map((input) => [input.requestId, input]));
    for (const doc of window) {
      index += 1;
      lastConsumed = doc.id;
      const input = byId.get(doc.id);
      if (!input) continue;
      const row = rowFromInputs(input);
      if (params.stage && row.stage !== params.stage) continue;
      if (!matchesSearch(row, q)) continue;
      rows.push(row);
      if (rows.length >= limit) {
        stoppedEarly = index < scannedDocs.length;
        break outer;
      }
    }
  }
  const nextCursor = stoppedEarly || scannedDocs.length === SCAN_LIMIT ? lastConsumed : null;
  return { rows, nextCursor, scanned: index };
}

export async function getJobConsoleDetail(requestId: string): Promise<JobConsoleDetail | null> {
  if (!db) throw new Error("job_console_store_unavailable");
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.exists ? snapshot.data() : undefined;
  if (!isSiteJobRecord(record)) return null;
  const [inputs] = await loadInputs([{ id: requestId, data: () => record }]);
  const row = rowFromInputs(inputs);
  return {
    job: row,
    timeline: buildJobTimeline(inputs, row),
    runs: projectRuns(inputs),
    links: {
      lead: `/admin/leads/${encodeURIComponent(requestId)}`,
      recommendation: `/admin/robot-team-access?job=${encodeURIComponent(requestId)}`,
    },
  };
}
