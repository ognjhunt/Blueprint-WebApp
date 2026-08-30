// @vitest-environment node
import crypto from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  blobs: new Map<string, Buffer>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: () => ({
      where: (field: string, _operator: string, value: unknown) => ({
        limit: () => ({
          get: async () => ({
            docs: Array.from(state.records.entries())
              .filter(([, record]) => record[field] === value)
              .map(([id, record]) => ({ id, data: () => structuredClone(record) })),
          }),
        }),
      }),
    }),
  },
  storageAdmin: {
    bucket: (bucket: string) => ({
      file: (objectPath: string) => ({
        download: async () => {
          const blob = state.blobs.get(`${bucket}/${objectPath}`);
          if (!blob) throw new Error("fixture_blob_missing");
          return [blob];
        },
      }),
    }),
  },
}));

vi.mock("../utils/site-worlds", () => ({
  listPublicSiteWorlds: async () => [],
  getPublicSiteWorldById: async () => null,
}));

vi.mock("../retrieval/siteWorldSearch", () => ({
  searchPublicSiteWorlds: async () => ({ items: [], count: 0 }),
}));

import siteWorldsRouter from "../routes/site-worlds";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const allowedFields = [
  "status",
  "scene_identity",
  "task_identity",
  "task_kind",
  "task_strategy",
  "public_title",
  "public_summary",
  "public_category",
  "thumbnail",
  "proof_boundary",
];

function publicOffering(thumbnailBytes = Buffer.from("authorized-derived-thumbnail")) {
  const thumbnailDigest = `sha256:${crypto.createHash("sha256").update(thumbnailBytes).digest("hex")}`;
  const core: Record<string, any> = {
    schema_version: "task_evaluation_configured_scene_offering.v1",
    status: "configured_controls_pending",
    configuration_run_id: "scene-run-839873",
    team_namespace: "private-team-must-not-leak",
    catalog_visibility: "team_only",
    scene_identity: { id: "scene-839873", version: "v1" },
    task: {
      identity: { id: "simple-relocation", version: "v1" },
      kind: "rigid_relocation",
      strategy: "pick_and_place",
      subject_identity: { id: "replacement-mug", version: "v1" },
    },
    presentation: {
      task_thumbnail: {
        uri: "gs://public-fixture/configured/thumbnail.png",
        digest: thumbnailDigest,
        size_bytes: thumbnailBytes.byteLength,
      },
      selection_receipt: {
        uri: "gs://private-fixture/selection.json",
        digest: sha("b"),
        size_bytes: 100,
      },
      selection: {
        camera_id: "camera-03",
        frame_digest: thumbnailDigest,
        rationale: "Shows the configured task surface and replacement object.",
        reviewer: {
          kind: "ai",
          identity: "independent-visual-reviewer-v1",
          runtime: "openai_agents_sdk",
          model: "gpt-5.4",
        },
      },
      selected_from_exact_reviewed_frame_count: 8,
      derived_appearance_evidence: true,
      capture_or_physical_evidence: false,
      image_bytes_modified_after_selection: false,
    },
    evaluation_preparation_binding: {
      scene_mode: "reuse_configured_revision",
      construction_mode: "reuse_configured_scene",
      task_binding_mode: "reuse_configured_template",
      configuration_source_commit: "a".repeat(40),
      configured_scene_revision: {
        uri: "s3://private-fixture/configured-revision.json",
        digest: sha("c"),
        size_bytes: 100,
      },
      configured_scene_revision_digest: sha("d"),
      configured_scene_bundle: {
        uri: "s3://private-fixture/configured-bundle.zip",
        digest: sha("e"),
        size_bytes: 100,
      },
    },
    proof_boundary: {
      thumbnail_is_derived_appearance_evidence: true,
      thumbnail_is_capture_or_physical_evidence: false,
      configuration_is_policy_evaluation: false,
      configuration_is_deployment_or_safety_approval: false,
    },
    evaluation_admission: {
      zero_action_required: true,
      scripted_positive_required: true,
      learned_policy_evaluation_admitted: false,
    },
    offering_digest: "",
  };
  const sourceOfferingDigest = canonicalArtifactDigest(core, "offering_digest");
  const publicDisplay: Record<string, unknown> = {
    schema_version: "task_evaluation_configured_scene_public_display.v1",
    status: "authorized",
    source_authorization_digest: sha("f"),
    source_offering_digest: sourceOfferingDigest,
    public_slug: "scene-839873-simple-relocation",
    title: "Scene 839873 simple relocation",
    summary: "A robot-neutral configured scene for relocating one rigid mug.",
    category: "Rigid object handling",
    allowed_fields: allowedFields,
    scene_identity_digest: canonicalArtifactDigest(core.scene_identity, "scene_identity_digest"),
    configured_scene_revision_digest: sha("d"),
    task_thumbnail_digest: thumbnailDigest,
    projection_digest: "",
  };
  publicDisplay.projection_digest = canonicalArtifactDigest(publicDisplay, "projection_digest");
  const offering = { ...core, public_display: publicDisplay };
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

function storedRecord(offering: Record<string, any>) {
  return {
    configured_scene_offering: offering,
    configured_scene_offering_digest: offering.offering_digest,
    configured_scene_offering_state: offering.status,
    configured_scene_offering_public_visibility: "public",
    configured_scene_offering_public_slug: offering.public_display.public_slug,
  };
}

function evaluationReadyOffering() {
  const offering = publicOffering();
  offering.status = "evaluation_ready";
  offering.evaluation_admission.learned_policy_evaluation_admitted = true;
  const sourceOffering = structuredClone(offering);
  delete sourceOffering.public_display;
  offering.public_display.source_offering_digest = canonicalArtifactDigest(
    sourceOffering,
    "offering_digest",
  );
  offering.public_display.projection_digest = canonicalArtifactDigest(
    offering.public_display,
    "projection_digest",
  );
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

function ungradedOffering() {
  const offering = publicOffering();
  offering.presentation.appearance_review_status = "paused_ungraded";
  offering.presentation.selection.appearance_review_status = "paused_ungraded";
  offering.presentation.selection.reviewer = {
    kind: "system",
    identity: "deterministic_ungraded_thumbnail_selector",
    runtime: "blueprint_pipeline",
    model: "none",
  };
  offering.presentation.selected_from_exact_reviewed_frame_count = 0;
  offering.presentation.warning_label = "Visual review paused - appearance ungraded";
  offering.proof_boundary.appearance_visual_review_completed = false;
  offering.proof_boundary.appearance_quality_graded = false;
  offering.proof_boundary.appearance_review_status = "paused_ungraded";
  offering.proof_boundary.appearance_warning_label = "Visual review paused - appearance ungraded";
  const sourceOffering = structuredClone(offering);
  delete sourceOffering.public_display;
  offering.public_display.source_offering_digest = canonicalArtifactDigest(
    sourceOffering,
    "offering_digest",
  );
  offering.public_display.projection_digest = canonicalArtifactDigest(
    offering.public_display,
    "projection_digest",
  );
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

describe("public configured-scene offerings", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    state.records.clear();
    state.blobs.clear();
    const app = express();
    app.use("/api/site-worlds", siteWorldsRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture_server_missing");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("projects only explicitly authorized, digest-bound public fields", async () => {
    const offering = publicOffering();
    state.records.set("launch-authorized", storedRecord(offering));
    const unauthorized = structuredClone(offering);
    delete unauthorized.public_display;
    unauthorized.offering_digest = canonicalArtifactDigest(unauthorized, "offering_digest");
    state.records.set("launch-public-marker-without-authority", {
      configured_scene_offering: unauthorized,
      configured_scene_offering_digest: unauthorized.offering_digest,
      configured_scene_offering_state: unauthorized.status,
      configured_scene_offering_public_visibility: "public",
      configured_scene_offering_public_slug: "scene-839873-simple-relocation",
    });

    const response = await fetch(`${baseUrl}/api/site-worlds?limit=100`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([expect.objectContaining({
      id: "scene-839873-simple-relocation",
      recordKind: "configured_scene_offering",
      status: "configured_controls_pending",
      title: "Scene 839873 simple relocation",
      evaluationAction: {
        enabled: false,
        href: null,
        label: "Evaluation locked until controls pass",
      },
    })]);
    const publicBytes = JSON.stringify(payload);
    expect(publicBytes).not.toContain("private-team-must-not-leak");
    expect(publicBytes).not.toContain("gs://");
    expect(publicBytes).not.toContain("s3://");
    expect(publicBytes).not.toContain("configuration_run_id");
    expect(publicBytes).not.toContain("source_authorization_digest");
  });

  it("projects the explicit ungraded warning when appearance review is paused", async () => {
    const offering = ungradedOffering();
    state.records.set("launch-ungraded", storedRecord(offering));

    const response = await fetch(`${baseUrl}/api/site-worlds?limit=100`);
    const payload = await response.json();

    expect(payload.items).toEqual([expect.objectContaining({
      status: "configured_controls_pending",
      presentation: expect.objectContaining({
        appearanceReviewStatus: "paused_ungraded",
        warningLabel: "Visual review paused - appearance ungraded",
      }),
    })]);
  });

  it("fails closed when any public projection digest or record binding changes", async () => {
    const offering = publicOffering();
    offering.public_display.summary = "Tampered after authorization";
    state.records.set("launch-tampered", storedRecord(offering));
    state.records.set("launch-marker-mismatch", {
      ...storedRecord(publicOffering()),
      configured_scene_offering_public_slug: "different-slug",
    });

    const response = await fetch(`${baseUrl}/api/site-worlds?limit=100`);
    expect(await response.json()).toEqual({ items: [], count: 0 });
  });

  it("unlocks the request action only after the evaluation-ready admission is bound", async () => {
    const offering = evaluationReadyOffering();
    state.records.set("launch-evaluation-ready", storedRecord(offering));

    const response = await fetch(`${baseUrl}/api/site-worlds?limit=100`);
    const payload = await response.json();

    expect(payload.items).toEqual([expect.objectContaining({
      status: "evaluation_ready",
      evaluationAction: expect.objectContaining({
        enabled: true,
        label: "Request this evaluation",
      }),
    })]);
    expect(payload.items[0].evaluationAction.href).toContain(
      "source=public-configured-scene-offering",
    );
  });

  it("serves the exact authorized thumbnail without credentials", async () => {
    const thumbnailBytes = Buffer.from("authorized-derived-thumbnail");
    const offering = publicOffering(thumbnailBytes);
    state.records.set("launch-authorized", storedRecord(offering));
    state.blobs.set("public-fixture/configured/thumbnail.png", thumbnailBytes);

    const detail = await fetch(`${baseUrl}/api/site-worlds/scene-839873-simple-relocation`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual(expect.objectContaining({
      sceneIdentity: { id: "scene-839873", version: "v1" },
    }));

    const response = await fetch(`${baseUrl}/api/site-worlds/scene-839873-simple-relocation/thumbnail`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(thumbnailBytes);
  });
});
