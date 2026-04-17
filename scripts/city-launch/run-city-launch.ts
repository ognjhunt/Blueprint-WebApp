import path from "node:path";
import {
  runCityLaunchExecutionHarness,
} from "../../server/utils/cityLaunchExecutionHarness";
import {
  runCityLaunchPlanningHarness,
  slugifyCityName,
} from "../../server/utils/cityLaunchPlanningHarness";
import { runCityLaunchContactEnrichment } from "../../server/utils/cityLaunchContactEnrichment";
import { resolveCityLaunchPlanningState } from "../../server/utils/cityLaunchPlanningState";
import { buildCityLaunchBudgetPolicy, type CityLaunchBudgetTier } from "../../server/utils/cityLaunchPolicy";
import { dispatchCityLaunchFounderApproval } from "../../server/utils/cityLaunchApprovalDispatch";
import {
  resolveCityLaunchFounderApproval,
  shouldDispatchCityLaunchApproval,
} from "../../server/utils/cityLaunchApprovalMode";
import { resolveHistoricalRecipientEvidence } from "../../server/utils/cityLaunchRecipientEvidence";

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

type RunPhase = "plan" | "enrich" | "approve" | "activate" | "full";

async function main() {
  const args = process.argv.slice(2);
  const city = getFlagValue(args, "--city");
  if (!city) {
    throw new Error("Required: --city \"City, ST\" (e.g. --city \"Chapel Hill, NC\")");
  }

  const budgetMaxUsdValue = getFlagValue(args, "--budget-max-usd");
  const budgetMaxUsd = budgetMaxUsdValue ? Number(budgetMaxUsdValue) : undefined;
  const budgetTier = (getFlagValue(args, "--budget-tier") || undefined) as
    | CityLaunchBudgetTier
    | undefined;
  const phase: RunPhase = (getFlagValue(args, "--phase") as RunPhase) || "full";
  const skipPlan = hasFlag(args, "--skip-plan");
  const skipApproval = hasFlag(args, "--skip-approval");
  const requireFounderApproval = hasFlag(args, "--require-founder-approval");
  const founderApproved = resolveCityLaunchFounderApproval({
    phase,
    founderApprovedFlag: hasFlag(args, "--founder-approved"),
    requireFounderApproval,
  });
  const operatorAutoApproveUsdValue = getFlagValue(args, "--operator-auto-approve-usd");
  const operatorAutoApproveUsd = operatorAutoApproveUsdValue
    ? Number(operatorAutoApproveUsdValue)
    : undefined;
  const rewakeTaskKeys = getFlagValue(args, "--rewake-task-keys")
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean) || [];
  const rewakeOwnerLanes = getFlagValue(args, "--rewake-owner-lanes")
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean) || [];

  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: budgetTier,
    maxTotalApprovedUsd: budgetMaxUsd,
    operatorAutoApproveUsd,
  });

  console.log(
    JSON.stringify({
      phase: "init",
      city,
      budgetTier: budgetPolicy.tier,
      budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
      operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
      runPhase: phase,
      skipPlan,
      skipApproval,
      founderApproved,
      requireFounderApproval,
    }),
  );

  // Phase 1: Plan (Deep Research)
  if (!skipPlan && (phase === "plan" || phase === "full")) {
    console.log(JSON.stringify({ phase: "plan", status: "starting", city }));

    const planResult = await runCityLaunchPlanningHarness({
      city,
      region: getFlagValue(args, "--region") || undefined,
      fileSearchStoreNames: getFlagValue(args, "--file-search-store")
        ?.split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      critiqueRounds: Number(getFlagValue(args, "--critique-rounds") || "1"),
      pollIntervalMs: Number(getFlagValue(args, "--poll-interval-ms") || "10000"),
      timeoutMs: Number(getFlagValue(args, "--timeout-ms") || String(20 * 60 * 1000)),
    });

    console.log(
      JSON.stringify({
        phase: "plan",
        status: "completed",
        city: planResult.city,
        citySlug: planResult.citySlug,
        canonicalPlaybookPath: planResult.artifacts.canonicalPlaybookPath,
        canonicalActivationPayloadPath:
          planResult.artifacts.canonicalActivationPayloadPath,
        stageCount: planResult.stages.length,
      }),
    );

    if (phase === "plan") {
      return;
    }
  }

  // Phase 2: Approve (Generate + present approval packet)
  if (phase === "enrich" || phase === "full") {
    const planningState = await resolveCityLaunchPlanningState({ city });
    if (planningState.completedArtifactPath) {
      console.log(JSON.stringify({ phase: "enrich", status: "starting", city }));
      const citySlug = slugifyCityName(city);
      const enrichmentResult = await runCityLaunchContactEnrichment({
        city,
        artifactPath: planningState.completedArtifactPath,
        outputPath: path.resolve(
          process.cwd(),
          "ops/paperclip/playbooks",
          `city-launch-${citySlug}-contact-enrichment.json`,
        ),
        resolveRecipientEvidence: resolveHistoricalRecipientEvidence,
      });

      console.log(
        JSON.stringify({
          phase: "enrich",
          status: enrichmentResult.status,
          city,
          recoveredBuyerTargetContacts: enrichmentResult.recoveredBuyerTargetContacts,
          recoveredCaptureCandidateContacts: enrichmentResult.recoveredCaptureCandidateContacts,
          unresolvedBuyerTargets: enrichmentResult.unresolvedBuyerTargets,
          unresolvedCaptureCandidates: enrichmentResult.unresolvedCaptureCandidates,
          outputPath: enrichmentResult.outputPath,
        }),
      );

      if (phase === "enrich") {
        return;
      }
    } else if (phase === "enrich") {
      throw new Error(`No completed deep-research artifact found for ${city}.`);
    }
  }

  // Phase 3: Approve (Generate + present approval packet)
  if (
    !skipApproval
    && shouldDispatchCityLaunchApproval({
      phase,
      founderApproved,
      requireFounderApproval,
    })
  ) {
    console.log(JSON.stringify({ phase: "approve", status: "starting", city }));

    const approvalResult = await dispatchCityLaunchFounderApproval({
      city,
      budgetPolicy,
    });

    console.log(
      JSON.stringify({
        phase: "approve",
        status: approvalResult.dispatched ? "dispatched" : "skipped",
        city,
        blockerId: approvalResult.blockerId,
        approvalCount: approvalResult.approvalCount,
        emailSent: approvalResult.emailSent,
        slackMirrored: approvalResult.slackMirrored,
        message: approvalResult.dispatched
          ? "Founder approval packet dispatched. Activation will resume automatically after the approval reply is recorded."
          : "Approval dispatch skipped because the city is already approved or the manual approval lane is unavailable.",
      }),
    );

    if (phase === "approve" || !founderApproved) {
      return;
    }
  }

  // Phase 4: Activate (Build execution harness + dispatch Paperclip issues)
  if (phase === "activate" || phase === "full") {
    console.log(JSON.stringify({ phase: "activate", status: "starting", city }));

    const activateResult = await runCityLaunchExecutionHarness({
      city,
      founderApproved,
      budgetTier: budgetPolicy.tier,
      budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
      operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
      rewakeTaskKeys,
      rewakeOwnerLanes,
    });

    console.log(
      JSON.stringify({
        phase: "activate",
        status: "completed",
        city: activateResult.city,
        activationStatus: activateResult.activationStatus,
        budgetTier: activateResult.budgetTier,
        canonicalSystemDocPath:
          activateResult.artifacts.canonicalSystemDocPath,
        canonicalIssueBundlePath:
          activateResult.artifacts.canonicalIssueBundlePath,
        paperclipRootIssueId:
          activateResult.paperclip?.rootIssueId || null,
        dispatchedIssueCount:
          activateResult.paperclip?.dispatched.length || 0,
        wokenIssueCount:
          activateResult.paperclip?.dispatched.filter(
            (e) =>
              e.wakeStatus &&
              e.wakeStatus !== "skipped" &&
              e.wakeStatus !== "skipped_existing",
          ).length || 0,
        prospectsUpserted:
          activateResult.researchMaterialization?.prospectsUpserted || 0,
        buyerTargetsUpserted:
          activateResult.researchMaterialization?.buyerTargetsUpserted || 0,
      }),
    );
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
