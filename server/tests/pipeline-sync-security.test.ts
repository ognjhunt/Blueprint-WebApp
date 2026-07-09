import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  buildPipelineSyncSignature,
  validatePipelineArtifactUris,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";

function requestWithHeaders(args: {
  body: Record<string, unknown>;
  timestamp?: string;
  signature?: string;
  legacyToken?: string;
}): Request {
  const rawBody = JSON.stringify(args.body);
  const headers = new Map<string, string>();
  if (args.timestamp) headers.set("x-blueprint-pipeline-timestamp", args.timestamp);
  if (args.signature) headers.set("x-blueprint-pipeline-signature", args.signature);
  if (args.legacyToken) headers.set("x-blueprint-pipeline-token", args.legacyToken);
  return {
    body: args.body,
    rawBody,
    header(name: string) {
      return headers.get(name.toLowerCase());
    },
  } as unknown as Request;
}

describe("pipeline sync security", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PIPELINE_SYNC_TOKEN;
    delete process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER;
    delete process.env.PIPELINE_SYNC_ALLOWED_GCS_PREFIXES;
    delete process.env.PIPELINE_SYNC_MAX_CLOCK_SKEW_MS;
  });

  it("accepts a fresh HMAC signature over timestamp and raw body", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T12:00:00.000Z"));
    process.env.PIPELINE_SYNC_TOKEN = "sync-secret";
    const body = { schema_version: "v1", capture_id: "cap-1" };
    const timestamp = "2026-07-02T12:00:00.000Z";
    const signature = buildPipelineSyncSignature({
      secret: "sync-secret",
      timestamp,
      body: JSON.stringify(body),
    });

    expect(
      verifyPipelineSyncRequest(
        requestWithHeaders({
          body,
          timestamp,
          signature: `sha256=${signature}`,
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("builds nonce-bound signatures for Pipeline intake forwarding", () => {
    const body = JSON.stringify({ schema_version: "v1", job_id: "job-1" });
    const signature = buildPipelineSyncSignature({
      secret: "sync-secret",
      timestamp: "2026-07-02T12:00:00.000Z",
      nonce: "nonce-1",
      body,
    });
    const withoutNonce = buildPipelineSyncSignature({
      secret: "sync-secret",
      timestamp: "2026-07-02T12:00:00.000Z",
      body,
    });

    expect(signature).not.toBe(withoutNonce);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects plaintext token-only requests unless the legacy override is explicit", () => {
    process.env.PIPELINE_SYNC_TOKEN = "sync-secret";
    expect(
      verifyPipelineSyncRequest(
        requestWithHeaders({
          body: { schema_version: "v1" },
          legacyToken: "sync-secret",
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: "missing_pipeline_sync_signature",
    });

    process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER = "true";
    expect(
      verifyPipelineSyncRequest(
        requestWithHeaders({
          body: { schema_version: "v1" },
          legacyToken: "sync-secret",
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("rejects stale timestamps to limit replay", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T12:10:01.000Z"));
    process.env.PIPELINE_SYNC_TOKEN = "sync-secret";
    const body = { schema_version: "v1" };
    const timestamp = "2026-07-02T12:00:00.000Z";
    const signature = buildPipelineSyncSignature({
      secret: "sync-secret",
      timestamp,
      body: JSON.stringify(body),
    });

    expect(
      verifyPipelineSyncRequest(
        requestWithHeaders({
          body,
          timestamp,
          signature,
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: "stale_pipeline_sync_timestamp",
    });
  });

  it("requires artifact URIs to stay under the configured GCS prefix", () => {
    process.env.PIPELINE_SYNC_ALLOWED_GCS_PREFIXES = "gs://blueprint-8c1ca.appspot.com/";
    expect(
      validatePipelineArtifactUris({
        artifacts: {
          robot_eval_dataset_manifest_uri:
            "gs://blueprint-8c1ca.appspot.com/scenes/scene-1/pipeline/manifest.json",
        },
        evaluation_readiness: {
          robot_eval_dataset_summary: {
            card_artifact_uris: {
              site_card_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/scene-1/site-card.json",
            },
          },
        },
      }),
    ).toEqual([]);

    expect(
      validatePipelineArtifactUris({
        artifacts: {
          robot_eval_dataset_manifest_uri: "gs://attacker-bucket/fake.json",
          launchable_export_bundle_uri: "https://example.com/fake.json",
        },
      }),
    ).toEqual([
      "artifacts.robot_eval_dataset_manifest_uri: artifact URI is outside allowed GCS prefixes",
      "artifacts.launchable_export_bundle_uri: artifact URI must use gs://",
    ]);
  });
});
