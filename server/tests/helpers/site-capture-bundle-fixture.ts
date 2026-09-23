/**
 * A synthetic Raw V3.2 device bundle — the files a phone uploads — for route
 * tests. Shapes follow BlueprintCapture's writer closely enough for the server's
 * checks; the committed fixtures produced by the real iOS writer are exercised
 * separately.
 */

import { createHash } from "node:crypto";

export interface DeviceBundle {
  files: Map<string, Buffer>;
  deviceManifest: Record<string, unknown>;
  plan: { path: string; bytes: number; sha256: string; md5: string }[];
}

function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function md5(data: Buffer) {
  return createHash("md5").update(data).digest("base64");
}

function json(value: unknown) {
  return Buffer.from(`${JSON.stringify(value)}\n`);
}

function jsonl(rows: unknown[]) {
  return Buffer.from(rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

export function syntheticDeviceBundle(options: {
  sceneId: string;
  captureId: string;
  binding: {
    requested_outputs: string[];
    capture_rights: { derived_scene_generation_allowed: boolean; data_licensing_allowed: boolean };
    privacy_security_limits: string[];
  };
  lidar?: boolean;
  imu?: "record" | "app_clip";
  depthFrames?: number;
  videoBytes?: number;
}): DeviceBundle {
  const lidar = options.lidar ?? true;
  const imu = options.imu ?? "app_clip";
  const depthFrames = lidar ? options.depthFrames ?? 3 : 0;
  const cfs = "cfs-test-0001";
  const files = new Map<string, Buffer>();
  const frames = [0, 1, 2].map((index) => ({
    frame_id: String(index + 1).padStart(6, "0"),
    frame_index: index,
    t_capture_sec: index / 30,
    t_device_sec: index / 30,
    coordinate_frame_session_id: cfs,
  }));
  files.set("walkthrough.mov", Buffer.alloc(options.videoBytes ?? 4096, 7));
  files.set("recording_session.json", json({ schema_version: "v1", scene_id: options.sceneId, capture_id: options.captureId, coordinate_frame_session_id: cfs }));
  for (const name of ["capture_topology.json", "route_anchors.json", "checkpoint_events.json",
    "relocalization_events.json", "overlap_graph.json", "video_track.json",
    "reconstruction_qualification_request.json", "arkit/session_intrinsics.json", "arkit/intrinsics.json"]) {
    files.set(name, json({ schema_version: "v1", coordinate_frame_session_id: cfs, name }));
  }
  files.set("semantic_anchors.json", json({ schema_version: "v1", semantic_anchors: [] }));
  files.set("video_frame_retention.jsonl", jsonl(frames.map((frame, index) => ({ write_attempt_index: index, frame_id: frame.frame_id }))));
  files.set("sync_map.jsonl", jsonl(frames));
  files.set("semantic_anchor_observations.jsonl", Buffer.alloc(0));
  for (const name of ["arkit/poses.jsonl", "arkit/frames.jsonl", "arkit/frame_quality.jsonl", "arkit/per_frame_camera_state.jsonl",
    "arkit/feature_points.jsonl", "arkit/plane_observations.jsonl", "arkit/light_estimates.jsonl"]) {
    files.set(name, jsonl(frames));
  }
  if (imu === "record") {
    files.set("motion.jsonl", jsonl([{ timestamp: 1, t_capture_sec: 0, motion_provenance: "iphone_device_imu" }]));
  }
  if (lidar) {
    const depthEntries: { frame_id: string; depth_path: string; paired_confidence_path: string }[] = [];
    for (let index = 0; index < depthFrames; index += 1) {
      const id = String(index + 1).padStart(6, "0");
      files.set(`arkit/depth/${id}.png`, Buffer.from(`depth-${id}`));
      files.set(`arkit/confidence/${id}.png`, Buffer.from(`confidence-${id}`));
      depthEntries.push({ frame_id: id, depth_path: `arkit/depth/${id}.png`, paired_confidence_path: `arkit/confidence/${id}.png` });
    }
    files.set("arkit/depth_manifest.json", json({ schema_version: "arkit_depth_manifest.v2", frames: depthEntries }));
    files.set("arkit/confidence_manifest.json", json({ schema_version: "arkit_confidence_manifest.v2", frames: depthEntries }));
    files.set("arkit/meshes/mesh-0A1B2C3D-0000-4000-8000-000000000001.obj", Buffer.from("v 0 0 0\n"));
    files.set("arkit/mesh_manifest.json", json({ schema_version: "arkit_mesh_manifest.v1" }));
  }
  files.set("downstream_candidate_manifest.json", json({
    schema_version: "downstream_candidate_manifest.v1",
    scene_id: options.sceneId,
    capture_id: options.captureId,
    source_video_uri: "walkthrough.mov",
    allowed_use_scope: {
      raw_observation_indexing_allowed: true,
      derived_processing_allowed: options.binding.capture_rights.derived_scene_generation_allowed,
      data_licensing_allowed: options.binding.capture_rights.data_licensing_allowed,
      requested_outputs: options.binding.requested_outputs,
      redaction_required_before_derived_use: true,
      privacy_security_limits: options.binding.privacy_security_limits,
      latest_revocation_check_required: true,
      provider_upload_requires_separate_downstream_authorization: true,
    },
  }));

  const capabilities: Record<string, unknown> = {
    camera_pose: true,
    camera_intrinsics: true,
    depth: lidar,
    depth_confidence: lidar,
    missing_depth_reason: lidar ? undefined : "not_supported",
    tracking_state: true,
    motion: imu === "record",
    motion_authoritative: imu === "record",
    motion_samples: imu === "record" ? 1 : 0,
    device_imu: imu === "record",
  };
  if (imu === "app_clip") capabilities.device_imu_unavailable_reason = "app_clip_runtime";
  if (!lidar) delete capabilities.missing_depth_reason;
  if (!lidar) capabilities.missing_depth_reason = "not_supported";

  const deviceManifest: Record<string, unknown> = {
    schema_version: "v3",
    capture_schema_version: "3.2.0",
    scene_id: options.sceneId,
    capture_id: options.captureId,
    video_uri: "walkthrough.mov",
    device_model: "iPhone16,2",
    device_model_marketing: "iPhone",
    os_version: "18.5",
    ios_version: "18.5",
    ios_build: "22F76",
    app_version: "2.0",
    app_build: "100",
    hardware_model_identifier: "iPhone16,2",
    fps_source: 30,
    width: 1920,
    height: 1440,
    capture_start_epoch_ms: 1_790_000_000_000,
    has_lidar: lidar,
    depth_supported: lidar,
    capture_source: "iphone",
    capture_tier_hint: "tier1_iphone",
    coordinate_frame_session_id: cfs,
    capture_modality: lidar ? "iphone_arkit_lidar" : "iphone_arkit_lidar",
    capture_profile_id: lidar ? "iphone_arkit_lidar" : "iphone_arkit_non_lidar",
    capture_capabilities: capabilities,
    capture_evidence: { arkit_pose_rows: 3 },
    scene_memory_capture: { world_model_candidate: false },
    capture_topology: { coordinate_frame_session_id: cfs },
    downstream_candidate_manifest_uri: "downstream_candidate_manifest.json",
    reconstruction_qualification_request_uri: "reconstruction_qualification_request.json",
    ...(imu === "app_clip" ? { device_imu_unavailable_reason: "app_clip_runtime" } : {}),
  };

  const plan = [...files.entries()]
    .map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data), md5: md5(data) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files, deviceManifest, plan };
}
