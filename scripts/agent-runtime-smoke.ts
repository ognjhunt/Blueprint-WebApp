import {
  getAgentRuntimeConnectionMetadata,
  runAgentRuntimeSmokeTest,
} from "../server/agents/runtime-connectivity";

async function main() {
  const connectivity = getAgentRuntimeConnectionMetadata();
  const result = await runAgentRuntimeSmokeTest({
    model: connectivity.task_models.operator_thread || connectivity.default_model,
  });

  if (!result.ok) {
    console.error("Agent runtime smoke test failed.");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("Agent runtime smoke test passed.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
