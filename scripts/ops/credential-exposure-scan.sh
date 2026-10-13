#!/usr/bin/env bash
#
# credential-exposure-scan.sh — READ-ONLY, offline evidence for the provider
# credential rotation blocker
# (docs/launch-readiness/blockers/2026-07-20-provider-credential-rotation.md).
#
# Reports, per credential pattern, how many places still match in:
#   - the current tracked tree,
#   - the built client bundle (dist/public, if present),
#   - git history (number of commits whose diff adds or removes a match).
# It prints counts and file paths only, never the matched values, and makes
# no network calls. Rotation itself happens in each provider's dashboard.
#
# Usage:
#   scripts/ops/credential-exposure-scan.sh            # tree + bundle + history
#   scripts/ops/credential-exposure-scan.sh --no-history
#
# Exit 0 when the tree and bundle are clean (history hits are expected until a
# coordinated history rewrite), 1 when the tree or bundle still matches.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HISTORY=1
[ "${1:-}" = "--no-history" ] && HISTORY=0

# label|extended regex (kept in step with client/tests/security/client-source-secret-guard.test.ts)
PATTERNS=(
  "Perplexity API key|(^|[^A-Za-z0-9_-])pplx-[A-Za-z0-9]{24,}"
  "Firecrawl API key|(^|[^A-Za-z0-9_-])fc-[A-Za-z0-9]{24,}"
  "Lindy webhook host|api\\.lindy\\.ai"
  "Render API key|rnd_[A-Za-z0-9]{20,}"
  "Hard-coded bearer token|[Bb]earer [A-Za-z0-9._-]{30,}"
)

status=0
for entry in "${PATTERNS[@]}"; do
  label="${entry%%|*}"
  regex="${entry#*|}"
  echo "== ${label}"
  tree_files="$(git -C "$ROOT" grep -IlE "$regex" -- ':!node_modules' ':!docs' ':!**/*.test.ts' ':!scripts/ops/credential-exposure-scan.sh' 2>/dev/null || true)"
  tree_count="$(printf '%s' "$tree_files" | grep -c . || true)"
  echo "tracked files matching: ${tree_count}"
  [ -n "$tree_files" ] && printf '  %s\n' $tree_files
  if [ -d "$ROOT/dist/public" ]; then
    bundle_files="$(grep -rlE "$regex" "$ROOT/dist/public" 2>/dev/null || true)"
    bundle_count="$(printf '%s' "$bundle_files" | grep -c . || true)"
    echo "built bundle files matching: ${bundle_count}"
  else
    bundle_count=0
    echo "built bundle: dist/public not present (run npm run build to include it)"
  fi
  if [ "$HISTORY" -eq 1 ]; then
    history_count="$(git -C "$ROOT" log --all --format=%H -G "$regex" 2>/dev/null | grep -c . || true)"
    echo "commits in history touching a match: ${history_count}"
  fi
  if [ "${tree_count:-0}" -gt 0 ] || [ "${bundle_count:-0}" -gt 0 ]; then status=1; fi
  echo
done

if [ "$status" -eq 0 ]; then
  echo "Tree and bundle are clean. History matches remain until a coordinated rewrite;"
  echo "only provider-side revocation makes an exposed key harmless."
fi
exit "$status"
