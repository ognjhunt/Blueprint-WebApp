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
    'bytes': 614400,
    'sha256': '500acea40f882afcaf82d4a64feab67fe87e2e23925f13bfcd442fba040441d4',
    'source_commit': '210d9f20c16ee169d7546ce68626c293be9a9f9e',
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
research_overlay_root="$(mktemp -d /tmp/blueprint-qa503-retry-210d9f20.XXXXXX)"
"$research_sdk" "$research_render_root/scripts/install-daily-research.py" \
  --source "$research_artifact_dir" --target "$research_overlay_root" --verify-only

# The reviewed bridge resolves Node imports from its own isolated package.
# Reuse the deployed dependencies; no package installation or credential change.
ln -s -- "$research_render_root/node_modules" "$research_overlay_root/node_modules"
node --input-type=module - "$research_overlay_root/release" <<'JS'
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require = createRequire(pathToFileURL(resolve(process.argv[2], 'tools/daily_research/firestore_bridge.mjs')));
const dependencies = ['firebase-admin/app', 'firebase-admin/firestore', 'google-auth-library'];
for (const name of dependencies) require.resolve(name);
console.log(JSON.stringify({node_dependencies_verified: dependencies}));
JS

exec env PYTHONPATH="$research_overlay_root/release" \
  timeout --signal=TERM --kill-after=60s 1860s \
  "$research_sdk" \
  "$research_overlay_root/release/tools/daily_research/operators/research-perplexity-canary.py" \
  retry-qa-submission \
  --package "$research_render_root/dist/daily-research/release" \
  --archive "$research_render_root/vendor/daily-research/blueprint-research.tar" \
  --repair-package "$research_overlay_root/release" \
  --repair-archive "$research_artifact_dir/blueprint-research.tar" \
  --repair-source 210d9f20c16ee169d7546ce68626c293be9a9f9e \
  --repair-sha256 500acea40f882afcaf82d4a64feab67fe87e2e23925f13bfcd442fba040441d4 \
  --attempt 1 --date 2026-10-01
