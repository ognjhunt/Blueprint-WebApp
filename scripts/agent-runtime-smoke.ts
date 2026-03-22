import { runAgentRuntimeSmokeTest } from "../server/agents/runtime-connectivity";

async function main() {
  const result = await runAgentRuntimeSmokeTest({
    model: process.env.OPENAI_OPERATOR_THREAD_MODEL || process.env.OPENAI_DEFAULT_MODEL,
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
