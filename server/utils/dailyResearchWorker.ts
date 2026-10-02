import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { logger, attachRequestMeta } from "../logger";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { createNativeLearningHooks, REVIEWED_NATIVE_LEARNING_CONFIG, startNativeLearningScheduler } from "../research-learning/native-hooks";

type ResearchHandle = { stop: () => Promise<void> };
type NativeLearning = ReturnType<typeof createNativeLearningHooks>;
type ResearchPackage = { startDailyResearchWorker: (options: {
  bundleRoot: string; python: string; enabled: true; log: (status: string) => void;
  // The pinned-package owner consumes these callbacks before prompt creation
  // and after native persistence. Older packages ignore the additive field.
  learningHooks?: { beforeRun: () => Promise<unknown>; afterRun: (date: string) => Promise<void> };
}) => ResearchHandle };
type WorkerDependencies = { loadPackage?: (url: string) => Promise<ResearchPackage>; learning?: NativeLearning | null };

// The reviewed portable package owns the scheduler, provider guards and store.
// This hook adds no research behavior to the ops/outbound schedulers.
export function startDailyResearchWorker(dependencies: WorkerDependencies = {}): ResearchHandle {
  if (process.env.BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED !== "true") {
    return { stop: async () => {} };
  }
  const packageRoot = resolve("dist/daily-research");
  const learning = dependencies.learning !== undefined ? dependencies.learning
    : dbAdmin ? createNativeLearningHooks(dbAdmin, REVIEWED_NATIVE_LEARNING_CONFIG) : null;
  const status = (state: string) => logger.info(attachRequestMeta({ route: "daily-research-learning", state }), "Learning status");
  const aggregate = learning ? startNativeLearningScheduler({ enabled: true, run: learning.daily, onStatus: status }) : null;
  let stopping = false;
  let handle: ResearchHandle | undefined;
  const loadPackage = dependencies.loadPackage ?? (url => import(/* @vite-ignore */ url));
  const loading = loadPackage(pathToFileURL(resolve(packageRoot, "release/tools/daily_research/render_worker.mjs")).href)
    .then((module) => {
      if (stopping) return;
      handle = module.startDailyResearchWorker({
        bundleRoot: resolve(packageRoot, "release"),
        python: resolve(packageRoot, "venv/bin/python"),
        enabled: true,
        log: (status: string) => logger.info(attachRequestMeta({ route: "daily-research", status }), "Research status"),
        ...(learning ? { learningHooks: {
          beforeRun: async () => {
            try { await learning.daily(); } catch { status("daily_overview_unavailable"); }
            const context = await learning.beforeWork("daily_research");
            return context.available ? context.handoff : { unknown: context.unknown, paidModelCalls: 0 }; },
          afterRun: async (date: string) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { status("native_run_identity_invalid"); return; }
            try { await learning.afterNativeWork(`blueprintDailyResearch/sites-first/runs/${date}`); status("native_run_observed"); }
            catch { status("native_run_observation_unavailable"); }
          },
        } } : {}),
      });
    })
    .catch(() => {
      logger.error(attachRequestMeta({ route: "daily-research", error: "research_package_unavailable" }), "Research worker could not start");
    });
  let stopPromise: Promise<void> | undefined;
  return { stop: () => {
    if (!stopPromise) { stopping = true; const learningStopped = aggregate?.stop();
      stopPromise = (async () => { await loading; await Promise.all([handle?.stop(), learningStopped]); })(); }
    return stopPromise;
  } };
}
