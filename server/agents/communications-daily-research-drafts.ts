import { communicationsDigest, communicationsBriefSchema } from "./communications-contract";
import { admitPublishedResearch, admitPublishedHypothesis, runCommunicationsContactRefresh, hypothesisDraftsEnabled,
  type IntakeDependencies } from "./communications-intake";
import { hypothesisPublicationSource, researchPublicationSource, researchPublicationHypotheses } from "./communications-research";
import { readProspectiveDraftSaveDirection, configuredGmailDraftPorts, prepareSameRunDraftSave, saveCommunicationsUnsentDraft } from "./communications-gmail-draft";
import type { CommunicationsDependencies } from "./communications-worker";
import type { CommunicationsAgentsAPI } from "./communications-api";

const ROOT = "blueprintDailyResearch/sites-first";
const hex = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function fail(): never { throw Error("communications_daily_selection_changed"); }
export function researchDraftDay(now: number) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:"America/Chicago",year:"numeric",
    month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  // Match the native scheduler's most recent 07:00 boundary, including DST.
  return Number(parts.hour)>=7?day:new Date(Date.parse(day+"T00:00:00Z")-86400000).toISOString().slice(0,10);
}

/** A selection of an already-published native day, never a qualification rule. */
export function dailyResearchDraftSelection(control: any, snapshot: any, now: number, approvedAt: string) {
  const row = snapshot?.row, day = researchDraftDay(now), pin = control?.site_universe, direction = control?.outreach_ready?.current;
  if (control?.enabled !== true || control?.config?.enabled !== true || control?.workflow?.enabled !== true
    || !/^[a-f0-9]{40}$/.test(control?.source_commit ?? "") || snapshot?.schema_version !== "blueprint.research-snapshot.v1"
    || control?.outreach_ready?.enabled !== true || pin?.enabled !== true
    || !Number.isInteger(pin.slice_size) || pin.slice_size < 1 || pin.slice_size > 5
    || !Number.isFinite(Date.parse(approvedAt)) || day < approvedAt.slice(0, 10)
    || row?.date !== day || row?.run_key !== `blueprint-researcher:${day}` || row?.state !== "completed"
    || row?.qa?.state !== "validated" || !hex(row.packet_digest) || !hex(row.raw_output_digest) || !hex(row.qa.artifact_digest)
    || row.outreach_ready?.state !== "enabled" || row.outreach_ready.direction_sha256 !== direction?.sha256
    || !(Date.parse(direction?.direction?.effective_from) <= now && now < Date.parse(direction?.direction?.expires_at))
    || !Array.isArray(direction.direction.scope?.paths) || !direction.direction.scope.paths.includes("daily_qa")
    || !Number.isInteger(direction.direction.scope.max_rows_per_batch) || direction.direction.scope.max_rows_per_batch > 5
    || direction.direction.scope.max_rows_per_batch < 1) return null;
  const attachment = row.site_universe, block = row.packet?.site_universe;
  if (attachment?.state !== "attached" || attachment.pin?.sha256 !== pin.sha256 || !hex(attachment.slice_sha256)
    || !Array.isArray(attachment.site_ids) || !attachment.site_ids.length || attachment.site_ids.length > 5
    || attachment.site_ids.length !== new Set(attachment.site_ids).size || attachment.site_ids.some((id: unknown) => !hex(id))
    || block?.state !== "attached" || block.slice_sha256 !== attachment.slice_sha256 || block.export_sha256 !== pin.sha256
    || block.link_issue_count !== 0 || !Array.isArray(block.outcomes) || block.outcomes.length !== attachment.site_ids.length
    || new Set(block.outcomes.map((entry:any)=>entry.site_id)).size !== attachment.site_ids.length
    || block.outcomes.some((entry:any)=>!attachment.site_ids.includes(entry.site_id))) return null;
  const linked = block.outcomes.filter((entry: any) => entry.outcome === "candidate" && attachment.site_ids.includes(entry.site_id))
    .map((entry: any) => entry.candidate_key);
  const accepted: unknown[] = row.review?.accepted_keys, hypotheses: unknown[] = row.review?.outreach_ready_keys ?? [];
  if (!Array.isArray(accepted) || !Array.isArray(hypotheses)) return null;
  const keys = [...new Set([...accepted, ...hypotheses].filter((key): key is string => typeof key === "string" && linked.includes(key)))];
  if (!keys.length || keys.length > 5) return null;
  return { date: day, candidateKeys: keys.sort(), packetDigest: row.packet_digest, rawDigest: row.raw_output_digest,
    qaDigest: row.qa.artifact_digest, controlDigest: communicationsDigest({ source:control.source_commit, pin, outreach:control.outreach_ready }) };
}

/** Reuses the existing lap, admission, paid agent and same-run save; no broad queues. */
export async function runDailyResearchDrafts(db: FirebaseFirestore.Firestore, deps: CommunicationsDependencies,
  canContinue: () => boolean, makeApi: (assertCurrent: () => Promise<void>) => CommunicationsAgentsAPI,
  processJob: (id: string, deps: CommunicationsDependencies, canContinue: () => boolean) => Promise<unknown>,
  contactPorts: Pick<IntakeDependencies, "readContactPage" | "readContactDiscovery" | "requestContactResearch">,
  waitForLease: () => Promise<boolean> = async () => canContinue()) {
  if (!canContinue() || !hypothesisDraftsEnabled()
    || process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED !== "false"
    || process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED !== "false") return;
  const direction = await readProspectiveDraftSaveDirection(db, deps.now);
  if (!direction) return;
  const day = researchDraftDay(deps.now()), control = (await db.doc(ROOT).get()).data();
  if (control?.enabled !== true || control?.config?.enabled !== true || control?.workflow?.enabled !== true
    || (await db.doc(`${ROOT}/runs/${day}`).get()).data()?.state !== "completed") return;
  const snapshot: any = await deps.readResearch(day);
  const selection = dailyResearchDraftSelection(control, snapshot, deps.now(), direction.approvedAt);
  if (!selection) return;
  const assertCurrent = async () => {
    if (!await waitForLease() || !canContinue() || !hypothesisDraftsEnabled() || process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED !== "false"
      || process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED !== "false") fail();
    const currentDirection = await readProspectiveDraftSaveDirection(db, deps.now);
    const current: any = await deps.readResearch(day), control = (await db.doc(ROOT).get()).data();
    if (communicationsDigest(currentDirection) !== communicationsDigest(direction)
      || communicationsDigest(dailyResearchDraftSelection(control,current,deps.now(),direction.approvedAt)) !== communicationsDigest(selection)) fail();
    if (!await waitForLease()) fail();
  };
  // Prove every selected publication before its first intake write.
  const published = researchPublicationHypotheses(snapshot);
  for (const key of selection.candidateKeys) {
    if (snapshot.row.review.accepted_keys.includes(key)) researchPublicationSource(snapshot, {
      date:day,candidateKey:key,packetDigest:selection.packetDigest,rawArtifactDigest:selection.rawDigest });
    else if (published.state === "recorded" && published.entries.some(entry => entry.candidateKey === key)) hypothesisPublicationSource(snapshot,key,deps.now());
    else fail();
  }
  const intake: IntakeDependencies = { db, readResearch:deps.readResearch, isSuppressed:deps.isSuppressed, now:deps.now,
    ...contactPorts, dailySelection:{date:day,candidateKeys:selection.candidateKeys,assertCurrent} };
  const admit = (key: string) => snapshot.row.review.accepted_keys.includes(key)
    ? admitPublishedResearch(snapshot,key,intake) : admitPublishedHypothesis(snapshot,key,intake);
  for (const key of selection.candidateKeys) { await assertCurrent(); await admit(key); }
  await assertCurrent(); await runCommunicationsContactRefresh(intake);
  for (const key of selection.candidateKeys) {
    await assertCurrent(); const outcome = await admit(key);
    const id = "jobId" in outcome ? outcome.jobId : undefined;
    if (typeof id !== "string" || !hex(id)) continue;
    const assertJob = async () => {
      await assertCurrent();
      const job = (await db.doc(`blueprintCommunications/default/jobs/${id}`).get()).data();
      if (!job || job.intent !== "outreach" || job.manualDraftRequest || job.savedOutputRecovery
        || !Number.isSafeInteger(job.createdAt) || job.createdAt > deps.now() || job.createdAt < Date.parse(direction.approvedAt)) fail();
      const brief = communicationsBriefSchema.parse(await deps.store.brief(job.briefId));
      const origin = brief.researchOrigin;
      if (job.briefDigest !== communicationsDigest(brief) || job.prospectId !== brief.prospectId
        || origin.date !== day || origin.candidateKey !== key || origin.admissionId || origin.screenAdmissionId
        || origin.packetDigest !== selection.packetDigest || origin.rawArtifactDigest !== selection.rawDigest) fail();
      if (!await waitForLease()) fail();
    };
    await assertJob();
    const basePorts = configuredGmailDraftPorts(), ports = { ...basePorts,
      requireCapability: async () => { await assertJob(); await basePorts.requireCapability(); },
      write: async (...args: Parameters<typeof basePorts.write>) => { await assertJob(); if (args[0].jobId !== id) fail(); return basePorts.write(...args); } };
    await processJob(id,{ ...deps, api:makeApi(assertJob), sendAutomatic:undefined,
      prepareDraftSave: async () => { await assertJob(); return prepareSameRunDraftSave(db,deps.now,ports); },
      saveUnsentDraft: async (jobId,binding,canWrite) => { if(jobId!==id)fail(); await assertJob();
        return saveCommunicationsUnsentDraft(db,jobId,binding,deps.now,ports,canWrite); } },canContinue);
  }
}
