"""GET-only provider inventory using the installed, published research SDK binding.

Run with the deployment's existing venv and PYTHONPATH. Raw packets stay private.
No session create, model request, resume, cancel, delete or credential setup.
"""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path


SCHEMA = "blueprint.communications-incident-provider-20261006.v1"


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def references(value, result=None):
    """Collect exact recorded session IDs; never substitute an agent-filtered list."""
    result = {} if result is None else result
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"sessionId", "session_id"} and isinstance(child, str) and child:
                result[child] = True
            references(child, result)
    elif isinstance(value, list):
        for child in value:
            references(child, result)
    return result


def inspect(api, canonical, now=time.time):
    if canonical.get("schema") != "blueprint.communications-incident-20261006.v1" or canonical.get("project") != "blueprint-8c1ca":
        raise ValueError("canonical_binding_invalid")
    if any(q.get("complete") is not True for q in canonical.get("queries", [])):
        raise ValueError("canonical_inventory_incomplete")
    sessions = []
    ids = references(canonical)
    if not ids or len(ids) > 50:
        raise ValueError("canonical_session_inventory_invalid")
    for session_id in sorted(ids):
        try:
            session = api.get("session", session_id)
        except Exception as error:
            if getattr(error, "status_code", None) != 404:
                raise ValueError("provider_get_unavailable") from None
            environment_ids = {s["value"].get("environment_id") for s in canonical.get("sources", [])
                               if s["value"].get("session_id") == session_id}
            environment_ids.discard(None)
            environments = []
            for environment_id in sorted(environment_ids):
                try:
                    environment = api.get("environment", environment_id)
                    environments.append({"environmentId": environment_id, "environment": environment})
                except Exception as environment_error:
                    if getattr(environment_error, "status_code", None) != 404:
                        raise ValueError("provider_environment_get_unavailable") from None
                    environments.append({"environmentId": environment_id, "absent": True, "statusCode": 404})
            sessions.append({"sessionId": session_id, "absent": True, "statusCode": 404, "environments": environments})
            continue
        if session.get("id") != session_id:
            raise ValueError("provider_session_binding_invalid")
        turns = api.listing("turns", session_id)
        items = api.listing("items", session_id)
        artifacts = api.listing("artifacts", session_id)
        bound_environment = session.get("environment")
        if bound_environment is not None and not isinstance(bound_environment, dict):
            raise ValueError("provider_environment_shape_invalid")
        environment_id = session.get("environment_id") or (bound_environment or {}).get("id")
        environment = api.get("environment", environment_id) if environment_id else None
        if environment_id and environment.get("id") != environment_id:
            raise ValueError("provider_environment_binding_invalid")
        sessions.append({"sessionId": session_id, "session": session, "turns": turns, "items": items,
                         "artifacts": artifacts, "environment": environment, "complete": True})
    children = sorted({v.get("findall_id") for s in canonical.get("sources", [])
                       for v in s["value"].get("parallel_findall_submissions", {}).values() if v.get("findall_id")})
    findall = []
    if children:
        from tools.daily_research.findall import runtime
        key = os.environ.get("PARALLEL_API_KEY")
        if not key:
            raise ValueError("existing_findall_get_binding_unavailable")
        client = runtime().api.FindAllClient(key, timeout_seconds=10)
        for findall_id in children:
            try:
                findall.append({"findallId": findall_id, "receipt": client.status(findall_id)})
            except ValueError as error:
                if str(error) != "findall_http_error:404":
                    raise ValueError("findall_get_unavailable") from None
                findall.append({"findallId": findall_id, "absent": True, "statusCode": 404})
    return {"schema": SCHEMA, "observedAtMs": int(now() * 1000), "canonicalDigest": digest(canonical),
            "sessionReferenceDigest": digest(sorted(ids)), "sessions": sessions, "findall": findall, "readOnly": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if not args.output.startswith("/tmp/"):
        raise ValueError("private_output_required")
    from tools.daily_research.runner import Provider
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError("existing_provider_get_binding_unavailable")
    raw = Path(args.canonical).read_bytes()
    api = Provider(key, read_only=True)
    try:
        packet = inspect(api, json.loads(raw))
    finally:
        api.client.close()
    packet["canonicalFileSha256"] = hashlib.sha256(raw).hexdigest()
    output = (json.dumps(packet, sort_keys=True, indent=2) + "\n").encode()
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(output)
    print(json.dumps({"ok": True, "readOnly": True, "schema": SCHEMA, "packetSha256": hashlib.sha256(output).hexdigest(),
                      "observedAtMs": packet["observedAtMs"], "sessions": len(packet["sessions"]),
                      "absent": sum(s.get("absent") is True for s in packet["sessions"])}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error)
        print(json.dumps({"ok": False, "code": code if code.replace("_", "").isalpha() else "provider_inspection_unavailable"}))
        raise SystemExit(2) from None
