(
  set -euo pipefail
  umask 077
  export PYTHONDONTWRITEBYTECODE=1
  cd /opt/render/project/src
  RESEARCH_RECOVERY_DIR=$(mktemp -d "$PWD/.research-terminal-recovery-XXXXXXXX")
  export RESEARCH_RECOVERY_DIR
  trap 'RESEARCH_EXIT=$?; printf "recovery_exit=%s\nprivate_log_directory=%s\nPreserve this directory; do not paste raw stdout/stderr.\n" "$RESEARCH_EXIT" "$RESEARCH_RECOVERY_DIR"' EXIT
  RESEARCH_PYTHON="$PWD/dist/daily-research/venv/bin/python"
  test -x "$RESEARCH_PYTHON"
  test -f scripts/install-daily-research.py
  test "$(uname -s)" = Linux
  timeout --version > "$RESEARCH_RECOVERY_DIR/timeout-version.txt" 2>&1
  "$RESEARCH_PYTHON" - "$RESEARCH_RECOVERY_DIR" > "$RESEARCH_RECOVERY_DIR/preflight.stdout" 2> "$RESEARCH_RECOVERY_DIR/preflight.stderr" <<'PY'
import hashlib, json, os, pathlib, subprocess, sys, tarfile, urllib.request
import openai
root = pathlib.Path.cwd()
out = pathlib.Path(sys.argv[1])
deployed = "80ba9b2d5c57092bfa3554093ee840b6872165cb"
original_webapp = "c9fd4b08882926c8cdf213822abce91cbfe5c4e1"
pins = {
    "original": ("35f5c9ad43f84aa053aa7616a63a9aa4f6e32a61", "1aa932767fe9ec73c06ece6b5ba1e573027a636a3249363d62df7bf6415a3651", 409600),
    "repair": ("b9da02f46d4ff6d9846da523b8da01449ae9ac85", "e54fa1529d1a2113fa0d088f59e12fcf40dc18e37f058b32621726ead4bcab82", 655360),
}
observed = []
if os.environ.get("RENDER_GIT_COMMIT"):
    observed.append(os.environ["RENDER_GIT_COMMIT"])
head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
if head.returncode == 0:
    observed.append(head.stdout.strip())
if not observed or any(value != deployed for value in observed):
    raise RuntimeError("deployed_commit_mismatch")
if openai.__version__ != "3.22.1":
    raise RuntimeError("existing_sdk_version_mismatch")
if "GNU coreutils" not in (out / "timeout-version.txt").read_text():
    raise RuntimeError("gnu_timeout_required")
if not os.environ.get("OPENAI_API_KEY") or not os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or not (os.environ.get("NOTION_API_TOKEN") or os.environ.get("NOTION_API_KEY")):
    raise RuntimeError("existing_worker_binding_missing")
for kind, (source, digest, size) in pins.items():
    directory = out / (kind + "-source")
    directory.mkdir(mode=0o700)
    for name in ("receipt.json", "blueprint-research.tar"):
        if kind == "original":
            url = f"https://raw.githubusercontent.com/ognjhunt/Blueprint-WebApp/{original_webapp}/vendor/daily-research/{name}"
            with urllib.request.urlopen(url, timeout=60) as response:
                raw = response.read(1048577)
        else:
            raw = (root / "vendor/daily-research" / name).read_bytes()
        with (directory / name).open("xb") as stream:
            stream.write(raw)
    receipt = json.loads((directory / "receipt.json").read_bytes())
    raw = (directory / "blueprint-research.tar").read_bytes()
    if receipt.get("source_commit") != source or receipt.get("sha256") != digest or receipt.get("bytes") != size or len(raw) != size or hashlib.sha256(raw).hexdigest() != digest:
        raise RuntimeError(kind + "_archive_pin_mismatch")
# The deployed release must match every file in its own pinned manifest too.
release = root / "dist/daily-research/release"
manifest_raw = (release / "manifest.json").read_bytes()
with tarfile.open(out / "repair-source/blueprint-research.tar") as package:
    if manifest_raw != package.extractfile("manifest.json").read():
        raise RuntimeError("deployed_manifest_archive_mismatch")
manifest = json.loads(manifest_raw)
if manifest.get("source_commit") != pins["repair"][0] or manifest.get("activation_performed") is not False or len(manifest.get("files", {})) != 47:
    raise RuntimeError("deployed_release_manifest_mismatch")
for name, digest in manifest["files"].items():
    if not name.startswith("tools/daily_research/") or ".." in pathlib.PurePosixPath(name).parts or hashlib.sha256((release / name).read_bytes()).hexdigest() != digest:
        raise RuntimeError("deployed_release_file_mismatch")
PY
  "$RESEARCH_PYTHON" scripts/install-daily-research.py --verify-only --source "$RESEARCH_RECOVERY_DIR/original-source" --target "$RESEARCH_RECOVERY_DIR/original" > "$RESEARCH_RECOVERY_DIR/original-verification.json" 2> "$RESEARCH_RECOVERY_DIR/original-verification.stderr"
  "$RESEARCH_PYTHON" scripts/install-daily-research.py --verify-only --source "$RESEARCH_RECOVERY_DIR/repair-source" --target "$RESEARCH_RECOVERY_DIR/repair" > "$RESEARCH_RECOVERY_DIR/repair-verification.json" 2> "$RESEARCH_RECOVERY_DIR/repair-verification.stderr"
  set +e
  PYTHONPATH="$RESEARCH_RECOVERY_DIR/repair/release" timeout --signal=TERM --kill-after=60s 1860s "$RESEARCH_PYTHON" "$RESEARCH_RECOVERY_DIR/repair/release/tools/daily_research/operators/research-perplexity-canary.py" collect-completed-qa --package "$RESEARCH_RECOVERY_DIR/original/release" --archive "$RESEARCH_RECOVERY_DIR/original-source/blueprint-research.tar" --repair-package "$RESEARCH_RECOVERY_DIR/repair/release" --repair-archive "$RESEARCH_RECOVERY_DIR/repair-source/blueprint-research.tar" --repair-source b9da02f46d4ff6d9846da523b8da01449ae9ac85 --repair-sha256 e54fa1529d1a2113fa0d088f59e12fcf40dc18e37f058b32621726ead4bcab82 --attempt 1 --date 2026-10-01 > "$RESEARCH_RECOVERY_DIR/collector.stdout" 2> "$RESEARCH_RECOVERY_DIR/collector.stderr"
  RESEARCH_COLLECTOR_EXIT=$?
  set -e
  "$RESEARCH_PYTHON" - "$RESEARCH_RECOVERY_DIR" "$RESEARCH_COLLECTOR_EXIT" > "$RESEARCH_RECOVERY_DIR/status.json" 2> "$RESEARCH_RECOVERY_DIR/status.stderr" <<'PY'
import hashlib, json, pathlib, re, sys
directory = pathlib.Path(sys.argv[1])
exit_code = int(sys.argv[2])
row = {}
try:
    row = json.loads((directory / "collector.stdout").read_text().strip().splitlines()[-1])
except (ValueError, IndexError):
    pass
states = {"blocked", "awaiting_review", "reviewed", "completed", "publication_pending", "workflow_disabled"}
qa_states = {"validated", "pending", "failed", "blocked"}
delivery = {}
for name in ("sheets", "notion"):
    value = row.get("delivery", {}).get(name, {})
    receipt = value.get("receipt") or {}
    delivery[name] = {"readback_verified": receipt.get("readback_verified") if type(receipt.get("readback_verified")) is bool else None}
metadata = {
    "collector_exit": exit_code,
    "state": row.get("state") if row.get("state") in states else None,
    "qa_state": row.get("qa_state") if row.get("qa_state") in qa_states else None,
    "provider_mutations": 0 if type(row.get("provider_mutations")) is int and row["provider_mutations"] == 0 else None,
    "canonical_publication_only": row.get("canonical_publication_only") if type(row.get("canonical_publication_only")) is bool else None,
    "normal_control_changed": row.get("normal_control_changed") if type(row.get("normal_control_changed")) is bool else None,
    "delivery": delivery,
    "collector_receipts_complete": exit_code == 0 and row.get("state") == "completed" and row.get("qa_state") == "validated" and row.get("provider_mutations") == 0 and row.get("canonical_publication_only") is True and row.get("normal_control_changed") is False and all(value["readback_verified"] is True for value in delivery.values()),
    "private_log_directory": str(directory),
    "logs": {},
}
for key in ("row_digest", "qa_artifact_sha256", "terminal_collection_receipt_digest"):
    value = row.get(key)
    metadata[key] = value if isinstance(value, str) and re.fullmatch("[0-9a-f]{64}", value) else None
for name in ("collector.stdout", "collector.stderr"):
    raw = (directory / name).read_bytes()
    metadata["logs"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
print(json.dumps(metadata, sort_keys=True))
PY
  cat "$RESEARCH_RECOVERY_DIR/status.json"
  exit "$RESEARCH_COLLECTOR_EXIT"
)
