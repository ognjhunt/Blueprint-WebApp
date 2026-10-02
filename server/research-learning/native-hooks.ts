import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { digest, hash, id, instant, LEARNING_ROOT, sectionSchema } from "./contract";
import { openResearchLearningSession } from "./consumer";
import { verifySourceSnapshot, safeText } from "./prior-research";
import { BusinessHistoryStore } from "./business-history";
import { chicagoDate, recordTerminalRun, runDailyBusinessAnalysis } from "./business-learning-loop";
import { validateNativeHandoff } from "./native-handoff";

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
type Handoff = Awaited<ReturnType<typeof openResearchLearningSession>>["handoff"];
const nativeRefSchema = z.string().regex(/^blueprint(?:DailyResearch\/sites-first\/runs\/\d{4}-\d{2}-\d{2}|Communications\/default\/jobs\/[A-Za-z0-9_.:-]+)$/);
const nativeInputSchema = z.object({ version: z.literal("blueprint.native-learning-input.v1"), configHash: hash,
  nativeRecordRef: nativeRefSchema, role: z.enum(["daily_research", "communications"]),
  prospectIds: z.array(id).max(10).refine(values => new Set(values).size === values.length),
  sourceSnapshotId: hash, preparedAt: instant, handoff: z.unknown().nullable(),
  unknown: z.literal("native_learning_context_unavailable").nullable(), inputHash: hash,
}).strict();
const nativeInputBindingSchema = nativeInputSchema.pick({ version: true, configHash: true, nativeRecordRef: true,
  role: true, prospectIds: true, sourceSnapshotId: true, inputHash: true }).extend({
  version: z.literal("blueprint.native-learning-input-binding.v1"),
}).strict();

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
  async function readScope(asOf?: string) {
    const sourceRef = db.doc(LEARNING_ROOT).collection("sourceSnapshots").doc(config.sourceSnapshotId);
    const query = db.collection("outboundProspects").select("researchPublicationId").limit(101);
    // Pin both reads to the supplied millisecond cutoff. Sampling the clock
    // after a query could silently omit a prospect created in that gap.
    const readTime = asOf ? Timestamp.fromDate(new Date(instant.parse(asOf))) : null;
    const { saved, prospects } = readTime ? await db.runTransaction(async tx => {
      const saved = await tx.get(sourceRef), prospects = await tx.get(query);
      if (!prospects.readTime || prospects.readTime.seconds !== readTime.seconds
        || prospects.readTime.nanoseconds !== readTime.nanoseconds) throw new Error("native_learning_scope_read_time_unverified");
      return { saved, prospects };
    }, { readOnly: true, readTime }) : { saved: await sourceRef.get(), prospects: await query.get() };
    if (!saved.exists) throw new Error("native_learning_source_missing");
    const source = verifySourceSnapshot(saved.data());
    if (source.snapshotId !== config.sourceSnapshotId || source.asOf > instant.parse(asOf ?? clock())) throw new Error("native_learning_source_changed_or_future");
    // Existing company CRM authority covers structured prospect IDs. Do not
    // fetch contacts/notes or search any mailbox to build the shared scope.
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
      const asOf = instant.parse(clock()), scope = await readScope(asOf), body = { version: "blueprint.native-learning-job.v1" as const,
        jobKey: key, configHash, day: schedule.day, asOf, sourceSnapshotId: config.sourceSnapshotId,
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
    const currentScope = await readScope();
    if (manifest.prospectIds.some(value => !currentScope.prospectIds.includes(value))) throw new Error("native_learning_manifest_scope_denied");
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
      const asOf = instant.parse(clock()), scope = await readScope(asOf), selected = z.array(id).max(10).parse(role === "daily_research" && !selectedProspectIds.length
        ? scope.prospectIds.slice(0,10) : selectedProspectIds);
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
        businessOverviewJobKey: jobKey(overviewDay), nativeSourceCutoff: true, frozenAsOf: asOf });
      return { available: true as const, selectedProspectIds: selected, ...session };
    } catch {
      return { available: false as const, unknown: "native_learning_context_unavailable", paidModelCalls: 0 };
    }
  }
  /** Trusted native caller only: freeze the exact structured input before a
   * NEW request. Existing provider checkpoints must retain their original input.
   * Replay reauthorizes current scope but never rebuilds an old request digest. */
  async function prepareNativeJob(role: "daily_research" | "communications", recordRef: string, selectedProspectIds: string[] = [],
    options: { allowCreate?: boolean } = {}) {
    const { allowCreate } = z.object({ allowCreate: z.boolean().default(true) }).strict().parse(options);
    const parsed = nativeRefSchema.parse(recordRef), selected = z.array(id).max(10).parse(selectedProspectIds).sort();
    if (new Set(selected).size !== selected.length || (role === "communications") !== parsed.startsWith("blueprintCommunications/")) throw new Error("native_learning_job_identity_invalid");
    if (role === "communications") {
      if (selected.length !== 1) throw new Error("native_learning_job_scope_invalid");
      const job = await db.doc(parsed).get();
      if (!job.exists || job.data()?.jobId !== job.id || job.data()?.prospectId !== selected[0]) throw new Error("native_learning_job_scope_invalid");
      const prospect = await db.collection("outboundProspects").doc(selected[0]).get();
      if (!prospect.exists) throw new Error("native_learning_job_scope_invalid");
    } else {
      const day = parsed.split("/").at(-1)!;
      if (selected.length || !Number.isFinite(Date.parse(`${day}T12:00:00Z`)) || new Date(`${day}T12:00:00Z`).toISOString().slice(0,10) !== day) throw new Error("native_learning_job_identity_invalid");
    }
    const inputs = db.doc(LEARNING_ROOT).collection("nativeLearningInputs"), bindingRef = inputs.doc(digest({ role, recordRef: parsed }));
    const verifyIdentity = (input: z.infer<typeof nativeInputBindingSchema> | z.infer<typeof nativeInputSchema>) => {
      if (input.configHash !== configHash || input.nativeRecordRef !== parsed || input.role !== role
        || (role === "communications" && digest(input.prospectIds) !== digest(selected))
        || input.sourceSnapshotId !== config.sourceSnapshotId) throw new Error("native_learning_input_changed");
    };
    const verify = async (value: unknown, expectedHash: string) => {
      const input = nativeInputSchema.parse(value), { inputHash, ...body } = input;
      verifyIdentity(input);
      if (digest(body) !== inputHash || inputHash !== expectedHash
        || input.preparedAt > instant.parse(clock())) throw new Error("native_learning_input_changed");
      let handoff: Handoff | null = null;
      if (input.handoff) {
        if (input.unknown !== null) throw new Error("native_learning_input_context_changed");
        const scope = await readScope();
        handoff = await validateNativeHandoff(input.handoff, { role, principalId: config.principalId,
          subjectKeys: config.businessSubjectKeys, selectedProspectIds: input.prospectIds, source: scope.source,
          companyProspectIds: scope.prospectIds, focus: config.focus, preparedAt: input.preparedAt, now: instant.parse(clock()) }, db);
      } else if (input.handoff !== null || !input.unknown || (role === "daily_research" && input.prospectIds.length)) throw new Error("native_learning_input_context_changed");
      return { ...input, handoff };
    };
    const loadBound = async (value: unknown) => {
      const binding = nativeInputBindingSchema.parse(value); verifyIdentity(binding);
      const ref = inputs.doc(binding.inputHash), saved = await ref.get();
      if (!saved.exists) throw new Error("native_learning_input_missing");
      const input = await verify(saved.data(), saved.id);
      if (digest(input.prospectIds) !== digest(binding.prospectIds)) throw new Error("native_learning_input_changed");
      return { ...input, recordRef: ref.path, bindingRef: bindingRef.path, replay: true };
    };
    const prior = await bindingRef.get();
    if (prior.exists) return loadBound(prior.data());
    if (!allowCreate) return null;
    const context = await beforeWork(role, selected), body = { version: "blueprint.native-learning-input.v1" as const,
      configHash, nativeRecordRef: parsed, role, prospectIds: context.available ? [...context.selectedProspectIds].sort() : selected,
      sourceSnapshotId: config.sourceSnapshotId,
      preparedAt: instant.parse(clock()), handoff: context.available ? context.handoff : null,
      unknown: context.available ? null : context.unknown };
    const planned = await verify({ ...body, inputHash: digest(body) }, digest(body));
    if (Buffer.byteLength(JSON.stringify(planned)) > 900000) throw new Error("native_learning_input_export_or_narrow_scope_required");
    const binding = nativeInputBindingSchema.parse({ version: "blueprint.native-learning-input-binding.v1", configHash,
      nativeRecordRef: parsed, role, prospectIds: planned.prospectIds, sourceSnapshotId: config.sourceSnapshotId, inputHash: planned.inputHash });
    const ref = inputs.doc(planned.inputHash);
    const saved = await db.runTransaction(async tx => { const current = await tx.get(bindingRef), content = await tx.get(ref);
      if (current.exists) return { binding: current.data(), replay: true };
      if (content.exists && digest(content.data()) !== digest(planned)) throw new Error("native_learning_input_changed");
      instant.parse(clock());
      if (!content.exists) tx.create(ref, planned);
      tx.create(bindingRef, binding); return { binding, replay: false };
    });
    return { ...await loadBound(saved.binding), replay: saved.replay };
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
  return { beforeWork, prepareNativeJob, afterNativeWork, daily, jobKey };
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
