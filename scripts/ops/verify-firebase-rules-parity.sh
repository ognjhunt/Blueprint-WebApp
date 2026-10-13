#!/usr/bin/env bash
#
# verify-firebase-rules-parity.sh — READ-ONLY diff of the DEPLOYED Firebase
# security rules and composite indexes against this repository.
#
# Compares:
#   - the live Firestore ruleset (release cloud.firestore) with firestore.rules
#   - the live Storage ruleset(s) (releases firebase.storage/<bucket>) with storage.rules
#   - live composite indexes with firestore.indexes.json (by collection + fields)
#
# It reads through the Firebase Rules REST API and `gcloud firestore indexes`
# using the caller's gcloud credentials. It never deploys, creates or deletes
# anything. Run it by hand; do not run it from CI.
#
# Usage:
#   scripts/ops/verify-firebase-rules-parity.sh --project blueprint-8c1ca
#
# Needs: gcloud (authenticated; roles/firebaserules.viewer + roles/datastore.indexAdmin
#        or viewer), curl, node.
#
# Exit codes:
#   0  deployed rules and indexes match the repo
#   1  drift found (diff printed)
#   2  usage error / missing tools / auth failure

set -euo pipefail

PROJECT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$PROJECT" ] || { echo "error: --project is required" >&2; exit 2; }
for tool in gcloud curl node diff; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: $tool not found" >&2; exit 2; }
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
TOKEN="$(gcloud auth print-access-token 2>/dev/null)" || { echo "error: gcloud is not authenticated" >&2; exit 2; }
API="https://firebaserules.googleapis.com/v1"
status=0

get() {
  curl -fsS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT}" "$1"
}

ruleset_source() {
  # $1 = release name (e.g. projects/p/releases/cloud.firestore)
  local release ruleset
  release="$(get "${API}/$1")" || return 1
  ruleset="$(printf '%s' "$release" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).rulesetName||""))')"
  [ -n "$ruleset" ] || return 1
  get "${API}/${ruleset}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const f=(JSON.parse(s).source||{}).files||[];process.stdout.write(f.map(x=>x.content).join("\n"))})'
}

compare() {
  # $1 label, $2 deployed file, $3 repo file
  if diff -u "$2" "$3" > "$WORK/diff.txt"; then
    echo "OK: $1 matches the repo."
  else
    echo "DRIFT: $1 differs from the repo (- deployed, + repo):"
    cat "$WORK/diff.txt"
    status=1
  fi
}

echo "== Firestore rules (${PROJECT})"
if ruleset_source "projects/${PROJECT}/releases/cloud.firestore" > "$WORK/firestore.rules"; then
  compare "Firestore rules" "$WORK/firestore.rules" "$ROOT/firestore.rules"
else
  echo "error: could not read the deployed Firestore release" >&2
  exit 2
fi

echo
echo "== Storage rules"
releases="$(get "${API}/projects/${PROJECT}/releases?pageSize=100")" || { echo "error: could not list releases" >&2; exit 2; }
storage_releases="$(printf '%s' "$releases" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s).releases||[]){if(/\/releases\/firebase\.storage\//.test(r.name))console.log(r.name)}})')"
if [ -z "$storage_releases" ]; then
  echo "NOTE: no firebase.storage release found."
else
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    ruleset_source "$name" > "$WORK/storage.rules" || { echo "error: could not read $name" >&2; status=1; continue; }
    compare "Storage rules (${name##*/releases/})" "$WORK/storage.rules" "$ROOT/storage.rules"
  done <<< "$storage_releases"
fi

echo
echo "== Composite indexes"
gcloud firestore indexes composite list --project="$PROJECT" --format=json > "$WORK/live-indexes.json" \
  || { echo "error: could not list composite indexes" >&2; exit 2; }
node - "$WORK/live-indexes.json" "$ROOT/firestore.indexes.json" > "$WORK/index-report.txt" <<'NODE' || status=1
const fs = require("node:fs");
const [livePath, repoPath] = process.argv.slice(2);
const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const repo = JSON.parse(fs.readFileSync(repoPath, "utf8")).indexes || [];
const keyOf = (group, scope, fields) => `${group}|${scope}|${fields
  .filter((f) => f.fieldPath !== "__name__")
  .map((f) => `${f.fieldPath}:${f.order || f.arrayConfig || ""}`).join(",")}`;
const liveKeys = new Set(live.map((i) => keyOf(i.name.split("/collectionGroups/")[1].split("/")[0], i.queryScope, i.fields || [])));
const repoKeys = new Set(repo.map((i) => keyOf(i.collectionGroup, i.queryScope || "COLLECTION", i.fields || [])));
const missing = [...repoKeys].filter((k) => !liveKeys.has(k));
const extra = [...liveKeys].filter((k) => !repoKeys.has(k));
console.log(`repo=${repoKeys.size} deployed=${liveKeys.size}`);
for (const k of missing) console.log(`MISSING IN PRODUCTION: ${k}`);
for (const k of extra) console.log(`DEPLOYED BUT NOT IN REPO: ${k}`);
process.exit(missing.length || extra.length ? 1 : 0);
NODE
cat "$WORK/index-report.txt"

echo
if [ "$status" -eq 0 ]; then
  echo "OK: deployed rules and indexes match the repository."
else
  echo "Drift found. Deploying rules is last-writer-wins across Blueprint-WebApp and"
  echo "BlueprintCapture (see scripts/check-firestore-rules-parity.sh); coordinate before deploying."
fi
exit "$status"
