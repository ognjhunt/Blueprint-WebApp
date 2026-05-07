import { Router } from "express";
import { z } from "zod";
import {
  executeCityLaunchSends,
  approveCityLaunchSendAction,
} from "../utils/cityLaunchSendExecutor";
import {
  dispatchCityLaunchFounderApproval,
} from "../utils/cityLaunchApprovalDispatch";
import {
  bridgeCityLaunchHumanGates,
} from "../utils/cityLaunchBlockerBridge";
import {
  listCityLaunchSendActions,
  listCityLaunchChannelAccounts,
  readCityLaunchActivation,
  summarizeCityLaunchLedgers,
} from "../utils/cityLaunchLedgers";
import {
  buildCityLaunchBudgetPolicy,
  CITY_LAUNCH_BUDGET_TIER_VALUES,
} from "../utils/cityLaunchPolicy";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { requireAdminRole } from "../middleware/requireAdminRole";

const router = Router();

const executeSendsSchema = z.object({
  city: z.string().trim().min(1),
  dryRun: z.boolean().optional(),
  maxSends: z.number().int().min(1).max(100).optional(),
  actionIds: z.array(z.string().trim().min(1)).optional(),
});

const approveSendSchema = z.object({
  actionId: z.string().trim().min(1),
  approverRole: z.string().trim().min(1).default("founder"),
});

const dispatchApprovalSchema = z.object({
  city: z.string().trim().min(1),
  budgetTier: z.enum(CITY_LAUNCH_BUDGET_TIER_VALUES).optional(),
  budgetMaxUsd: z.number().min(0).optional(),
  operatorAutoApproveUsd: z.number().min(0).optional(),
});

// Execute pending sends for a city
router.post("/sends/execute", verifyFirebaseToken, requireAdminRole, async (req, res) => {
  try {
    const parsed = executeSendsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const result = await executeCityLaunchSends({
      city: parsed.data.city,
      dryRun: parsed.data.dryRun,
      maxSends: parsed.data.maxSends,
      sendKeyFilter: parsed.data.actionIds,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Approve a specific send action
router.post("/sends/approve", verifyFirebaseToken, requireAdminRole, async (req, res) => {
  try {
    const parsed = approveSendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const result = await approveCityLaunchSendAction({
      actionId: parsed.data.actionId,
      approverRole: parsed.data.approverRole,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Dispatch founder approval packet
router.post("/approvals/dispatch", verifyFirebaseToken, requireAdminRole, async (req, res) => {
  try {
    const parsed = dispatchApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const budgetPolicy = buildCityLaunchBudgetPolicy({
      tier: parsed.data.budgetTier,
      maxTotalApprovedUsd: parsed.data.budgetMaxUsd,
      operatorAutoApproveUsd: parsed.data.operatorAutoApproveUsd,
    });

    const result = await dispatchCityLaunchFounderApproval({
      city: parsed.data.city,
      budgetPolicy,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// List send actions for a city
router.get("/sends", verifyFirebaseToken, async (req, res) => {
  try {
    const city = String(req.query.city || "").trim();
    if (!city) {
      res.status(400).json({ ok: false, error: "city query parameter required" });
      return;
    }

    const [sendActions, channelAccounts] = await Promise.all([
      listCityLaunchSendActions(city),
      listCityLaunchChannelAccounts(city),
    ]);

    res.json({
      ok: true,
      city,
      sendActions,
      channelAccounts,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get city launch activation status and ledger summary
router.get("/status", verifyFirebaseToken, async (req, res) => {
  try {
    const city = String(req.query.city || "").trim();
    if (!city) {
      res.status(400).json({ ok: false, error: "city query parameter required" });
      return;
    }

    const [activation, ledgerSummary] = await Promise.all([
      readCityLaunchActivation(city).catch(() => null),
      summarizeCityLaunchLedgers(city),
    ]);

    res.json({
      ok: true,
      city,
      activation,
      ledgerSummary,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Bridge city-launch human gates into standard blocker dispatch
router.post("/blockers/bridge", verifyFirebaseToken, requireAdminRole, async (req, res) => {
  try {
    const city = String(req.body.city || "").trim();
    if (!city) {
      res.status(400).json({ ok: false, error: "city is required" });
      return;
    }

    const taskFilter: string[] | undefined = Array.isArray(req.body.taskKeys)
      ? req.body.taskKeys.filter((k: string) => typeof k === "string" && k.trim())
      : undefined;

    const result = await bridgeCityLaunchHumanGates({ city, taskFilter });

    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
