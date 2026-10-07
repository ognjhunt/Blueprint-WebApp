"""Supported source-compatible wrapper over the unchanged exact Oct6 cleanup.

Provider GETs, bounded DELETE, unknown-ACK observation and native record_cleanup
remain the historical implementation. Only source decoding and journal selection
change. Invocation never activates a worker or grants spending/sending authority.
"""
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
OLD = HERE / "communications-incident-cleanup-20261006.py"
if hashlib.sha256(OLD.read_bytes()).hexdigest() != "278d7d8ddb42260bd6b84cc1b0c8432fdbd46d635023d7bf768b056df3eea1b1":
    raise ValueError("historical_cleanup_helper_changed")
spec = importlib.util.spec_from_file_location("blueprint_historical_oct6_cleanup", OLD)
historical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(historical)


def source(bridge):
    snapshot = bridge.call("snapshot", day=historical.DAY)
    row = snapshot["row"]
    if "source_row_json" in snapshot:
        raw_text = snapshot["source_row_json"]
    else:
        raw_text = json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    if not isinstance(raw_text, str) or json.loads(raw_text) != row:
        raise ValueError("exact_stopped_source_changed")
    raw = raw_text.encode()
    if (hashlib.sha256(raw).hexdigest() != historical.SOURCE or row.get("date") != historical.DAY
            or row.get("state") != "cancelled" or row.get("turn_status") != "cancelled"
            or not row.get("evidence_digest") or row.get("qa") or row.get("publication")):
        raise ValueError("exact_stopped_source_changed")
    return row, raw


def operator(mode, directory):
    if mode not in {"cleanup-submit", "release-cleanup-fence"}:
        raise ValueError("successor_cleanup_mode_invalid")
    script = HERE / "communications-successor-cleanup-20261007.mjs"
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


# Explicit supported adapter; the historical file and its byte pin stay intact.
historical.source = source
historical.operator = operator

if __name__ == "__main__":
    try:
        historical.main()
    except Exception as error:
        code = str(error)
        print(json.dumps({"ok": False, "code": code if code.replace("_", "").isalpha() else "stopped_cleanup_unavailable"}))
        raise SystemExit(2) from None
