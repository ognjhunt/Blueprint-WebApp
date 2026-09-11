/**
 * Which provider and model each structured lane will actually use.
 *
 * Read-only and free: it resolves the same routing the runtime resolves and
 * prints it, without calling a provider. `npm run smoke:agent` proves a
 * provider answers; this proves you are pointed at the one you think you are.
 *
 * Exists because the provider used to be a single global switch. A per-lane
 * model override could sit in the deployed code doing nothing because the lane
 * was routed elsewhere, and the only way to find out was to read the provider
 * field on a run after the fact.
 */
import { getAgentRuntimeConnectionMetadata } from "../server/agents/runtime-connectivity";

function main() {
  const connectivity = getAgentRuntimeConnectionMetadata();

  console.log(`global provider : ${connectivity.provider}`);
  console.log(`  configured    : ${connectivity.configured ? "yes" : "NO"}`);
  console.log(`  fallback      : ${connectivity.fallback_provider ?? "none"}`);
  console.log("");
  console.log("lane routing:");

  const lanes = Object.keys(connectivity.task_providers) as Array<
    keyof typeof connectivity.task_providers
  >;
  const width = Math.max(...lanes.map((lane) => lane.length));
  for (const lane of lanes) {
    const provider = connectivity.task_providers[lane];
    const model = connectivity.task_models[lane] ?? "(none)";
    console.log(`  ${lane.padEnd(width)}  ${provider}  ${model}`);
  }

  if (connectivity.unhonored_lane_providers.length === 0) {
    process.exit(0);
  }

  console.log("");
  console.error("lane overrides that did NOT take effect:");
  for (const entry of connectivity.unhonored_lane_providers) {
    console.error(
      `  ${entry.env_key}=${entry.requested} -> running on ${entry.using} (${entry.reason})`,
    );
  }
  process.exit(1);
}

main();
