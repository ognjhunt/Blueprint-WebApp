import { promises as fs } from "node:fs";
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
import {
  buildCityLaunchBudgetPolicy,
} from "../../server/utils/cityLaunchPolicy";
import { summarizeCityLaunchAutonomyCertification } from "../../server/utils/cityLaunchAutonomyCertification";
import {
  resolveCityLaunchFounderApproval,
} from "../../server/utils/cityLaunchApprovalMode";
import { resolveHistoricalRecipientEvidence } from "../../server/utils/cityLaunchRecipientEvidence";
import {
  buildCityLaunchFounderApprovalPacket,
  dispatchCityLaunchFounderApprovalBlocker,
  renderCityLaunchFounderApprovalArtifact,
  resolveCityLaunchFounderApprovalFromDurableState,
} from "../../server/utils/cityLaunchFounderApproval";
import {
  resolveCityLaunchDeepResearchFailure,
  resolveCityLaunchCityInput,
  resolveCityLaunchFounderBudgetMaxUsdInput,
  resolveCityLaunchFounderBudgetTierInput,
  resolveCityLaunchHumanBlockerDeliveryMode,
  resolveCityLaunchWindowHours,
} from "../../server/utils/cityLaunchRunControl";
import {
  writeCityLaunchCreativeAdsEvidence,
} from "../../server/utils/cityLaunchCreativeAdsEvidence";
import {
  runCityLaunchReadinessPreflight,
} from "../../server/utils/cityLaunchReadinessPreflight";
import {
  writeCityLaunchReadinessPreflightCloseoutVerification,
  writeCityLaunchReadinessPreflightReport,
} from "../../server/utils/cityLaunchReadinessPreflightReport";
import {
  verifyCityLaunchReadinessCloseout,
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

type RunPhase = "plan" | "enrich" | "approve" | "activate" | "full";

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

async function writeFounderDecisionPacket(input: {
  city: string;
  budgetPolicy: ReturnType<typeof buildCityLaunchBudgetPolicy>;
  reportsRoot: string;
  humanBlockerDeliveryMode: ReturnType<typeof resolveCityLaunchHumanBlockerDeliveryMode>;
}) {
  const citySlug = slugifyCityName(input.city);
  const runDirectory = path.resolve(
    input.reportsRoot,
    citySlug,
    timestampForFile(),
  );
  const founderDecisionPacketPath = path.join(runDirectory, "founder-decision-packet.md");
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.writeFile(
    founderDecisionPacketPath,
    renderCityLaunchFounderApprovalArtifact({
      city: input.city,
      budgetPolicy: input.budgetPolicy,
    }),
    "utf8",
  );
  const humanBlockerDispatch = await dispatchCityLaunchFounderApprovalBlocker({
    packet: buildCityLaunchFounderApprovalPacket({
      city: input.city,
      budgetPolicy: input.budgetPolicy,
    }),
    packetPath: founderDecisionPacketPath,
    deliveryMode: input.humanBlockerDeliveryMode,
  });
  return {
    founderDecisionPacketPath,
    humanBlockerDispatch,
  };
}

async function writeReadinessCloseout(input: {
  city: string;
  budgetPolicy: ReturnType<typeof buildCityLaunchBudgetPolicy>;
  windowHours: ReturnType<typeof resolveCityLaunchWindowHours>;
  founderApproved: boolean;
  requireFounderApproval: boolean;
  executionReportsRoot: string;
  planningReportsRoot?: string | null;
}) {
  const result = await runCityLaunchReadinessPreflight({
    city: input.city,
    budgetTier: input.budgetPolicy.tier,
    budgetMaxUsd: input.budgetPolicy.maxTotalApprovedUsd,
    operatorAutoApproveUsd: input.budgetPolicy.operatorAutoApproveUsd,
    windowHours: input.windowHours,
    founderApproved: input.founderApproved,
    requireFounderApproval: input.requireFounderApproval,
    reportsRoot: input.planningReportsRoot || undefined,
    executionReportsRoot: input.executionReportsRoot,
  });
  const reportArtifacts = await writeCityLaunchReadinessPreflightReport({
    result,
    reportsRoot: input.executionReportsRoot,
  });
  const closeoutVerification = verifyCityLaunchReadinessCloseout({
    report: result,
    reportJsonPath: reportArtifacts.jsonPath,
  });
  await writeCityLaunchReadinessPreflightCloseoutVerification({
    reportArtifacts,
    result,
    closeoutVerification,
  });
  return {
    status: result.status,
    stateClaim: result.autonomousLoopCloseout.stateClaim,
    stageReached: result.autonomousLoopCloseout.stageReached,
    earliestHardBlockerKey: result.earliestHardBlockerKey,
    earliestHardBlocker: result.earliestHardBlocker,
    launchSurfaceCoverage: result.launchSurfaceCoverage,
    closeoutVerification,
    reportArtifacts,
    nextAction: result.autonomousLoopCloseout.nextAction,
  };
}

function printReadinessCloseout(input: {
  city: string;
  readinessCloseout: Awaited<ReturnType<typeof writeReadinessCloseout>> | null;
}) {
  if (!input.readinessCloseout) {
    return;
  }
  console.log(
    JSON.stringify({
      phase: "readiness_closeout",
      city: input.city,
      ...input.readinessCloseout,
    }),
  );
}

async function writeReadinessCloseoutOrFallback(input: {
  city: string;
  budgetPolicy: ReturnType<typeof buildCityLaunchBudgetPolicy>;
  windowHours: ReturnType<typeof resolveCityLaunchWindowHours>;
  founderApproved: boolean;
  requireFounderApproval: boolean;
  executionReportsRoot: string;
  planningReportsRoot?: string | null;
  skipReadinessCloseout: boolean;
  fallbackStateClaim: "blocked" | "awaiting_human_decision";
  fallbackNextAction: string;
}) {
  if (input.skipReadinessCloseout) {
    return null;
  }
  return writeReadinessCloseout({
    city: input.city,
    budgetPolicy: input.budgetPolicy,
    windowHours: input.windowHours,
    founderApproved: input.founderApproved,
    requireFounderApproval: input.requireFounderApproval,
    executionReportsRoot: input.executionReportsRoot,
    planningReportsRoot: input.planningReportsRoot,
  }).catch((closeoutError) => ({
    status: "failed" as const,
    stateClaim: input.fallbackStateClaim,
    stageReached: "readiness_closeout_failed",
    earliestHardBlocker: null,
    reportArtifacts: null,
    nextAction: input.fallbackNextAction,
    error: closeoutError instanceof Error ? closeoutError.message : String(closeoutError),
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const city = resolveCityLaunchCityInput(
    getFlagValue(args, "--city") ?? process.env.CITY,
  );

  const windowHours = resolveCityLaunchWindowHours(
    getFlagValue(args, "--window-hours") ?? process.env.WINDOW_HOURS,
  );
  const humanBlockerDeliveryMode = resolveCityLaunchHumanBlockerDeliveryMode(
    getFlagValue(args, "--human-blocker-delivery-mode")
    ?? process.env.BLUEPRINT_CITY_LAUNCH_HUMAN_BLOCKER_DELIVERY_MODE
    ?? "review_required",
  );
  const budgetMaxUsd = resolveCityLaunchFounderBudgetMaxUsdInput(
    getFlagValue(args, "--budget-max-usd") ?? process.env.BUDGET_MAX_USD,
  );
  const budgetTier = resolveCityLaunchFounderBudgetTierInput(
    getFlagValue(args, "--budget-tier") ?? process.env.BUDGET_TIER,
  );
  const phase: RunPhase = (getFlagValue(args, "--phase") as RunPhase) || "full";
  const skipPlan = hasFlag(args, "--skip-plan");
  const skipApproval = hasFlag(args, "--skip-approval");
  const allowBlocked = hasFlag(args, "--allow-blocked");
  const requireFounderApproval = hasFlag(args, "--require-founder-approval");
  const founderApprovedFlag = hasFlag(args, "--founder-approved");
  const founderApprovedByMode = resolveCityLaunchFounderApproval({
    phase,
    founderApprovedFlag,
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
  const skipCreativeAdsEvidence = hasFlag(args, "--skip-creative-ads-evidence");
  const skipReadinessCloseout = hasFlag(args, "--skip-readiness-closeout");
  const runMetaReadOnly = !hasFlag(args, "--skip-meta-read-only");
  const founderApprovedPausedDraft =
    hasFlag(args, "--founder-approved-paused-draft")
    || hasFlag(args, "--allow-paused-meta-draft");
  const executionReportsRoot =
    getFlagValue(args, "--reports-root")
    || path.resolve(
      process.cwd(),
      "ops/paperclip/reports/city-launch-execution",
    );
  const deepResearchReportsRoot =
    getFlagValue(args, "--deep-research-reports-root")
    || undefined;

  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: budgetTier,
    maxTotalApprovedUsd: budgetMaxUsd,
    operatorAutoApproveUsd,
  });
  const durableFounderApproval = founderApprovedFlag
    ? null
    : await resolveCityLaunchFounderApprovalFromDurableState({
        city,
        budgetPolicy,
      }).catch(() => null);
  const founderApproved = founderApprovedFlag
    ? true
    : durableFounderApproval?.founderApproved === true
      ? true
      : founderApprovedByMode;

  console.log(
    JSON.stringify({
      phase: "init",
      city,
      budgetTier: budgetPolicy.tier,
      budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
      operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
      windowHours,
      runPhase: phase,
      skipPlan,
      skipApproval,
      founderApproved,
      durableFounderApproval: durableFounderApproval
        ? {
            blockerId: durableFounderApproval.blockerId,
            founderApproved: durableFounderApproval.founderApproved,
            threadStatus: durableFounderApproval.thread?.status || null,
          }
        : null,
      requireFounderApproval,
    }),
  );

  // Phase 1: Plan (Deep Research)
  if (!skipPlan && (phase === "plan" || phase === "full")) {
    console.log(JSON.stringify({ phase: "plan", status: "starting", city }));

    try {
      const planResult = await runCityLaunchPlanningHarness({
        city,
        region: getFlagValue(args, "--region") || undefined,
        budgetTier: budgetPolicy.tier,
        budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
        operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
        windowHours,
        fileSearchStoreNames: getFlagValue(args, "--file-search-store")
          ?.split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        critiqueRounds: Number(getFlagValue(args, "--critique-rounds") || "1"),
        pollIntervalMs: Number(getFlagValue(args, "--poll-interval-ms") || "10000"),
        timeoutMs: Number(getFlagValue(args, "--timeout-ms") || String(20 * 60 * 1000)),
        reportsRoot: deepResearchReportsRoot,
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
          runContract: planResult.runContract,
          windowHours,
          stageCount: planResult.stages.length,
        }),
      );
    } catch (error) {
      const planningState = await resolveCityLaunchPlanningState({
        city,
        reportsRoot: deepResearchReportsRoot,
      });
      const fallback = await resolveCityLaunchDeepResearchFailure({
        city,
        budgetPolicy,
        planningState,
        error,
        reportsRoot: executionReportsRoot,
        humanBlockerDeliveryMode,
      });

      console.log(
        JSON.stringify({
          phase: "plan",
          status: fallback.status,
          city,
          completedPlaybookPath: fallback.completedPlaybookPath,
          blockerPacketPath: fallback.blockerPacketPath,
          blockerId: fallback.blockerId,
          requiredInputs: fallback.requiredInputs,
          humanBlockerDispatch: fallback.humanBlockerDispatch,
          windowHours,
          error: fallback.errorMessage,
        }),
      );

      if (fallback.status === "blocked") {
        printReadinessCloseout({
          city,
          readinessCloseout: await writeReadinessCloseoutOrFallback({
            city,
            budgetPolicy,
            windowHours,
            founderApproved,
            requireFounderApproval,
            executionReportsRoot,
            planningReportsRoot: deepResearchReportsRoot,
            skipReadinessCloseout,
            fallbackStateClaim: "blocked",
            fallbackNextAction: "Inspect city-launch run output and rerun npm run city-launch:preflight.",
          }),
        });
        if (!allowBlocked) {
          process.exitCode = 1;
        }
        return;
      }

      if (phase === "plan") {
        printReadinessCloseout({
          city,
          readinessCloseout: await writeReadinessCloseoutOrFallback({
            city,
            budgetPolicy,
            windowHours,
            founderApproved,
            requireFounderApproval,
            executionReportsRoot,
            planningReportsRoot: deepResearchReportsRoot,
            skipReadinessCloseout,
            fallbackStateClaim: "blocked",
            fallbackNextAction: "Inspect city-launch plan output and rerun npm run city-launch:preflight.",
          }),
        });
        return;
      }
    }

    if (phase === "plan") {
      printReadinessCloseout({
        city,
        readinessCloseout: await writeReadinessCloseoutOrFallback({
          city,
          budgetPolicy,
          windowHours,
          founderApproved,
          requireFounderApproval,
          executionReportsRoot,
          planningReportsRoot: deepResearchReportsRoot,
          skipReadinessCloseout,
          fallbackStateClaim: "blocked",
          fallbackNextAction: "Inspect city-launch plan output and rerun npm run city-launch:preflight.",
        }),
      });
      return;
    }
  }

  // Phase 2: Approve (Generate + present approval packet)
  if (phase === "enrich" || phase === "full") {
    const planningState = await resolveCityLaunchPlanningState({
      city,
      reportsRoot: deepResearchReportsRoot,
    });
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
        printReadinessCloseout({
          city,
          readinessCloseout: await writeReadinessCloseoutOrFallback({
            city,
            budgetPolicy,
            windowHours,
            founderApproved,
            requireFounderApproval,
            executionReportsRoot,
            planningReportsRoot: deepResearchReportsRoot,
            skipReadinessCloseout,
            fallbackStateClaim: "blocked",
            fallbackNextAction: "Inspect enrich output and rerun npm run city-launch:preflight.",
          }),
        });
        return;
      }
    } else if (phase === "enrich") {
      const readinessCloseout = await writeReadinessCloseoutOrFallback({
        city,
        budgetPolicy,
        windowHours,
        founderApproved,
        requireFounderApproval,
        executionReportsRoot,
        planningReportsRoot: deepResearchReportsRoot,
        skipReadinessCloseout,
        fallbackStateClaim: "blocked",
        fallbackNextAction: "Inspect enrich output and rerun npm run city-launch:preflight.",
      });
      console.log(
        JSON.stringify({
          phase: "enrich",
          status: "blocked",
          city,
          windowHours,
          error: `No completed deep-research artifact found for ${city}.`,
          readinessCloseout,
        }),
      );
      if (!allowBlocked) {
        process.exitCode = 1;
      }
      return;
    }
  }

  // Phase 3: Approve (Autonomous no-op retained for phase compatibility)
  if (!skipApproval && (phase === "approve" || phase === "full" || phase === "activate")) {
    if (!founderApproved) {
      const founderDecision = await writeFounderDecisionPacket({
        city,
        budgetPolicy,
        reportsRoot: executionReportsRoot,
        humanBlockerDeliveryMode,
      });
      const readinessCloseout = await writeReadinessCloseoutOrFallback({
        city,
        budgetPolicy,
        windowHours,
        founderApproved: false,
        requireFounderApproval,
        executionReportsRoot,
        planningReportsRoot: deepResearchReportsRoot,
        skipReadinessCloseout,
        fallbackStateClaim: "awaiting_human_decision",
        fallbackNextAction: "Inspect founder packet output and rerun npm run city-launch:preflight.",
      });
      console.log(JSON.stringify({
        phase: "approve",
        status: "awaiting_human_decision",
        city,
        founderApproved: false,
        windowHours,
        founderDecisionPacketPath: founderDecision.founderDecisionPacketPath,
        humanBlockerDispatch: founderDecision.humanBlockerDispatch,
        readinessCloseout,
        message: "Founder approval is required before city-launch activation. Rerun with --founder-approved after approval is recorded.",
      }));

      return;
    }

    console.log(JSON.stringify({
      phase: "approve",
      status: "founder_approved",
      city,
      windowHours,
      message: "Founder-approved flag supplied; activation may proceed.",
    }));

    if (phase === "approve") {
      printReadinessCloseout({
        city,
        readinessCloseout: await writeReadinessCloseoutOrFallback({
          city,
          budgetPolicy,
          windowHours,
          founderApproved,
          requireFounderApproval,
          executionReportsRoot,
          planningReportsRoot: deepResearchReportsRoot,
          skipReadinessCloseout,
          fallbackStateClaim: "awaiting_human_decision",
          fallbackNextAction: "Inspect approval output and rerun npm run city-launch:preflight.",
        }),
      });
      return;
    }
  }

  // Phase 4: Activate (Build execution harness + dispatch Paperclip issues)
  if (phase === "activate" || phase === "full") {
    if (!founderApproved) {
      const founderDecision = await writeFounderDecisionPacket({
        city,
        budgetPolicy,
        reportsRoot: executionReportsRoot,
        humanBlockerDeliveryMode,
      });
      const readinessCloseout = await writeReadinessCloseoutOrFallback({
        city,
        budgetPolicy,
        windowHours,
        founderApproved: false,
        requireFounderApproval,
        executionReportsRoot,
        planningReportsRoot: deepResearchReportsRoot,
        skipReadinessCloseout,
        fallbackStateClaim: "awaiting_human_decision",
        fallbackNextAction: "Inspect founder packet output and rerun npm run city-launch:preflight.",
      });
      console.log(JSON.stringify({
        phase: "activate",
        status: "awaiting_human_decision",
        city,
        founderApproved: false,
        windowHours,
        founderDecisionPacketPath: founderDecision.founderDecisionPacketPath,
        humanBlockerDispatch: founderDecision.humanBlockerDispatch,
        readinessCloseout,
        message: "Activation was not started because --founder-approved was not supplied.",
      }));
      return;
    }

    console.log(JSON.stringify({ phase: "activate", status: "starting", city }));

    const activateResult = await runCityLaunchExecutionHarness({
      city,
      founderApproved,
      budgetTier: budgetPolicy.tier,
      budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
      operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
      windowHours,
      reportsRoot: executionReportsRoot,
      rewakeTaskKeys,
      rewakeOwnerLanes,
    }).catch(async (error) => {
      const readinessCloseout = await writeReadinessCloseoutOrFallback({
        city,
        budgetPolicy,
        windowHours,
        founderApproved,
        requireFounderApproval,
        executionReportsRoot,
        planningReportsRoot: deepResearchReportsRoot,
        skipReadinessCloseout,
        fallbackStateClaim: "blocked",
        fallbackNextAction: "Inspect activation step-error artifacts and rerun npm run city-launch:preflight.",
      });
      console.log(
        JSON.stringify({
          phase: "activate",
          status: "blocked",
          city,
          windowHours,
          error: error instanceof Error ? error.message : String(error),
          readinessCloseout,
        }),
      );
      if (!allowBlocked) {
        process.exitCode = 1;
      }
      return null;
    });

    if (!activateResult) {
      return;
    }

    console.log(
      JSON.stringify({
        phase: "activate",
        status: "completed",
        city: activateResult.city,
        activationStatus: activateResult.activationStatus,
        budgetTier: activateResult.budgetTier,
        windowHours,
        canonicalSystemDocPath:
          activateResult.artifacts.canonicalSystemDocPath,
        canonicalIssueBundlePath:
          activateResult.artifacts.canonicalIssueBundlePath,
        paperclipRootIssueId:
          activateResult.paperclip?.rootIssueId || null,
        dispatchedIssueCount:
          activateResult.paperclip?.dispatched.length || 0,
        wokenIssueCount:
          activateResult.paperclip?.dispatched.filter((e) => Boolean(e.wakeRunId)).length || 0,
        prospectsUpserted:
          activateResult.researchMaterialization?.prospectsUpserted || 0,
        buyerTargetsUpserted:
          activateResult.researchMaterialization?.buyerTargetsUpserted || 0,
        canonicalCityOpeningBuyerLoopPath:
          activateResult.artifacts.cityOpeningArtifactPack.canonical.buyerLoopPath,
        canonicalGtm72hContractPath:
          activateResult.artifacts.gtm72hArtifactPack.canonical.contractMarkdownPath,
        canonicalScorecardWindowManifestPath:
          activateResult.artifacts.gtm72hArtifactPack.canonical.scorecardManifestPath,
        outboundReadiness: activateResult.outboundReadiness || null,
        capabilitySnapshot: activateResult.capabilitySnapshot || null,
        certification: summarizeCityLaunchAutonomyCertification(activateResult),
      }),
    );

    if (!skipCreativeAdsEvidence) {
      const creativeAdsEvidence = await writeCityLaunchCreativeAdsEvidence({
        city,
        budgetTier: budgetPolicy.tier,
        budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
        windowHours,
        reportsRoot: executionReportsRoot,
        adStudioRunId: getFlagValue(args, "--ad-studio-run-id") || undefined,
        requireVideoHandoff: hasFlag(args, "--require-video-handoff"),
        runMetaReadOnly,
        founderApprovedPausedDraft,
        launchId: activateResult.paperclip?.rootIssueId || undefined,
        metaAccountId: getFlagValue(args, "--meta-account-id") || undefined,
        metaPageId: getFlagValue(args, "--meta-page-id") || undefined,
        mediaPath: getFlagValue(args, "--media-path") || undefined,
        mediaType: getFlagValue(args, "--media-type") || undefined,
        destinationUrl: getFlagValue(args, "--destination-url") || undefined,
        dailyBudgetUsd: getFlagValue(args, "--daily-budget-usd")
          ? Number(getFlagValue(args, "--daily-budget-usd"))
          : undefined,
        callToAction: getFlagValue(args, "--call-to-action") || undefined,
      });

      console.log(
        JSON.stringify({
          phase: "creative_ads",
          status: creativeAdsEvidence.status,
          city: creativeAdsEvidence.city,
          windowHours: creativeAdsEvidence.windowHours,
          adStudio: creativeAdsEvidence.adStudio,
          metaAds: {
            enabled: creativeAdsEvidence.metaAds.status.enabled,
            missingEnv: creativeAdsEvidence.metaAds.missingEnv,
            readOnlyProof: creativeAdsEvidence.metaAds.readOnlyProof,
            pausedDraft: creativeAdsEvidence.metaAds.pausedDraft,
          },
          blockers: creativeAdsEvidence.blockers,
          jsonPath: creativeAdsEvidence.artifacts.jsonPath,
          markdownPath: creativeAdsEvidence.artifacts.markdownPath,
        }),
      );

      if (creativeAdsEvidence.status === "blocked" && !allowBlocked) {
        printReadinessCloseout({
          city,
          readinessCloseout: await writeReadinessCloseoutOrFallback({
            city,
            budgetPolicy,
            windowHours,
            founderApproved,
            requireFounderApproval,
            executionReportsRoot,
            planningReportsRoot: deepResearchReportsRoot,
            skipReadinessCloseout,
            fallbackStateClaim: "blocked",
            fallbackNextAction:
              `Inspect ${creativeAdsEvidence.artifacts.jsonPath} and rerun npm run city-launch:preflight.`,
          }),
        });
        process.exitCode = 1;
      }
    }
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
