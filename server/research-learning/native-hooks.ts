import { z } from "zod";
import { digest, hash, id, instant, LEARNING_ROOT, sectionSchema } from "./contract";
import { openResearchLearningSession } from "./consumer";
import { verifySourceSnapshot, safeText } from "./prior-research";
import { BusinessHistoryStore } from "./business-history";
import { chicagoDate, recordTerminalRun, runDailyBusinessAnalysis } from "./business-learning-loop";

/** Existing authenticated native callers own these inputs. No model arguments,
 * credentials, provider calls, send authority or source/control mutations. */
export const nativeLearningConfigSchema = z.object({ sourceSnapshotId: hash, principalId: id,
  businessSubjectKeys: z.array(id).min(1).max(10).refine(values => new Set(values).size === values.length),
  focus: z.object({ city: safeText(120), industry: safeText(120) }).strict(),
  maturityDays: z.number().int().min(1).max(90).default(14),
}).strict();
export type NativeLearningConfig = z.input<typeof nativeLearningConfigSchema>;
export const REVIEWED_NATIVE_LEARNING_CONFIG: NativeLearningConfig = {
  sourceSnapshotId: "0e1ccd1e7dcb22cca5df09aea78f2cfbdf857d8fe4436105722234302ddf0527",
  principalId: "blueprint-learning-host", businessSubjectKeys: ["blueprint:research-learning"],
  focus: { city: "Sacramento", industry: "Laundromats" }, maturityDays: 14,
};

const manifestSchema = z.object({ version: z.literal("blueprint.native-learning-job.v1"), jobKey: id,
  configHash: hash, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), asOf: instant,
  sourceSnapshotId: hash, principalId: id, subjectKeys: z.array(id).min(1).max(10),
  prospectIds: z.array(id).max(100).refine(values => new Set(values).size === values.length),
  focus: nativeLearningConfigSchema.shape.focus, maturityDays: z.number().int().min(1).max(90), inputHash: hash,
}).strict();
type Manifest = z.infer<typeof manifestSchema>;

/** Chicago's 06:45 occurs after the DST transition hour. Resolve the IANA
 * offset for that civil date, then verify the computed civil time. */
export function chicagoAggregationTime(value: string) {
  const now = instant.parse(value), day = chicagoDate(now), [year, month, date] = day.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = (time: number) => Object.fromEntries(formatter.formatToParts(time).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  const noon = Date.UTC(year, month-1, date, 12), local = parts(noon);
  const offset = Date.UTC(local.year, local.month-1, local.day, local.hour, local.minute, local.second)-noon;
  const scheduled = Date.UTC(year, month-1, date, 6, 45)-offset, check = parts(scheduled);
  if (check.year !== year || check.month !== month || check.day !== date || check.hour !== 6 || check.minute !== 45) throw new Error("native_learning_chicago_time_invalid");
  return { day, scheduledAt: new Date(scheduled).toISOString(), due: Date.parse(now) >= scheduled };
}

export function createNativeLearningHooks(db: FirebaseFirestore.Firestore, configValue: NativeLearningConfig,
  clock = () => new Date().toISOString()) {
  const config = nativeLearningConfigSchema.parse(configValue), configHash = digest(config);
  const expires = () => new Date(Date.parse(instant.parse(clock()))+15*60000).toISOString();
  const businessScope = () => ({ principalId: config.principalId, subjectKeys: config.businessSubjectKeys, expiresAt: expires() });
  const jobKey = (day: string) => `daily-learning-${day}-${configHash.slice(0,16)}`;
  async function readScope() {
    const saved = await db.doc(LEARNING_ROOT).collection("sourceSnapshots").doc(config.sourceSnapshotId).get();
    if (!saved.exists) throw new Error("native_learning_source_missing");
    const source = verifySourceSnapshot(saved.data());
    if (source.snapshotId !== config.sourceSnapshotId || source.asOf > instant.parse(clock())) throw new Error("native_learning_source_changed_or_future");
    // Existing company CRM authority covers structured prospect IDs. Do not
    // fetch contacts/notes or search any mailbox to build the shared scope.
    const prospects = await db.collection("outboundProspects").select("researchPublicationId").limit(101).get();
    if (prospects.size > 100) throw new Error("native_learning_prospect_export_or_partition_required");
    const prospectIds = prospects.docs.map(doc => id.parse(doc.id)).sort();
    return { source, prospectIds };
  }
  function validateManifest(value: unknown, expectedKey: string): Manifest {
    const manifest = manifestSchema.parse(value), { inputHash, ...body } = manifest;
    if (digest(body) !== inputHash || manifest.jobKey !== expectedKey || jobKey(manifest.day) !== expectedKey || manifest.configHash !== configHash
      || manifest.sourceSnapshotId !== config.sourceSnapshotId || manifest.principalId !== config.principalId
      || digest(manifest.subjectKeys) !== digest(config.businessSubjectKeys) || digest(manifest.focus) !== digest(config.focus)
      || manifest.maturityDays !== config.maturityDays || chicagoDate(manifest.asOf) !== manifest.day
      || manifest.asOf > instant.parse(clock())) throw new Error("native_learning_manifest_changed");
    return manifest;
  }
  async function daily() {
    const schedule = chicagoAggregationTime(clock());
    if (!schedule.due) return { state: "not_due" as const, ...schedule, paidModelCalls: 0 };
    const key = jobKey(schedule.day), ref = db.doc(LEARNING_ROOT).collection("nativeLearningJobs").doc(key);
    const prior = await ref.get();
    let manifest: Manifest;
    if (prior.exists) manifest = validateManifest(prior.data(), key);
    else {
      const scope = await readScope(), body = { version: "blueprint.native-learning-job.v1" as const,
        jobKey: key, configHash, day: schedule.day, asOf: instant.parse(clock()), sourceSnapshotId: config.sourceSnapshotId,
        principalId: config.principalId, subjectKeys: config.businessSubjectKeys, prospectIds: scope.prospectIds,
        focus: config.focus, maturityDays: config.maturityDays };
      const planned = validateManifest({ ...body, inputHash: digest(body) }, key);
      manifest = await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (current.exists) return validateManifest(current.data(), key);
        // Calling the trusted clock also observes shutdown before the create.
        instant.parse(clock()); tx.create(ref, planned); return planned;
      });
    }
    if (!manifest.prospectIds.length) {
      const history = await new BusinessHistoryStore(db, clock).read(businessScope(), manifest.asOf);
      return { state: "no_authorized_native_prospects" as const, day: manifest.day, jobKey: key, asOf: manifest.asOf,
        businessHistoryHash: history.historyHash, businessRecords: history.current.length,
        unknowns: ["native_outcome_denominators_unavailable"], paidModelCalls: 0 };
    }
    const scope = businessScope(), result = await runDailyBusinessAnalysis(db, { jobKey: key, businessScope: scope,
      learningGrant: { principalId: config.principalId, prospectIds: manifest.prospectIds, sections: [...sectionSchema.options], expiresAt: scope.expiresAt },
      request: { prospectIds: manifest.prospectIds, sections: [...sectionSchema.options], asOf: manifest.asOf, maturityDays: manifest.maturityDays }, focus: manifest.focus }, clock);
    return { state: "completed" as const, day: manifest.day, jobKey: key, ...result, paidModelCalls: 0 };
  }
  async function beforeWork(role: "daily_research" | "communications", selectedProspectIds: string[] = []) {
    try {
      const scope = await readScope(), selected = z.array(id).max(10).parse(selectedProspectIds);
      if (selected.some(value => !scope.prospectIds.includes(value))) throw new Error("native_learning_selected_prospect_denied");
      const schedule = chicagoAggregationTime(clock()), overviewDay = schedule.due ? schedule.day : chicagoDate(new Date(Date.parse(schedule.scheduledAt)-24*3600000).toISOString());
      const expiry = expires();
      const session = await openResearchLearningSession(db, { version: "blueprint.research-learning-consumer-binding.v1",
        principalId: config.principalId, role, sourceSnapshotId: config.sourceSnapshotId,
        crmIds: scope.source.scope.crmIds, prospectIds: scope.prospectIds,
        discoveryCapabilityIds: scope.source.scope.capabilityIds, detailCapabilityIds: scope.source.scope.capabilityIds, expiresAt: expiry },
      { crmIds: role === "daily_research" ? scope.source.scope.crmIds.slice(0,10) : [],
        prospectIds: selected, capabilityIds: [], focus: config.focus, maturityDays: config.maturityDays }, clock,
      { businessHistory: { principalId: config.principalId, subjectKeys: config.businessSubjectKeys, expiresAt: expiry },
        businessOverviewJobKey: jobKey(overviewDay), nativeSourceCutoff: true });
      return { available: true as const, ...session };
    } catch {
      return { available: false as const, unknown: "native_learning_context_unavailable", paidModelCalls: 0 };
    }
  }
  async function afterNativeWork(recordRef: string) {
    // Parse path before fetching; callers pass the exact record they own.
    const parsed = z.string().regex(/^blueprint(?:DailyResearch\/sites-first\/(?:runs|workItems)|Communications\/default\/jobs)\/[A-Za-z0-9_.:-]+$/).parse(recordRef);
    const saved = await db.doc(parsed).get();
    if (!saved.exists) throw new Error("native_learning_run_missing");
    const sourceHash = digest(saved.data()), recordId = `BP-RUN-${digest({ recordRef: parsed, sourceHash })}`;
    return recordTerminalRun(db, { recordId, subjectKey: config.businessSubjectKeys[0], principalId: config.principalId,
      runId: id.parse(saved.id), receipt: { recordRef: parsed, sourceHash, checkedAt: instant.parse(clock()) } }, clock);
  }
  return { beforeWork, afterNativeWork, daily, jobKey };
}

/** The existing native worker owns start/stop. Single-flight ticks and a durable
 * daily manifest prevent duplicate aggregation; no research/provider starts. */
export function startNativeLearningScheduler(options: { enabled: boolean; run: () => Promise<unknown>;
  onStatus?: (state: string) => void; intervalMs?: number; clock?: () => string }) {
  let stopped = !options.enabled, active: Promise<void> | null = null, stopPromise: Promise<void> | null = null;
  let completedDay: string | null = null;
  const clock = options.clock ?? (() => new Date().toISOString());
  const tick = () => {
    if (stopped || active || completedDay === chicagoDate(clock())) return;
    active = options.run().then(result => {
      const value = result as any;
      if (["completed", "no_authorized_native_prospects"].includes(value?.state) && value?.day === chicagoDate(clock())) completedDay = value.day;
      options.onStatus?.(value?.state === "completed" ? "completed" : "observed");
    })
      .catch(() => { options.onStatus?.("unavailable"); }).finally(() => { active = null; });
  };
  const timer = options.enabled ? setInterval(tick, options.intervalMs ?? 60000) : null;
  timer?.unref();
  if (options.enabled) tick();
  return { stop: () => {
    if (stopPromise) return stopPromise;
    stopped = true; if (timer) clearInterval(timer);
    stopPromise = active ?? Promise.resolve(); return stopPromise;
  } };
}
