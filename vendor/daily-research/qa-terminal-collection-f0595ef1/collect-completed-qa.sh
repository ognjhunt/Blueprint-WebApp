#!/usr/bin/env bash
set -euo pipefail
umask 077

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
    'bytes': 645120,
    'sha256': '1a7e37bcbd1c182b1a2003167e2e6ead719de23ba8da116698e60f32536a5ee4',
    'source_commit': 'f0595ef183b2207facb7ef754685ff30249a0731',
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
research_overlay_root="$(mktemp -d /tmp/blueprint-qa-terminal-f0595ef1.XXXXXX)"
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

env PYTHONPATH="$research_overlay_root/release" \
  timeout --signal=TERM --kill-after=60s 1860s \
  "$research_sdk" \
  "$research_overlay_root/release/tools/daily_research/operators/research-perplexity-canary.py" \
  collect-completed-qa \
  --package "$research_render_root/dist/daily-research/release" \
  --archive "$research_render_root/vendor/daily-research/blueprint-research.tar" \
  --repair-package "$research_overlay_root/release" \
  --repair-archive "$research_artifact_dir/blueprint-research.tar" \
  --repair-source f0595ef183b2207facb7ef754685ff30249a0731 \
  --repair-sha256 1a7e37bcbd1c182b1a2003167e2e6ead719de23ba8da116698e60f32536a5ee4 \
  --attempt 1 --date 2026-10-01 | tee "$research_overlay_root/collection-receipt.json"

"$research_sdk" - "$research_overlay_root/collection-receipt.json" <<'PY'
import json
import sys
from pathlib import Path
result = json.loads(Path(sys.argv[1]).read_text())
if (result.get('state') != 'completed' or result.get('qa_state') != 'validated'
        or result.get('qa_turn_status') != 'completed' or result.get('provider_mutations') != 0
        or result.get('qa_artifact_sha256') != 'e58c22f954dc9e70c6a8982b7bc6189473bc4a19a01737606724df97f90338b3'
        or set(result.get('delivery', {})) != {'notion', 'sheets'}
        or any(d.get('state') != 'acknowledged' or d.get('receipt', {}).get('readback_verified') is not True
               for d in result['delivery'].values())):
    raise SystemExit('terminal_qa_canonical_publication_incomplete')
PY

research_export="$research_overlay_root/verified-export"
env PYTHONPATH="$research_overlay_root/release" \
  "$research_sdk" \
  "$research_overlay_root/release/tools/daily_research/operators/research-perplexity-canary.py" \
  export-recovered \
  --package "$research_render_root/dist/daily-research/release" \
  --archive "$research_render_root/vendor/daily-research/blueprint-research.tar" \
  --repair-package "$research_overlay_root/release" \
  --repair-archive "$research_artifact_dir/blueprint-research.tar" \
  --repair-source f0595ef183b2207facb7ef754685ff30249a0731 \
  --repair-sha256 1a7e37bcbd1c182b1a2003167e2e6ead719de23ba8da116698e60f32536a5ee4 \
  --attempt 1 --date 2026-10-01 --output "$research_export" \
  | tee "$research_overlay_root/export-receipt.json"

"$research_sdk" - "$research_overlay_root/export-receipt.json" "$research_export" <<'PY'
import hashlib
import json
import sys
from pathlib import Path
receipt = json.loads(Path(sys.argv[1]).read_text())
export = Path(sys.argv[2])
qa = (export / '2026-10-01-qa.json').read_bytes()
row = json.loads((export / 'status.json').read_text())
recovery = row['qa'].get('terminal_collection_recovery', {})
if (receipt.get('missing_files') != [] or row.get('state') != 'completed'
        or hashlib.sha256(qa).hexdigest() != 'e58c22f954dc9e70c6a8982b7bc6189473bc4a19a01737606724df97f90338b3'
        or recovery.get('native_receipt', {}).get('cancellation_requested_at', 'absent') is not None
        or recovery.get('previous_qa', {}).get('cancel_attempted') is not True
        or row['qa'].get('cancel_attempted') is not True or row['qa'].get('cancel_record')):
    raise SystemExit('terminal_qa_private_export_binding_invalid')
print(json.dumps({'collection_and_canonical_readbacks_verified': True,
                  'provider_mutations': 0, 'export_missing_files': [],
                  'cancellation_history_preserved': True,
                  'exact_cancellation_time': 'unknown',
                  'cleanup_required': row.get('cleanup_required'),
                  'private_export_directory': str(export)}))
PY
