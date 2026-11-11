/**
 * The capture app's bundle upload as it ran before 2026-11-11, kept only so
 * tests can build stored app bundles the way the app did.
 *
 * Production no longer starts, uploads or completes a bundle: the routes answer
 * 410 capture_app_not_in_use. What production still does is read a stored
 * bundle and finish one whose privacy screen was held (`describeBundleLink`,
 * `finishClearedBundle` in `siteCaptureBundleService`). The recovery tests need
 * bundles stored exactly as the app stored them, so the three original
 * handlers live here, under tests, with the router the app called. Plan
 * validation and server-file composition stay in `siteCaptureBundle`, which
 * also defines the stored record shapes the recovery reads.
 */
import { Router, type Request, type Response } from "express";

import { logger } from "../../logger";
import { bundleGate } from "../../routes/self-capture-uploads";
import { activateCaptureSupplement } from "../../utils/captureSupplement";
import { hasCurrentRecordingConsent } from "../../utils/recordingConsent";
import type { CapturePrivacyProducerSource } from "../../utils/capturePrivacyRecord";
import { BUNDLE_VIDEO_PATH, COMPLETION_MARKER_PATH, DOWNSTREAM_CANDIDATE_MANIFEST_PATH, SERVER_OWNED_PATHS, SITE_CAPTURE_BUNDLE_PLAN_SCHEMA, buildCompletionRecord, bundleCompletionDecisionKey, buildPlanRecord, composeServerFiles, downstreamCandidateBindingErrors, planDigestOf, projectSiteCaptureBinding, validateBundlePlan, validateDeviceManifest, type BundleClient, type BundleCompletionRecord, type BundleFileEntry, type BundlePlanRecord, type BundleTarget } from "../../utils/siteCaptureBundle";
import {
  SIGNED_URL_TTL_MS,
  TARGETS_PER_RESPONSE,
  appBundlePrivacySource,
  bundleProcessingHold,
  completionObjectName,
  finishBundle,
  materializeCompletionServerFiles,
  planObjectName,
  rawObjectName,
  readJson,
  relativeRawPath,
  targetFor,
  type BundleServiceDeps,
  type ServiceResponse,
  type TokenPayload,
} from "../../utils/siteCaptureBundleService";
import { bundleContentType, type BundleObjectInfo } from "../../utils/siteCaptureBundleStorage";
import { isAcceptedVideoHeader, VIDEO_SIGNATURE_BYTES } from "../../utils/videoMagicBytes";

interface InventoryResult {
  present: BundleFileEntry[];
  missing: BundleFileEntry[];
  mismatched: string[];
  undeclared: string[];
  serverWritten: Map<string, BundleObjectInfo>;
}

function inventory(target: BundleTarget, plan: BundlePlanRecord, objects: BundleObjectInfo[]): InventoryResult {
  const byPath = new Map<string, BundleObjectInfo>();
  const undeclared: string[] = [];
  const serverWritten = new Map<string, BundleObjectInfo>();
  const planned = new Map(plan.files.map((file) => [file.path, file]));
  const serverOwned = new Set<string>(SERVER_OWNED_PATHS);
  for (const object of objects) {
    const path = relativeRawPath(target, object.name);
    if (path === null) continue;
    if (planned.has(path)) byPath.set(path, object);
    else if (serverOwned.has(path)) serverWritten.set(path, object);
    else undeclared.push(path);
  }
  const present: BundleFileEntry[] = [];
  const missing: BundleFileEntry[] = [];
  const mismatched: string[] = [];
  for (const file of plan.files) {
    const object = byPath.get(file.path);
    if (!object) missing.push(file);
    else if (object.size !== file.bytes || object.md5Hash !== file.md5) mismatched.push(file.path);
    else present.push(file);
  }
  return { present, missing, mismatched, undeclared: undeclared.sort(), serverWritten };
}

async function mintTargets(target: BundleTarget, files: BundleFileEntry[], deps: BundleServiceDeps) {
  const expiresAtMs = deps.now().getTime() + SIGNED_URL_TTL_MS;
  return Promise.all(files.map(async (file) => {
    const name = rawObjectName(target, file.path);
    const contentType = bundleContentType(file.path);
    if (file.path === BUNDLE_VIDEO_PATH) {
      const sessionUri = await deps.storage.resumableSession(name, {
        md5: file.md5,
        contentType,
        bytes: file.bytes,
      });
      return {
        path: file.path,
        kind: "resumable" as const,
        session_uri: sessionUri,
        content_type: contentType,
        bytes: file.bytes,
      };
    }
    const signed = await deps.storage.signedPut(name, { md5: file.md5, contentType, expiresAtMs });
    return {
      path: file.path,
      kind: "put" as const,
      url: signed.url,
      method: "PUT",
      headers: signed.headers,
      expires_at: signed.expiresAtIso,
    };
  }));
}

function parseClient(value: unknown): BundleClient | null {
  return value === "ios_app_clip" || value === "ios_app" ? value : null;
}

export async function acceptBundlePlan(
  payload: TokenPayload,
  body: unknown,
  deps: BundleServiceDeps,
): Promise<ServiceResponse> {
  if (!hasCurrentRecordingConsent((await deps.loadAuthority(payload.requestId)).consentAttestation)) {
    return { status: 409, body: { code: "recording_consent_required", error: "Current recording permission is required." } };
  }
  const target = targetFor(payload);
  const record = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  if (!record) return { status: 400, body: { error: "We could not read that upload plan.", code: "bundle_plan_invalid" } };
  const client = parseClient(record.client);
  if (!client) return { status: 400, body: { error: "We could not read that upload plan.", code: "bundle_client_invalid" } };

  const device = validateDeviceManifest(record.device_manifest, target);
  const planCheck = validateBundlePlan({
    files: record.files,
    limits: deps.limits,
    motionRequired: device.motionRequired,
    depthDeclared: device.depthDeclared,
  });
  const errors = [...device.errors, ...planCheck.errors];
  if (errors.length) {
    return {
      status: 400,
      body: { error: "That recording is not a bundle we can accept.", code: "bundle_plan_invalid", errors: errors.slice(0, 50) },
    };
  }

  const authority = await deps.loadAuthority(payload.requestId);
  const live = projectSiteCaptureBinding({
    requestId: payload.requestId,
    target,
    captureRights: authority.captureRights,
  });

  const existingPlan = await readJson<BundlePlanRecord>(deps.storage, planObjectName(target));
  let plan: BundlePlanRecord;
  if (existingPlan) {
    const candidate = buildPlanRecord({
      supplement: payload.supplement,
      requestId: payload.requestId,
      target,
      client,
      files: planCheck.files,
      deviceManifest: device.manifest,
      binding: existingPlan.binding,
      bindingDigest: existingPlan.binding_digest,
      linkScope: payload.scope ?? "owner",
      authoritySnapshot: authority,
      createdAtIso: existingPlan.created_at_iso,
    });
    if (record.binding_digest !== existingPlan.binding_digest || candidate.plan_digest !== existingPlan.plan_digest) {
      return {
        status: 409,
        body: {
          error: "A different recording is already uploading to this link.",
          code: "bundle_plan_conflict",
        },
      };
    }
    plan = existingPlan;
  } else {
    if (record.binding_digest !== live.binding_digest) {
      // Nothing is stored yet, so the phone can re-bind and try again.
      return {
        status: 409,
        body: {
          error: "The terms for this capture changed. The recording is being prepared again.",
          code: "capture_binding_changed",
          binding: live.binding,
          binding_digest: live.binding_digest,
        },
      };
    }
    const [marker, anyRaw] = await Promise.all([
      deps.storage.info(rawObjectName(target, COMPLETION_MARKER_PATH)),
      deps.storage.list(`${target.rawPrefix}/`, { maxResults: 1 }),
    ]);
    if (marker || anyRaw.length > 0) {
      return {
        status: 409,
        body: {
          error: marker
            ? "This link already has a recording."
            : "Something is already stored for this link, so a new recording cannot be added to it.",
          code: marker ? "capture_already_complete" : "capture_prefix_occupied",
        },
      };
    }
    plan = buildPlanRecord({
      supplement: payload.supplement,
      requestId: payload.requestId,
      target,
      client,
      files: planCheck.files,
      deviceManifest: device.manifest,
      binding: live.binding,
      bindingDigest: live.binding_digest,
      linkScope: payload.scope ?? "owner",
      authoritySnapshot: authority,
      createdAtIso: deps.now().toISOString(),
    });
    // Before the capture is claimed for this plan, so a refusal changes nothing.
    const refusedNew = await admitPlanBytes(payload, plan, deps);
    if (refusedNew) return refusedNew;
    const claim = await deps.claimBundle({
      requestId: payload.requestId,
      target,
      planDigest: plan.plan_digest,
      client,
    });
    if (claim === "conflict") {
      return {
        status: 409,
        body: { error: "A different recording is already uploading to this link.", code: "bundle_plan_conflict" },
      };
    }
    const created = await deps.storage.createOnly(
      planObjectName(target),
      `${JSON.stringify(plan, null, 2)}\n`,
      "application/json",
    );
    if (created === "exists") {
      // Another call won the race. Answer from whatever it recorded.
      const raced = await readJson<BundlePlanRecord>(deps.storage, planObjectName(target));
      if (!raced || raced.plan_digest !== plan.plan_digest) {
        return {
          status: 409,
          body: { error: "A different recording is already uploading to this link.", code: "bundle_plan_conflict" },
        };
      }
      plan = raced;
    }
  }

  if (plan.schema_version !== SITE_CAPTURE_BUNDLE_PLAN_SCHEMA || planDigestOf(plan) !== plan.plan_digest) {
    logger.error({ captureId: target.captureId }, "Stored bundle plan failed its own digest");
    return { status: 500, body: { error: "This upload cannot continue. We have been alerted.", code: "bundle_plan_corrupt" } };
  }

  const objects = await deps.storage.list(`${target.rawPrefix}/`);
  const stock = inventory(target, plan, objects);
  if (stock.mismatched.length) {
    return {
      status: 409,
      body: {
        error: "Part of this upload does not match what was recorded.",
        code: "bundle_object_mismatch",
        paths: stock.mismatched.slice(0, 50),
      },
    };
  }
  if (stock.undeclared.length) {
    return {
      status: 409,
      body: {
        error: "Something unexpected is stored for this link.",
        code: "bundle_prefix_has_undeclared_objects",
        paths: stock.undeclared.slice(0, 50),
      },
    };
  }
  // Charged once per plan: a replay of an admitted plan is free, and a plan
  // first stored on a day it was refused is charged when its targets are issued.
  const refused = await admitPlanBytes(payload, plan, deps);
  if (refused) return refused;
  const batch = stock.missing.slice(0, TARGETS_PER_RESPONSE);
  const targets = await mintTargets(target, batch, deps);
  return {
    status: 200,
    body: {
      ok: true,
      plan_digest: plan.plan_digest,
      scene_id: target.sceneId,
      capture_id: target.captureId,
      raw_prefix: target.rawPrefix,
      file_count: plan.files.length,
      total_bytes: plan.files.reduce((sum, file) => sum + file.bytes, 0),
      present_paths: stock.present.map((file) => file.path),
      missing_count: stock.missing.length,
      targets,
      more_targets: stock.missing.length > batch.length,
    },
  };
}

export async function mintMoreTargets(
  payload: TokenPayload,
  body: unknown,
  deps: BundleServiceDeps,
): Promise<ServiceResponse> {
  if (!hasCurrentRecordingConsent((await deps.loadAuthority(payload.requestId)).consentAttestation)) {
    return { status: 409, body: { code: "recording_consent_required", error: "Current recording permission is required." } };
  }
  const target = targetFor(payload);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const plan = await readJson<BundlePlanRecord>(deps.storage, planObjectName(target));
  if (!plan || record.plan_digest !== plan.plan_digest) {
    return { status: 409, body: { error: "This upload has no matching plan.", code: "bundle_plan_missing" } };
  }
  const paths = record.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > TARGETS_PER_RESPONSE) {
    return { status: 400, body: { error: "Ask for between 1 and 250 files.", code: "bundle_targets_invalid" } };
  }
  const planned = new Map(plan.files.map((file) => [file.path, file]));
  const files: BundleFileEntry[] = [];
  for (const path of paths) {
    const file = typeof path === "string" ? planned.get(path) : undefined;
    if (!file) return { status: 400, body: { error: "That file is not part of this upload.", code: "bundle_target_not_planned" } };
    files.push(file);
  }
  const refused = await admitPlanBytes(payload, plan, deps);
  if (refused) return refused;
  return { status: 200, body: { ok: true, plan_digest: plan.plan_digest, targets: await mintTargets(target, files, deps) } };
}

/** Upload targets are issued only for a plan whose bytes fit today's caps. */
async function admitPlanBytes(payload: TokenPayload, plan: BundlePlanRecord, deps: BundleServiceDeps) {
  if (!deps.admitPlannedBytes) return null;
  return deps.admitPlannedBytes({ requestId: payload.requestId, captureId: payload.captureId, planDigest: plan.plan_digest,
    bytes: plan.files.reduce((sum, file) => sum + file.bytes, 0) });
}

/* ------------------------------------------------------------ complete */

function heldResponse(target: BundleTarget, privacy: { eligibility?: string | null; retryable?: boolean | null; detail?: string | null }): ServiceResponse {
  return {
    status: 200,
    body: {
      ok: true,
      captureId: target.captureId,
      state: "held",
      eligibility: privacy.eligibility ?? "pending",
      retryable: privacy.retryable ?? false,
      code: privacy.eligibility === "pending" ? "capture_review_unavailable" : "capture_privacy_review",
      message: privacy.detail ?? null,
    },
  };
}

function completeResponse(target: BundleTarget, eligibility: string | null | undefined): ServiceResponse {
  return {
    status: 201,
    body: {
      ok: true,
      captureId: target.captureId,
      state: "complete",
      eligibility: eligibility ?? null,
      message: "Got it. We'll build the scene and come back to you.",
    },
  };
}

export async function completeBundle(
  payload: TokenPayload,
  body: unknown,
  deps: BundleServiceDeps,
): Promise<ServiceResponse> {
  const admissionHold = bundleProcessingHold(await deps.loadAuthority(payload.requestId), "Current recording permission is required.");
  if (admissionHold) return admissionHold;
  const target = targetFor(payload);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const plan = await readJson<BundlePlanRecord>(deps.storage, planObjectName(target));
  if (!plan || record.plan_digest !== plan.plan_digest || planDigestOf(plan) !== plan.plan_digest) {
    return { status: 409, body: { error: "This upload has no matching plan.", code: "bundle_plan_missing" } };
  }

  // Already finished: answer the same thing again.
  if (await deps.storage.info(rawObjectName(target, COMPLETION_MARKER_PATH))) {
    const prior = await readJson<BundleCompletionRecord>(deps.storage, completionObjectName(target));
    const marker = await deps.storage.readText(rawObjectName(target, COMPLETION_MARKER_PATH));
    if (!prior || prior.request_id !== payload.requestId || prior.scene_id !== target.sceneId
        || prior.capture_id !== target.captureId || prior.raw_prefix !== target.rawPrefix
        || prior.plan_digest !== plan.plan_digest || marker !== prior.completion_marker_json) {
      return { status: 409, body: { error: "This capture has a different completion marker.",
        code: "bundle_marker_conflict" } };
    }
    const privacy = await deps.loadPrivacyState(payload.requestId);
    await deps.startCoverageReview({ requestId: payload.requestId, sceneId: target.sceneId, captureId: target.captureId });
    return completeResponse(target, privacy?.eligibility);
  }

  const objects = await deps.storage.list(`${target.rawPrefix}/`);
  const stock = inventory(target, plan, objects);
  if (stock.missing.length) {
    return {
      status: 409,
      body: {
        error: "Some of your upload is still missing.",
        code: "bundle_incomplete",
        missing: stock.missing.slice(0, TARGETS_PER_RESPONSE).map((file) => file.path),
        missing_count: stock.missing.length,
      },
    };
  }
  if (stock.mismatched.length) {
    return {
      status: 409,
      body: { error: "Part of this upload does not match what was recorded.", code: "bundle_object_mismatch", paths: stock.mismatched.slice(0, 50) },
    };
  }
  if (stock.undeclared.length) {
    return {
      status: 409,
      body: { error: "Something unexpected is stored for this link.", code: "bundle_prefix_has_undeclared_objects", paths: stock.undeclared.slice(0, 50) },
    };
  }

  const candidateText = await deps.storage.readText(rawObjectName(target, DOWNSTREAM_CANDIDATE_MANIFEST_PATH));
  let candidateManifest: unknown = null;
  try {
    candidateManifest = candidateText === null ? null : JSON.parse(candidateText);
  } catch {
    candidateManifest = null;
  }
  const bindingErrors = downstreamCandidateBindingErrors(candidateManifest, plan.binding);
  if (bindingErrors.length) {
    return {
      status: 422,
      body: { error: "This recording's terms do not match the link.", code: "bundle_binding_mismatch", errors: bindingErrors },
    };
  }

  // The completion record fixes every server-owned byte the first time it is
  // composed. A retry — after a crash, a dropped response or a held screen —
  // writes exactly those bytes, whatever has changed since.
  let completion = await readJson<BundleCompletionRecord>(deps.storage, completionObjectName(target));
  const repeat = completion !== null;
  if (!completion) {
    const byName = new Map(objects.map((object) => [object.name, object]));
    const deviceObjects: Record<string, { generation: string; size_bytes: number; crc32c: string; md5: string }> = {};
    for (const file of plan.files) {
      const object = byName.get(rawObjectName(target, file.path));
      if (!object || !/^[1-9][0-9]{0,19}$/.test(object.generation ?? "")
          || !/^[A-Za-z0-9+/]{6}==$/.test(object.crc32c ?? "")
          || object.size !== file.bytes || object.md5Hash !== file.md5) {
        return { status: 503, body: { error: "We could not verify this upload. Please retry.",
          code: "bundle_source_generation_unavailable" } };
      }
      deviceObjects[file.path] = { generation: object.generation!, size_bytes: object.size,
        crc32c: object.crc32c!, md5: file.md5 };
    }
    // The video went straight to storage on a signed session, so this is the
    // first time the server sees its bytes: a bounded read of its head, before
    // anything (manifest, email, privacy screen, model) treats it as footage.
    // The object stays where it is, unreferenced: raw bundle files are
    // create-only, and the MD5-bound plan would only re-upload the same bytes.
    const head = await deps.storage.readHead(rawObjectName(target, BUNDLE_VIDEO_PATH), VIDEO_SIGNATURE_BYTES);
    if (!head || !isAcceptedVideoHeader(head)) {
      logger.warn({ captureId: target.captureId }, "Bundle video is not a recognised video container");
      return { status: 422, body: { code: "bundle_video_not_recognized",
        error: "The uploaded recording is not a video we can read. Record it again in the Blueprint app." } };
    }
    const completedAtIso = deps.now().toISOString();
    const composition = composeServerFiles({
      plan,
      brief: await deps.loadBrief(payload.requestId),
      bucket: deps.storage.bucketName,
      completedAtIso,
    });
    const fresh = {
      ...buildCompletionRecord(plan, composition, completedAtIso, deviceObjects),
      server_files: composition.serverFiles,
    };
    const outcome = await deps.storage.createOnly(
      completionObjectName(target),
      `${JSON.stringify(fresh, null, 2)}\n`,
      "application/json",
    );
    completion = outcome === "created"
      ? fresh
      : await readJson<BundleCompletionRecord>(deps.storage, completionObjectName(target));
    if (!completion) {
      return { status: 503, body: { error: "We could not finish your upload. Please retry.", code: "bundle_completion_unavailable" } };
    }
  }
  const producerSource: CapturePrivacyProducerSource = {
    kind: "app_bundle_completion", key: bundleCompletionDecisionKey(completion),
  };

  // Manifest first, as on the web path: the marker starts extraction and
  // extraction reads the manifest.
  if (await materializeCompletionServerFiles(target, completion, deps.storage) === "conflict") {
    logger.error({ captureId: target.captureId }, "A server-owned bundle file differs from its completion record");
    return { status: 500, body: { error: "This upload cannot be finished. We have been alerted.", code: "bundle_server_file_conflict" } };
  }

  const identity = await deps.recordUploadIdentity({
    requestId: payload.requestId,
    target,
    identity: completion.identity,
    planDigest: plan.plan_digest,
    client: plan.client,
  });
  if (identity === "conflict") {
    return { status: 409, body: { error: "This capture is already bound to a different upload.", code: "capture_upload_identity_conflict" } };
  }

  // The durable proof the upload is complete now exists. Notify before privacy
  // review; the outbox key keeps a retry from sending twice.
  try {
    await deps.notifyVideoReceived(payload.requestId);
  } catch (error) {
    logger.warn({ error, requestId: payload.requestId }, "Could not enqueue video-received notice");
  }

  const screenForThisCompletion = async () => {
    const claim = await deps.claimPrivacyScreen({ requestId: payload.requestId,
      captureId: target.captureId, producerSource });
    if (!claim) return null;
    try {
      const result = await deps.screenForPrivacy({ requestId: payload.requestId,
        sceneId: target.sceneId, captureId: target.captureId });
      await deps.recordPrivacy({ requestId: payload.requestId, captureId: target.captureId,
        result, producerSource, claim });
      return result;
    } catch (error) {
      await deps.releasePrivacyClaim(claim);
      throw error;
    }
  };
  let proceed: boolean;
  let eligibility: string | null | undefined;
  if (repeat) {
    // The screen already ran for this capture. Read what it said instead of
    // asking the model again; a held screen is retried by the status poll.
    const stored = await deps.loadPrivacyState(payload.requestId);
    const sameSource = stored?.producer_source?.kind === producerSource.kind
      && stored.producer_source.key === producerSource.key;
    proceed = sameSource && stored?.proceeded === true
      && (stored.eligibility === "approved" || stored.eligibility === "unscreened");
    eligibility = stored?.eligibility;
    if (!stored || !sameSource) {
      // A pre-change writer may still be finishing the unbound decision. Its
      // shared legacy map cannot authorize this app completion, and repeat
      // POST obeys the same finite quarantine as status recovery.
      if (stored?.proceeded === true
          && (stored.eligibility === "approved" || stored.eligibility === "unscreened")) {
        const when = Date.parse(stored.screened_at_iso ?? "");
        if (!Number.isFinite(when) || Date.now() - when < 60 * 60 * 1000)
          return { status: 200, body: { ok: true, state: "held", code: "capture_review_in_progress" } };
      }
      const result = await screenForThisCompletion();
      if (!result) return { status: 200, body: { ok: true, state: "held", code: "capture_review_in_progress" } };
      proceed = result.proceed;
      eligibility = result.eligibility;
      if (!proceed) return heldResponse(target, result);
    } else if (!proceed) {
      return heldResponse(target, stored);
    }
  } else {
    const result = await screenForThisCompletion();
    if (!result) return { status: 200, body: { ok: true, state: "held", code: "capture_review_in_progress" } };
    proceed = result.proceed;
    eligibility = result.eligibility;
    if (!proceed) return heldResponse(target, result);
  }

  const currentSource = await appBundlePrivacySource(payload, deps.storage);
  if (currentSource?.kind !== producerSource.kind || currentSource.key !== producerSource.key) {
    return { status: 409, body: { error: "The capture source changed before completion.", code: "bundle_marker_conflict" } };
  }
  const publicationHold = bundleProcessingHold(await deps.loadAuthority(payload.requestId));
  if (publicationHold) return publicationHold;
  await deps.startCoverageReview({ requestId: payload.requestId, sceneId: target.sceneId, captureId: target.captureId });
  if ((await finishBundle(target, completion, deps.storage)) === "conflict") {
    logger.error({ captureId: target.captureId }, "Bundle hash manifest or marker differs from its completion record");
    return { status: 500, body: { error: "This upload cannot be finished. We have been alerted.", code: "bundle_marker_conflict" } };
  }

  return completeResponse(target, eligibility);
}

/** The router the app called, mounted ahead of the real uploads router in tests. */
export function retiredAppBundleRoutesForTests() {
  const retired = Router();
  retired.post("/:token/bundle", async (req: Request, res: Response) => {
    const gate = await bundleGate(req, res);
    if (!gate) return;
    try {
      const outcome = await acceptBundlePlan(gate.payload, req.body, gate.deps);
      res.setHeader("Cache-Control", "no-store");
      if (outcome.retryAfterSeconds) res.setHeader("Retry-After", String(outcome.retryAfterSeconds));
      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      logger.error({ error, captureId: gate.payload.captureId }, "Could not accept an app bundle plan");
      return res.status(503).json({ error: "We could not start your upload. It will be retried." });
    }
  });
  retired.post("/:token/bundle/targets", async (req: Request, res: Response) => {
    const gate = await bundleGate(req, res);
    if (!gate) return;
    try {
      const outcome = await mintMoreTargets(gate.payload, req.body, gate.deps);
      res.setHeader("Cache-Control", "no-store");
      if (outcome.retryAfterSeconds) res.setHeader("Retry-After", String(outcome.retryAfterSeconds));
      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      logger.error({ error, captureId: gate.payload.captureId }, "Could not mint app bundle upload targets");
      return res.status(503).json({ error: "We could not continue your upload. It will be retried." });
    }
  });
  retired.post("/:token/bundle/complete", async (req: Request, res: Response) => {
    const gate = await bundleGate(req, res);
    if (!gate) return;
    try {
      const outcome = await completeBundle(gate.payload, req.body, gate.deps);
      if (outcome.status === 201) await activateCaptureSupplement(gate.payload);
      res.setHeader("Cache-Control", "no-store");
      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      logger.error({ error, captureId: gate.payload.captureId }, "Could not complete an app bundle upload");
      return res.status(503).json({ error: "We could not finish your upload. It will be retried." });
    }
  });
  return retired;
}
