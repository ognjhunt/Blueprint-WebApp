import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { logger, attachRequestMeta } from "../logger";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { createNativeLearningHooks, startNativeLearningScheduler } from "../research-learning/native-hooks";
import { boundResearchLearningHooks } from "../research-learning/research-worker-host";

type ResearchHandle = { stop: () => Promise<void> };
type NativeLearning = ReturnType<typeof createNativeLearningHooks>;
type ResearchPackage = { startDailyResearchWorker: (options: {
  bundleRoot: string; python: string; enabled: true; log: (status: string) => void;
  // The pinned-package owner consumes these callbacks before prompt creation
  // and after native persistence. Older packages ignore the additive field.
  learningHooks?: { beforeRun: (date: string) => Promise<unknown>; afterRun: (date: string) => Promise<void> };
  learningHostModule?: string;
}) => ResearchHandle };
type WorkerDependencies = { loadPackage?: (url: string) => Promise<ResearchPackage>; learning?: NativeLearning | null };

// The reviewed portable package owns the scheduler, provider guards and store.
// This hook adds no research behavior to the ops/outbound schedulers.
export function startDailyResearchWorker(dependencies: WorkerDependencies = {}): ResearchHandle {
  if (process.env.BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED !== "true") {
    return { stop: async () => {} };
  }
  const packageRoot = resolve("dist/daily-research");
  let learning = dependencies.learning ?? null;
  const status = (state: string) => logger.info(attachRequestMeta({ route: "daily-research-learning", state }), "Learning status");
  let aggregate = learning ? startNativeLearningScheduler({ enabled: true, run: learning.daily, onStatus: status }) : null;
  let stopping = false;
  let handle: ResearchHandle | undefined;
  const loadPackage = dependencies.loadPackage ?? (url => import(/* @vite-ignore */ url));
  const loading = loadPackage(pathToFileURL(resolve(packageRoot, "release/tools/daily_research/render_worker.mjs")).href)
    .then(async (module) => {
      if (stopping) return;
      if (dependencies.learning === undefined && dbAdmin) {
        const control = (await dbAdmin.doc("blueprintDailyResearch/sites-first").get()).data()?.learning;
        if (control?.enabled === true) {
          try { learning = boundResearchLearningHooks(dbAdmin, control).hooks; }
          catch { status("authorized_learning_control_unavailable"); }
        }
        if (stopping) return;
        aggregate = learning ? startNativeLearningScheduler({ enabled: true, run: learning.daily, onStatus: status }) : null;
      }
      const selectedLearning = learning;
      handle = module.startDailyResearchWorker({
        bundleRoot: resolve(packageRoot, "release"),
        python: resolve(packageRoot, "venv/bin/python"),
        enabled: true,
        log: (status: string) => logger.info(attachRequestMeta({ route: "daily-research", status }), "Research status"),
        ...(selectedLearning ? { learningHostModule: pathToFileURL(resolve("dist/research-learning/research-worker-host.js")).href } : {}),
        ...(selectedLearning ? { learningHooks: {
          beforeRun: async (date: string) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("native_learning_run_identity_invalid");
            try { await selectedLearning.daily(); } catch { status("daily_overview_unavailable"); }
            try { const context = await selectedLearning.prepareNativeJob("daily_research", `blueprintDailyResearch/sites-first/runs/${date}`);
              if (!context) throw new Error("native_learning_input_unavailable");
              return context.handoff ?? { unknown: context.unknown, paidModelCalls: 0 }; }
            catch { status("native_input_unavailable"); throw new Error("native_learning_input_unavailable"); }
          },
          afterRun: async (date: string) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { status("native_run_identity_invalid"); return; }
            try { await selectedLearning.afterNativeWork(`blueprintDailyResearch/sites-first/runs/${date}`); status("native_run_observed"); }
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
      stopPromise = (async () => { await loading; await Promise.all([handle?.stop(), learningStopped, aggregate?.stop()]); })(); }
    return stopPromise;
  } };
}
