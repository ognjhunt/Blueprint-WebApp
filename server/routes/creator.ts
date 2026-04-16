import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  listCreatorPayouts,
  mapCreatorPayoutStatusForLedger,
} from "../utils/accounting";
import {
  buildCityLaunchCaptureTargetFeed,
  buildCityLaunchUnderReviewFeed,
  buildCreatorLaunchStatus,
} from "../utils/cityLaunchCaptureTargets";
import { intakeCityLaunchCandidateSignals } from "../utils/cityLaunchLedgers";
import { creatorIdFromRequest } from "../utils/creatorIdentity";

const router = Router();

const DEFAULT_NOTIFICATION_PREFERENCES = {
  nearby_jobs: true,
  reservations: true,
  capture_status: true,
  payouts: true,
  account: true,
} as const;

function toIso(value: unknown) {
  const raw = value as { toDate?: () => Date } | string | Date | null | undefined;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  return raw.toDate?.()?.toISOString?.() || null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

router.use((req: Request, res: Response, next) => {
  const authenticatedUid = String(res.locals.firebaseUser?.uid || "").trim();
  if (!authenticatedUid) {
    return next();
  }

  const requestedCreatorId = creatorIdFromRequest(req);
  if (requestedCreatorId && requestedCreatorId !== authenticatedUid) {
    return res.status(403).json({
      error: "Creator identity does not match authenticated user",
    });
  }

  if (req.method === "GET" || req.method === "DELETE") {
    if (!String(req.query.creator_id || "").trim()) {
      (req.query as Record<string, unknown>).creator_id = authenticatedUid;
    }
  } else {
    const nextBody =
      req.body && typeof req.body === "object"
        ? { ...(req.body as Record<string, unknown>) }
        : {};
    if (typeof nextBody.creator_id !== "string" || !nextBody.creator_id.trim()) {
      nextBody.creator_id = authenticatedUid;
    }
    req.body = nextBody;
  }

  next();
});

function serializeCapture(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Record<string, unknown>;
  return {
    id: String(data.id || doc.id),
    target_address: String(data.target_address || "Submitted space"),
    captured_at: toIso(data.captured_at) || new Date().toISOString(),
    status: String(data.status || "submitted"),
    estimated_payout_cents:
      typeof data.estimated_payout_cents === "number" ? data.estimated_payout_cents : null,
    thumbnail_url: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
  };
}

router.get("/profile", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const profileDoc = await db.collection("creatorProfiles").doc(creatorId).get();
  const data = (profileDoc.data() || {}) as Record<string, unknown>;
  return res.json({
    full_name: typeof data.full_name === "string" ? data.full_name : "",
    email: typeof data.email === "string" ? data.email : "",
    phone_number: typeof data.phone_number === "string" ? data.phone_number : "",
    company: typeof data.company === "string" ? data.company : "",
  });
});

router.put("/profile", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    full_name: String(req.body?.full_name || ""),
    email: String(req.body?.email || ""),
    phone_number: String(req.body?.phone_number || ""),
    company: String(req.body?.company || ""),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("creatorProfiles").doc(creatorId).set(payload, { merge: true });
  return res.json(payload);
});

router.get("/earnings", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payouts = await listCreatorPayouts(creatorId);
  const totalEarnedCents = payouts.reduce((sum, payout) => {
    return payout.status === "paid"
      ? sum + payout.approved_amount_cents
      : sum;
  }, 0);
  const pendingPayoutCents = payouts.reduce((sum, payout) => {
    return ["approved", "in_transit", "review_required"].includes(payout.status)
      ? sum + payout.approved_amount_cents
      : sum;
  }, 0);
  const scansCompleted = payouts.filter((payout) =>
    ["approved", "in_transit", "paid"].includes(payout.status),
  ).length;

  return res.json({
    total_earned_cents: totalEarnedCents,
    pending_payout_cents: pendingPayoutCents,
    scans_completed: scansCompleted,
  });
});

router.get("/captures", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const snapshot = await db
    .collection("creatorCaptures")
    .where("creator_id", "==", creatorId)
    .get();
  const captures = snapshot.docs
    .map((doc) => serializeCapture(doc))
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
    .slice(0, 50);

  return res.json(captures);
});

router.post("/captures", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const captureId = String(req.body?.id || req.body?.capture_id || "").trim();
  if (!captureId) {
    return res.status(400).json({ error: "Missing capture id" });
  }

  const capturedAt = req.body?.captured_at ? new Date(String(req.body.captured_at)) : new Date();
  const estimatedPayoutCents =
    typeof req.body?.estimated_payout_cents === "number"
      ? req.body.estimated_payout_cents
      : typeof req.body?.quoted_payout_cents === "number"
      ? req.body.quoted_payout_cents
      : 0;
  const status = String(req.body?.status || "submitted");

  const timeline = [
    { label: "Capture uploaded", completed_at: capturedAt.toISOString(), state: "completed" },
    { label: "Review queued", completed_at: null, state: status === "submitted" ? "completed" : "pending" },
    { label: "Payout", completed_at: null, state: status === "paid" ? "completed" : "pending" },
  ];

  const payload = {
    id: captureId,
    creator_id: creatorId,
    capture_job_id: req.body?.capture_job_id || null,
    buyer_request_id: req.body?.buyer_request_id || null,
    site_submission_id: req.body?.site_submission_id || null,
    target_address: String(req.body?.target_address || "Submitted space"),
    captured_at: capturedAt.toISOString(),
    status,
    estimated_payout_cents: estimatedPayoutCents,
    rights_profile: req.body?.rights_profile || null,
    requested_outputs: Array.isArray(req.body?.requested_outputs) ? req.body.requested_outputs : [],
    thumbnail_url: req.body?.thumbnail_url || null,
    rejection_reason: req.body?.rejection_reason || null,
    quality: req.body?.quality || null,
    earnings: {
      base_payout_cents: estimatedPayoutCents,
      device_multiplier: req.body?.device_multiplier ?? 1,
      bonuses: Array.isArray(req.body?.bonuses) ? req.body.bonuses : [],
      total_payout_cents: estimatedPayoutCents,
    },
    timeline,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("creatorCaptures").doc(captureId).set(payload, { merge: true });
  return res.status(201).json({ ok: true, id: captureId });
});

router.get("/captures/:captureId", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const doc = await db.collection("creatorCaptures").doc(req.params.captureId).get();
  if (!doc.exists) {
    return res.status(404).end();
  }

  const data = doc.data() as Record<string, unknown>;
  if (String(data.creator_id || "") !== creatorId) {
    return res.status(404).end();
  }

  return res.json({
    id: String(data.id || req.params.captureId),
    target_address: String(data.target_address || "Submitted space"),
    captured_at: toIso(data.captured_at),
    status: String(data.status || "submitted"),
    quality: data.quality || null,
    earnings: data.earnings || null,
    rejection_reason: data.rejection_reason || null,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
  });
});

router.put("/devices/current", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    creator_id: creatorId,
    platform: String(req.body?.platform || ""),
    fcm_token: String(req.body?.fcm_token || ""),
    authorization_status: String(req.body?.authorization_status || "unknown"),
    app_version: String(req.body?.app_version || ""),
    last_seen_at: req.body?.last_seen_at || new Date().toISOString(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection("creatorProfiles")
    .doc(creatorId)
    .set(
      {
        notification_device: payload,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return res.json({ ok: true });
});

router.get("/notifications/preferences", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const profileDoc = await db.collection("creatorProfiles").doc(creatorId).get();
  const data = (profileDoc.data() || {}) as Record<string, unknown>;
  const stored =
    data.notification_preferences &&
    typeof data.notification_preferences === "object"
      ? (data.notification_preferences as Record<string, unknown>)
      : {};

  return res.json({
    nearby_jobs:
      typeof stored.nearby_jobs === "boolean"
        ? stored.nearby_jobs
        : DEFAULT_NOTIFICATION_PREFERENCES.nearby_jobs,
    reservations:
      typeof stored.reservations === "boolean"
        ? stored.reservations
        : DEFAULT_NOTIFICATION_PREFERENCES.reservations,
    capture_status:
      typeof stored.capture_status === "boolean"
        ? stored.capture_status
        : DEFAULT_NOTIFICATION_PREFERENCES.capture_status,
    payouts:
      typeof stored.payouts === "boolean"
        ? stored.payouts
        : DEFAULT_NOTIFICATION_PREFERENCES.payouts,
    account:
      typeof stored.account === "boolean"
        ? stored.account
        : DEFAULT_NOTIFICATION_PREFERENCES.account,
  });
});

router.put("/notifications/preferences", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    nearby_jobs: Boolean(req.body?.nearby_jobs),
    reservations: Boolean(req.body?.reservations),
    capture_status: Boolean(req.body?.capture_status),
    payouts: Boolean(req.body?.payouts),
    account: Boolean(req.body?.account),
  };

  await db
    .collection("creatorProfiles")
    .doc(creatorId)
    .set(
      {
        notification_preferences: payload,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return res.json(payload);
});

router.get("/city-launch/targets", async (req: Request, res: Response) => {
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const radiusMeters = Math.min(
    Math.max(toNumber(req.query.radius_m) ?? 16_093, 100),
    80_467,
  );
  const limit = Math.min(Math.max(Math.trunc(toNumber(req.query.limit) ?? 12), 1), 50);

  return res.json(
    await buildCityLaunchCaptureTargetFeed({
      lat,
      lng,
      radiusMeters,
      limit,
    }),
  );
});

router.get("/launch-status", async (req: Request, res: Response) => {
  const city = String(req.query.city || "").trim();
  const stateCode = String(req.query.state_code || "").trim() || null;

  return res.json(
    await buildCreatorLaunchStatus({
      resolvedCity: city ? { city, stateCode } : null,
    }),
  );
});

router.post("/city-launch/candidate-signals", async (req: Request, res: Response) => {
  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const rawCandidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
  const candidates = rawCandidates
    .map((candidate) => ({
      creatorId,
      city: String(candidate?.city || "").trim(),
      name: String(candidate?.name || "").trim(),
      address: candidate?.address ? String(candidate.address).trim() : null,
      lat: Number(candidate?.lat),
      lng: Number(candidate?.lng),
      provider: String(candidate?.provider || "unknown").trim(),
      providerPlaceId: candidate?.provider_place_id ? String(candidate.provider_place_id).trim() : null,
      types: Array.isArray(candidate?.types) ? candidate.types.map(String) : [],
      sourceContext: String(candidate?.source_context || "app_open_scan").trim() as
        | "signup_scan"
        | "app_open_scan"
        | "manual_refresh",
    }))
    .filter((candidate) =>
      candidate.city
      && candidate.name
      && Number.isFinite(candidate.lat)
      && Number.isFinite(candidate.lng),
    );

  if (!candidates.length) {
    return res.status(400).json({ error: "At least one valid candidate is required" });
  }

  const result = await intakeCityLaunchCandidateSignals(candidates);
  return res.status(201).json({ candidates: result });
});

router.get("/city-launch/review-candidates", async (req: Request, res: Response) => {
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const radiusMeters = Math.min(
    Math.max(toNumber(req.query.radius_m) ?? 16_093, 100),
    80_467,
  );
  const limit = Math.min(Math.max(Math.trunc(toNumber(req.query.limit) ?? 12), 1), 50);

  return res.json(
    await buildCityLaunchUnderReviewFeed({
      lat,
      lng,
      radiusMeters,
      limit,
    }),
  );
});

router.get("/qc", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const snapshot = await db
    .collection("creatorCaptures")
    .where("creator_id", "==", creatorId)
    .get();

  let pendingCount = 0;
  let needsFixCount = 0;
  let approvedCount = 0;

  snapshot.docs.forEach((doc) => {
    const status = String(doc.data().status || "");
    if (["submitted", "under_review"].includes(status)) pendingCount += 1;
    if (["needs_recapture", "needs_fix", "rejected"].includes(status)) needsFixCount += 1;
    if (["approved", "paid"].includes(status)) approvedCount += 1;
  });

  return res.json({
    pending_count: pendingCount,
    needs_fix_count: needsFixCount,
    approved_count: approvedCount,
    average_turnaround_hours: 24,
    last_updated: new Date().toISOString(),
  });
});

router.get("/payouts/ledger", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const entries = (await listCreatorPayouts(creatorId))
    .filter((entry) => entry.approved_amount_cents > 0)
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      scheduled_for:
        entry.paid_at || entry.approved_at || entry.updated_at || new Date().toISOString(),
      amount_cents: entry.approved_amount_cents,
      status: mapCreatorPayoutStatusForLedger(entry.status),
      description: entry.scene_id
        ? `Capture payout for ${entry.scene_id}`
        : "Capture payout",
    }));

  return res.json(entries);
});

export default router;
