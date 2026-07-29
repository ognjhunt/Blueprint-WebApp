#!/usr/bin/env bash
set -euo pipefail

# npm appends arguments after a package script. Keep the two parity checks in a
# wrapper so an explicit CI contract path reaches the verifier that consumes it
# instead of being attached only to the final command in a shell chain.
tsx scripts/pipeline/verify-robot-eval-job-request-contract.ts "$@"
tsx scripts/pipeline/verify-decision-evidence-router-contract.ts "$@"
