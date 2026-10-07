"""Bounded synthetic actual-CLI regression; no credentials or live API calls."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

repo = Path(__file__).resolve().parents[2]
source = repo / "scripts/action-ledger-index-diagnostic.mjs"
with tempfile.TemporaryDirectory(prefix="blueprint-action-ledger-index-", dir="/tmp") as directory:
    root = Path(directory)
    operator = root / "operator.mjs"
    operator.write_bytes((repo / "scripts/action-ledger-index-operator.mjs").read_bytes())
    operator.chmod(0o600)
    fifo = root / "receipts.jsonl"
    os.mkfifo(fifo, 0o600)
    started = time.monotonic()
    # No account, ADC, provider key or inherited credential enters the child.
    env = {"PATH": os.environ["PATH"], "RENDER_SERVICE_ID": "srv-d9t8gg1t0dsc73am9q70",
           "RENDER_GIT_COMMIT": "efd2e685819328c4c3060cec7d105142612adf63",
           "FIREBASE_SERVICE_ACCOUNT_JSON": "{}"}
    result = subprocess.run(["node", str(source), str(operator), "archive-operator", str(fifo), "0" * 64],
                            cwd=repo, env=env, capture_output=True, text=True, timeout=1.5)
    rows = [json.loads(line) for line in (result.stdout + result.stderr).splitlines()]
    assert result.returncode == 2, result.returncode
    assert rows == [{"ok": False, "code": "archive_source_file_invalid"}], rows
    proof = {"schema": "blueprint.synthetic_operator_fifo_regression.v1", "passed": True,
             "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "exitCode": result.returncode,
             "code": rows[0]["code"], "elapsedSeconds": time.monotonic() - started,
             "beforeAuthentication": True, "network": "no credentials; rejected before token acquisition"}
print(json.dumps(proof))
