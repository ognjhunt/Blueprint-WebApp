#!/usr/bin/env bash
set -euo pipefail

# Stage this script, blueprint-research.tar and receipt.json together through
# the existing authorized repository download. No credentials belong here.
research_artifact_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
research_render_root=/opt/render/project/src
research_sdk="$research_render_root/dist/daily-research/venv/bin/python"
cd -- "$research_render_root"

"$research_sdk" - "$research_artifact_dir" <<'PY'
import hashlib
import json
import sys
from importlib.metadata import version
from pathlib import Path
source = Path(sys.argv[1])
receipt = json.loads((source / 'receipt.json').read_text())
expected = {
    'archive': 'blueprint-research.tar',
    'bytes': 593920,
    'sha256': 'f57e5b3433ba745570d09eedd5b8a93c9d4d926afab27f77bdac773c845410b3',
    'source_commit': '2b0dd7dfd33ff1e3f223c502da6d792d521009d2',
}
if receipt != expected:
    raise SystemExit('recovered_qa_receipt_binding_invalid')
raw = (source / receipt['archive']).read_bytes()
if len(raw) != receipt['bytes'] or hashlib.sha256(raw).hexdigest() != receipt['sha256']:
    raise SystemExit('recovered_qa_archive_binding_invalid')
if version('openai') != '3.22.1':
    raise SystemExit('recovered_qa_sdk_binding_invalid')
print(json.dumps({'recovery_archive_verified': True, 'source_commit': receipt['source_commit'],
                  'python': sys.version.split()[0], 'openai': version('openai')}))
PY

# Use the existing reviewed extractor with dependency installation disabled.
# A fresh local target preserves the installed release and all prior overlays.
research_overlay_root="$(mktemp -d /tmp/blueprint-recovered-qa-2b0dd7df.XXXXXX)"
"$research_sdk" "$research_render_root/scripts/install-daily-research.py" \
  --source "$research_artifact_dir" --target "$research_overlay_root" --verify-only

exec env PYTHONPATH="$research_overlay_root/release" \
  timeout --signal=TERM --kill-after=60s 1860s \
  "$research_sdk" \
  "$research_overlay_root/release/tools/daily_research/operators/research-perplexity-canary.py" \
  recover-original-and-qa \
  --package "$research_render_root/dist/daily-research/release" \
  --archive "$research_render_root/vendor/daily-research/blueprint-research.tar" \
  --repair-package "$research_overlay_root/release" \
  --repair-archive "$research_artifact_dir/blueprint-research.tar" \
  --repair-source 2b0dd7dfd33ff1e3f223c502da6d792d521009d2 \
  --repair-sha256 f57e5b3433ba745570d09eedd5b8a93c9d4d926afab27f77bdac773c845410b3 \
  --attempt 1 --date 2026-10-01
