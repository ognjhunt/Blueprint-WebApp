"""Exact stopped Oct6 cleanup: inspect/export, archived one-time DELETE, observe.

Inspect is GET-only. Delete requires the separately reviewed Node journal,
owner-bound fence and generation-verified archive. Unknown DELETE ACKs never
authorize resubmission. Existing record_cleanup verifies both authenticated404s.
"""
import argparse
import hashlib
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

SOURCE = "cdc97c4c6852a815b71910ece823c7179d9fbb445879e78f06a15dd587efb2b6"
DAY = "2026-10-06"


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def save(path, value):
    raw = (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(raw)
    return hashlib.sha256(raw).hexdigest()


def target(row):
    return {"sourceBlobSha256": SOURCE, "sessionId": row["session_id"], "environmentId": row["environment_id"]}


def source(bridge):
    snapshot = bridge.call("snapshot", day=DAY)
    raw = snapshot["source_row_json"].encode()
    row = snapshot["row"]
    if (hashlib.sha256(raw).hexdigest() != SOURCE or row.get("date") != DAY or row.get("state") != "cancelled"
            or row.get("turn_status") != "cancelled" or not row.get("evidence_digest") or row.get("qa") or row.get("publication")):
        raise ValueError("exact_stopped_source_changed")
    return row, raw


def terminal_inventory(api, row):
    session = api.get("session", row["session_id"])
    environment = api.get("environment", row["environment_id"])
    turns = api.listing("turns", row["session_id"])
    items = api.listing("items", row["session_id"])
    artifacts = api.listing("artifacts", row["session_id"])
    if (session.get("id") != row["session_id"] or session.get("status") != "idle" or session.get("required_actions")
            or digest(session.get("metadata")) != digest(row["metadata"]) or environment.get("id") != row["environment_id"]
            or {t.get("id") for t in turns} != {row["turn_id"]} or len(turns) != 1
            or turns[0].get("status") != "cancelled" or turns[0].get("subagent_id")
            or any(i.get("turn_id") not in {None, row["turn_id"]} or i.get("subagent_id")
                   or ("status" in i and i["status"] not in {"completed", "cancelled", "failed"})
                   or ("status" not in i and i.get("type") not in {"message", "function_call", "function_call_output", "mcp_call", "mcp_list_tools", "reasoning"}) for i in items)
            or any(a.get("turn_id") not in {None, row["turn_id"]} for a in artifacts)):
        raise ValueError("stopped_execution_inventory_changed")
    children = []
    submissions = row.get("parallel_findall_submissions", {})
    if submissions:
        from tools.daily_research.findall import runtime
        key = os.environ.get("PARALLEL_API_KEY")
        if not key:
            raise ValueError("existing_findall_get_binding_unavailable")
        client = runtime().api.FindAllClient(key, timeout_seconds=10)
        for child in submissions.values():
            if not child.get("findall_id"):
                raise ValueError("stopped_child_create_unmapped")
            receipt = client.status(child["findall_id"])
            if receipt.get("findall_id") != child["findall_id"] or receipt.get("status", {}).get("is_active") is not False:
                raise ValueError("stopped_child_execution_unsettled")
            children.append(receipt)
    return {"provider-session.json": session, "provider-environment.json": environment, "provider-turns.json": turns,
            "provider-items.json": items, "provider-artifacts.json": artifacts, "provider-findall.json": children}


def inspect(api, bridge, directory):
    from tools.daily_research.render import export_snapshot
    row, raw = source(bridge)
    export = directory / "export"
    result = export_snapshot(bridge, DAY, export)
    # A cancelled root has no finished final answer. All other requested retained
    # evidence, application-tool files and FindAll receipts must be present.
    if set(result["missing_files"]) - {"artifact", "output", "review"}:
        raise ValueError("stopped_export_evidence_missing")
    if digest(json.loads((export / "status.json").read_bytes())) != digest(row):
        raise ValueError("stopped_export_source_changed")
    (export / "source-row.json").write_bytes(raw)
    inventory = terminal_inventory(api, row)
    for name, value in inventory.items():
        save(export / name, value)
    for artifact in inventory["provider-artifacts.json"]:
        artifact_id = artifact.get("id")
        if not isinstance(artifact_id, str) or not artifact_id:
            raise ValueError("stopped_artifact_reference_invalid")
        name = "provider-artifact-" + hashlib.sha256(artifact_id.encode()).hexdigest() + ".bin"
        (export / name).write_bytes(api.artifact(row["session_id"], artifact_id))
    files = [{"name": p.name, "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
             for p in sorted(export.iterdir()) if p.is_file()]
    packet = {"schema": "blueprint.stopped-oct6-cleanup-readback.v1", "observedAtMs": int(time.time() * 1000),
              "sourceBlobSha256": SOURCE, "targetDigest": digest(target(row)), "files": files,
              "missingFiles": result["missing_files"], "inventory": inventory, "readOnly": True}
    sha = save(directory / "cleanup-readback.json", packet)
    return {"ok": True, "readOnly": True, "state": "export_retained_locally", "readbackFileSha256": sha, "files": len(files)}


def operator(mode, directory):
    script = Path(__file__).with_name("communications-incident-recovery-20261006.mjs")
    result = subprocess.run(["node", "--import", "tsx", str(script), mode, str(directory)],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=150, check=False)
    frames = []
    for line in result.stdout.splitlines():
        try:
            frames.append(json.loads(line))
        except ValueError:
            pass
    frame = next((f for f in reversed(frames) if isinstance(f, dict) and isinstance(f.get("ok"), bool)), None)
    if result.returncode != 0 or not frame or frame.get("ok") is not True:
        raise ValueError("cleanup_journal_operation_unavailable")
    return frame


def observe(api, bridge, directory):
    from tools.daily_research.firestore import FirestoreLedger, control_configuration
    from tools.daily_research.runner import Runner
    row = bridge.call("get", day=DAY)
    t = target(row)
    readback = json.loads((directory / "cleanup-readback.json").read_bytes())
    if digest(t) != readback["targetDigest"]:
        raise ValueError("cleanup_observation_target_changed")
    for kind in ("session", "environment"):
        try:
            api.get(kind, row[kind + "_id"])
        except Exception as error:
            if getattr(error, "status_code", None) != 404:
                raise ValueError("cleanup_absence_unverified") from None
        else:
            return {"ok": True, "state": "resources_still_present_observe_only", "resubmitDelete": False}
    journal = json.loads((directory / "cleanup-journal.json").read_bytes())
    if (journal.get("schema") != "blueprint.stopped-oct6-cleanup-journal-readback.v1"
            or journal.get("journalRef") != "blueprintDailyResearch/sites-first/incidentCleanup/2026-10-06"
            or journal.get("targetDigest") != digest(t) or not journal.get("archive", {}).get("objects")):
        raise ValueError("cleanup_journal_readback_unbound")
    if row.get("cleanup_required") is False:
        receipt = row.get("cleanup_receipt", {})
        if receipt.get("archive") != journal["archive"] or receipt.get("session_id") != row["session_id"] or receipt.get("environment_id") != row["environment_id"]:
            raise ValueError("cleanup_recorded_receipt_changed")
        return {"ok": True, "state": "exact_stopped_cleanup_already_recorded", "bothResourcesAbsent": True, "billingStopVerified": False}
    operator("release-cleanup-fence", directory)
    # Reuse the unchanged native action-time record contract. This performs its
    # own authenticated GET404 checks under the ordinary canonical research lease.
    authority = json.loads((directory / "authority.json").read_bytes())
    receipt = {"authority_type": "action_time_owner_direction", "action_time_approval_reference": authority["approvalReference"],
               "session_id": row["session_id"], "environment_id": row["environment_id"], "archive": journal["archive"],
               "incident_journal_ref": "blueprintDailyResearch/sites-first/incidentCleanup/2026-10-06",
               "observedAtMs": int(time.time() * 1000), "billing_stop_verified": False, "standingAuthority": False}
    ledger = FirestoreLedger(bridge)
    runner = Runner(ledger, control_configuration(bridge.call("control")), api)
    runner.record_cleanup(DAY, receipt)
    return {"ok": True, "state": "exact_stopped_cleanup_recorded", "bothResourcesAbsent": True, "billingStopVerified": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["inspect", "delete", "observe"])
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    if not args.directory.startswith("/tmp/"):
        raise ValueError("private_directory_required")
    os.umask(0o077)
    from tools.daily_research.firestore import Bridge
    from tools.daily_research.runner import Provider, PROJECT
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError("existing_provider_binding_unavailable")
    directory = Path(args.directory)
    api = Provider(key, read_only=True)
    bridge = Bridge()
    try:
        if args.mode == "inspect":
            result = inspect(api, bridge, directory)
        elif args.mode == "observe":
            result = observe(api, bridge, directory)
        else:
            row, _ = source(bridge)
            live = terminal_inventory(api, row)
            retained = json.loads((directory / "cleanup-readback.json").read_bytes())["inventory"]
            if any(digest(live[name]) != digest(retained[name]) for name in ("provider-session.json", "provider-turns.json", "provider-items.json", "provider-artifacts.json")):
                raise ValueError("archived_provider_inventory_changed")
            claim = operator("cleanup-submit", directory)
            if claim.get("submitDelete") is not True:
                result = {"ok": True, "state": "delete_already_claimed_observe_only", "resubmitDelete": False}
            else:
                from openai import OpenAI, DefaultHttpxClient
                submitted = False

                def scoped_http(request):
                    nonlocal submitted
                    url = urlparse(str(request.url))
                    if request.method != "DELETE" or submitted or url.scheme != "https" or url.hostname != "api.openai.com" or not url.path.endswith("/sessions/" + row["session_id"]):
                        raise ValueError("cleanup_provider_mutation_forbidden")
                    submitted = True

                deletion = Provider.__new__(Provider)
                deletion.client = OpenAI(api_key=key, project=PROJECT, max_retries=0, timeout=20,
                                        http_client=DefaultHttpxClient(follow_redirects=False, event_hooks={"request": [scoped_http]}))
                deletion.api = deletion.client.beta.agents
                try:
                    deletion.delete_session(row["session_id"], DAY, digest(target(row)))
                    result = {"ok": True, "state": "delete_acknowledged_observe_required", "resubmitDelete": False}
                except Exception:
                    result = {"ok": True, "state": "delete_ack_unknown_observe_only", "resubmitDelete": False}
                finally:
                    deletion.client.close()
        print(json.dumps(result))
    finally:
        api.client.close()
        bridge.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error)
        print(json.dumps({"ok": False, "code": code if code.replace("_", "").isalpha() else "stopped_cleanup_unavailable"}))
        raise SystemExit(2) from None
