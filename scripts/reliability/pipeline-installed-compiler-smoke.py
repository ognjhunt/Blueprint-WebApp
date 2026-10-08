"""CPU-only installed-source smoke reviewed by the coordinator before invocation.
Existing test-owned synthetic geometry; temporary outputs only, no customer path proof.
"""
import os,sys,tempfile,json,hashlib,importlib.abc
from pathlib import Path
sys.dont_write_bytecode=True
EXPECTED_COMMIT="a56f9d240058f038060bd6aa89efcef3ff5f12e5"
EXPECTED_SOURCE_SHA="570ee667e0af5a869fb455175c835e386db7a7dea532fd2caa60d34508a93ae9"
class ProviderImportsForbidden(importlib.abc.MetaPathFinder):
 def find_spec(self,fullname,path=None,target=None):
  if fullname=="firebase_admin" or fullname.startswith(("firebase_admin.","google.cloud.storage","google.cloud.firestore","openai","anthropic","boto3")):
   raise RuntimeError("Provider/storage import forbidden in CPU smoke: "+fullname)
sys.meta_path.insert(0,ProviderImportsForbidden())
_smoke_tmp=tempfile.TemporaryDirectory(prefix="blueprint-a56-compiler-smoke-")
_smoke_root=Path(_smoke_tmp.name).resolve()
_audit={"active":True,"network_or_subprocess_attempts":0,"writes":0}
def smoke_audit(event,args):
 if not _audit["active"]:return
 if event.startswith("socket.") or event in {"subprocess.Popen","os.system","os.posix_spawn","os.fork"}:
  _audit["network_or_subprocess_attempts"]+=1
  raise RuntimeError("External execution forbidden: "+event)
 targets=[]
 if event=="open" and args and not isinstance(args[0],int):
  mode=args[1] if len(args)>1 else None
  flags=args[2] if len(args)>2 else 0
  if (isinstance(mode,str) and any(c in mode for c in "wax+")) or (isinstance(flags,int) and flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND)):
   targets=[args[0]]
 elif event in {"os.rename", "os.link", "os.symlink"}:targets=list(args[:2])
 elif event in {"os.mkdir","os.remove","os.rmdir","os.chmod","os.chown","os.truncate"}:targets=[args[0]]
 for target in targets:
  if isinstance(target,int):raise RuntimeError("Descriptor mutation forbidden")
  path=Path(os.fsdecode(target)).resolve()
  if not path.is_relative_to(_smoke_root):raise RuntimeError("Write outside disposable root forbidden")
  _audit["writes"]+=1
sys.addaudithook(smoke_audit)

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

from blueprint_pipeline.decision_evidence_contracts import canonical_digest
from blueprint_pipeline.local_reconstruction_adapters import _sha256_file

NOW = 1_800_000_000.0
WIDTH, HEIGHT, FOCAL = 40, 30, 30.0
RUNTIME_ROTATION = np.diag([1.0, -1.0, -1.0])  # source Y-down/Z-forward -> Y-up runtime
RUNTIME_SCALE, RUNTIME_TRANSLATION = 0.5, np.array([1.0, 2.0, 3.0])


def _depth():
    depth = np.full((HEIGHT, WIDTH), 3.0)
    rows = np.arange(HEIGHT)[:, None]
    table = rows > HEIGHT / 2
    depth = np.where(table, 0.5 * FOCAL / np.maximum(rows - HEIGHT / 2, 1e-6), depth)
    return depth


def _frame(root: Path, index: int):
    depth = _depth()
    # A non-planar observed object patch above the table; masks must describe
    # actual points, not an unrelated hand-written bounding box.
    yy, xx = np.indices((5, 4))
    depth[20:25, 21:25] = 1.57 + 0.005 * (xx + yy)
    geometry = root / f"frame-{index}.npz"
    np.savez(geometry, depth_m=depth, valid_mask=np.ones_like(depth, dtype=bool))
    image = root / f"frame-{index}.png"
    Image.fromarray(np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)).save(image)
    pose = np.eye(4)
    pose[0, 3] = 0.05 * index
    return {"frame_id": f"frame-{index}", "timestamp_seconds": index * 0.5, "image_path": str(image),
            "image_digest": _sha256_file(image), "geometry_path": str(geometry), "geometry_digest": _sha256_file(geometry),
            "intrinsics": [[FOCAL, 0, WIDTH / 2], [0, FOCAL, HEIGHT / 2], [0, 0, 1]],
            "world_from_camera": pose.tolist(), "width": WIDTH, "height": HEIGHT}


def _source_geometry(root: Path):
    frames = [_frame(root, index) for index in range(2)]
    value = {"schema_version": "website_source_geometry.v1", "frames": frames, "unit": "estimated_meters",
             "scale_status": "model_estimated", "metric_measurement_proven": False}
    value["digest"] = canonical_digest(value, digest_field="digest")
    return value


def _grid(source_geometry):
    # A real connected triangle grid: arbitrary point triplets are not a
    # support surface even when their enclosing box resembles one.
    points, faces = [], []
    for frame in source_geometry["frames"]:
        yy, xx = np.indices((HEIGHT, WIDTH))
        pixels = np.stack([xx, yy, np.ones_like(xx)], axis=-1).reshape(-1, 3)
        camera = (pixels @ np.linalg.inv(frame["intrinsics"]).T) * _depth().reshape(-1, 1)
        pose = np.array(frame["world_from_camera"])
        offset = len(points) * WIDTH * HEIGHT
        points.append(camera @ pose[:3, :3].T + pose[:3, 3])
        for y in range(HEIGHT - 1):
            for x in range(WIDTH - 1):
                a = offset + y * WIDTH + x
                faces.extend([[a, a + 1, a + WIDTH], [a + 1, a + WIDTH + 1, a + WIDTH]])
    return np.concatenate(points), faces


def _base_scene(root: Path, source_geometry, *, symmetric=False):
    points, faces = _grid(source_geometry)
    if symmetric:
        points = np.random.default_rng(3).uniform(-1, 1, points.shape)
    vertices = (points @ RUNTIME_ROTATION.T) * RUNTIME_SCALE + RUNTIME_TRANSLATION
    mesh_path = root / "collider.glb"
    trimesh.Trimesh(vertices=vertices, faces=faces, process=False).export(mesh_path)
    splat = root / "world.ply"
    splat.write_bytes(b"ply\nformat binary_little_endian 1.0\nend_header\n")
    return {"splat_path": str(splat), "splat_digest": _sha256_file(splat), "splat_binding_id": "marble-splat-1",
            "collision_mesh_path": str(mesh_path), "collision_mesh_digest": _sha256_file(mesh_path),
            "collision_binding_id": "marble-mesh-1", "up_axis": "Y", "meters_per_unit": 2.0,
            "provider": "world_labs", "operation_id": "op-1"}


def _bounds(minimum, maximum):
    return {"minimum": list(minimum), "maximum": list(maximum), "unit": "estimated_meters",
            "metric_measurement_proven": False, "complete_object_dimensions": False}


def _masks(source_geometry, *, destination=True, articulated=False):
    runs = [{"start": row * WIDTH + 21, "length": 4, "probability": 0.9} for row in range(20, 25)]
    track = {"track_id": "t1", "label": "cup", "observations": [
        {"source_frame_id": "frame-0", "height": HEIGHT, "width": WIDTH, "runs": runs}]}
    targets = [{"target_id": "cup-1", "task_effect": "manipulated", "disposition": "remove", "track": track,
                "estimated_visible_bounds": _bounds([0.05, 0.4, 1.45], [0.10, 0.5, 1.55]),
                **({"semantic_label": "three-drawer cabinet", "articulated_part": "middle drawer",
                    "articulation_kind": "prismatic"} if articulated else {})}]
    if destination:
        targets.append({"target_id": "tray-1", "task_effect": "static_contact", "disposition": "keep",
                        "target_role": "destination", "placement_relation": "on", "track": track,
                        "estimated_visible_bounds": _bounds([0.4, 0.48, 1.4], [0.6, 0.5, 1.6])})
    value = {"schema_version": "website_task_masks.v1", "status": "completed", "targets": targets,
             "source_geometry_digest": source_geometry["digest"]}
    value["digest"] = canonical_digest(value, digest_field="digest")
    return value


def _task_context(confirmed_at=NOW - 100):
    value = {"schema_version": "website_site_task_context.v1", "request_id": "req1", "scene_id": "site-req1",
             "capture_id": "walkthrough-req1", "description": "Move the cup onto the tray.", "confirmed": True,
             "confirmed_at": datetime.fromtimestamp(confirmed_at, timezone.utc).isoformat(),
             "operator_answers": {}, "unresolved": [],
             "capture_rights": {"derived_scene_generation_allowed": True}}
    value["context_digest"] = canonical_digest(value, digest_field="context_digest")
    return value


REMOVAL = {"schema_version": "clean_plate_removal_manifest.v1", "entries": [
    {"target_id": "cup-1", "semantic_label": "cup", "task_effect": "manipulated", "disposition": "remove",
     "compose_back": {"replacement_asset_id": None, "pose_world": None, "replacement_asset_frame_registration_uri": None}}]}
SPEND = {"max_total_spend_usd": 40, "max_paid_attempts": 2, "expires_at_epoch": NOW + 3600,
         "owner": {"user_id": "owner-1", "organization_id": "org-1"},
         "consent": {"accepted_by": "owner-1", "accepted_at_epoch": NOW - 100,
                     "rights_reference": "recorded-owner-rights", "provider_terms_reference": "accepted-provider-terms",
                     "private_processing_authorized": True, "provider_training_authorized": False,
                     "task_confirmed": True, "spend_authorized": True}}


def _arguments(tmp_path, overrides=None, **keyword_overrides):
    geometry = _source_geometry(tmp_path)
    arguments = {"task_context": _task_context(), "task_masks": _masks(geometry), "removal_manifest": REMOVAL,
                 "source_geometry": geometry, "base_scene": _base_scene(tmp_path, geometry),
                 "output_root": tmp_path / "out", "spend": SPEND, "now": NOW}
    arguments.update(overrides(geometry) if callable(overrides) else (overrides or {}))
    arguments.update(keyword_overrides)
    return arguments


from blueprint_pipeline import website_task_preparation as preparation
source_path=Path(preparation.__file__).resolve()
source_sha=hashlib.sha256(source_path.read_bytes()).hexdigest()
if source_sha!=EXPECTED_SOURCE_SHA:raise RuntimeError("Installed compiler source hash mismatch")
results=[]
try:
 for name,criteria in (("unknown",{"successDefinition":None,"successRate":None,"cycleTimeSeconds":None,"unknown":True}),("explicit",{"successDefinition":"Arrives intact","successRate":95,"cycleTimeSeconds":30,"unknown":False})):
  root=_smoke_root/name;root.mkdir()
  args=_arguments(root)
  args["task_context"]["success_criteria"]=criteria
  args["task_context"]["context_digest"]=canonical_digest(args["task_context"],digest_field="context_digest")
  before=json.dumps(args["task_context"],sort_keys=True)
  value=preparation.compile_website_scene_preparation(**args)
  assert value["status"]=="intake_ready",value["blockers"]
  assert before==json.dumps(args["task_context"],sort_keys=True)
  assert value["owner_success_criteria"]["targets"]==criteria
  assert value["owner_success_criteria"]["scorer_translation_verified"] is False
  assert value["intake_request"]["execution"]["purpose"]=="scene_preparation"
  assert value["intake_request"]["execution"]["policy_candidates"]==[]
  assert value["claim_ceiling"]=="development_only"
  assert value["provider_mutation_performed"] is False
  persisted=json.loads((root/"out/preparation.json").read_text())
  assert persisted["owner_success_criteria"]==value["owner_success_criteria"]
  results.append({"state":name,"status":value["status"],"targets_retained":True,"translated":False,"purpose":"scene_preparation","policies":[],"claim_ceiling":"development_only"})
 assert _audit["network_or_subprocess_attempts"]==0
 print(json.dumps({"status":"passed","expected_source_commit":EXPECTED_COMMIT,"compiler_sha256":source_sha,"layer":"actual installed compiler on synthetic local geometry only","cases":results,"network_or_subprocess_attempts":0,"writes_confined_to_disposable_root":True,"production_state_used":False,"materializer_executed":False,"native_publication_executed":False},sort_keys=True))
finally:
 _audit["active"]=False
 _smoke_tmp.cleanup()
