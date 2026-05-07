import {
  verifyCityLaunchReadinessCloseoutFile,
} from "../../server/utils/cityLaunchCloseoutVerifier";

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

async function main() {
  const args = process.argv.slice(2);
  const reportJsonPath =
    getFlagValue(args, "--report-json")
    || getFlagValue(args, "--readiness-preflight-json");
  if (!reportJsonPath) {
    throw new Error("Required: --report-json path/to/readiness-preflight.json");
  }

  const verification = await verifyCityLaunchReadinessCloseoutFile({
    reportJsonPath,
    requireReady: hasFlag(args, "--require-ready"),
  });

  console.log(JSON.stringify(verification, null, 2));

  if (verification.status !== "pass" && !hasFlag(args, "--allow-fail")) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
