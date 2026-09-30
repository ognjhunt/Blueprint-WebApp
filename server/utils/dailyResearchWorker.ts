import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { logger, attachRequestMeta } from "../logger";

type ResearchHandle = { stop: () => Promise<void> };

// The reviewed portable package owns the scheduler, provider guards and store.
// This hook adds no research behavior to the ops/outbound schedulers.
export function startDailyResearchWorker(): ResearchHandle {
  if (process.env.BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED !== "true") {
    return { stop: async () => {} };
  }
  const packageRoot = resolve("dist/daily-research");
  let stopping = false;
  let handle: ResearchHandle | undefined;
  const loading = import(pathToFileURL(resolve(packageRoot, "release/tools/daily_research/render_worker.mjs")).href)
    .then((module) => {
      if (stopping) return;
      handle = module.startDailyResearchWorker({
        bundleRoot: resolve(packageRoot, "release"),
        python: resolve(packageRoot, "venv/bin/python"),
        enabled: true,
        log: (status: string) => logger.info(attachRequestMeta({ route: "daily-research", status }), "Research status"),
      });
    })
    .catch(() => {
      logger.error(attachRequestMeta({ route: "daily-research", error: "research_package_unavailable" }), "Research worker could not start");
    });
  return { stop: async () => { stopping = true; await loading; await handle?.stop(); } };
}
