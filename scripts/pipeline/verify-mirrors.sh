#!/usr/bin/env bash
# Every contract this repo mirrors from the Pipeline byte for byte, compared with a Pipeline checkout (round 2,
# 2026-11-24): the robot spec catalog, the $40 job spend cap, the site-task measurement catalog and the
# decision-evidence handoff. Each check fails when its mirror differs or the Pipeline file is missing. Also the list
# of every code the Pipeline sends about a job's simulation (the sweep of 2026-11-24), whose words
# server/tests/pipeline-codes-fixture.test.ts checks.
#
#   PIPELINE_CHECKOUT=/path/to/BlueprintCapturePipeline bash scripts/pipeline/verify-mirrors.sh
#
# PIPELINE_CHECKOUT defaults to the sibling checkout ../BlueprintCapturePipeline.
set -euo pipefail

pipeline="${PIPELINE_CHECKOUT:-../BlueprintCapturePipeline}"
if [ ! -d "$pipeline" ]; then
  echo "verify-mirrors: no Pipeline checkout at $pipeline" >&2
  exit 1
fi
pipeline="$(cd "$pipeline" && pwd)"

PIPELINE_ROBOT_SPEC_CATALOG_PATH="$pipeline/src/blueprint_pipeline/_catalog_data/robot_spec_catalog.v1.json" \
  npx tsx scripts/pipeline/verify-robot-spec-catalog.ts --require-pipeline
PIPELINE_WEBSITE_JOB_SPEND_CAP_PATH="$pipeline/config/website_job_spend_cap.v1.json" \
  npx tsx scripts/pipeline/verify-website-job-spend-cap.ts --require-pipeline
PIPELINE_SITE_TASK_MEASUREMENT_CATALOG_PATH="$pipeline/docs/schemas/site_task_measurement_catalog.v1.json" \
  npx tsx scripts/pipeline/verify-site-task-measurement-catalog.ts --require-pipeline
PIPELINE_DECISION_EVIDENCE_CONTRACT_PATH="$pipeline/docs/webapp_handoff/decision-evidence-router.v1" \
  npx tsx scripts/pipeline/verify-decision-evidence-router-contract.ts --require-pipeline
codes="docs/webapp_handoff/website-pipeline-codes.v1.json"
if ! cmp -s "$pipeline/$codes" contracts/pipeline/website-pipeline-codes.v1.json; then
  echo "verify-mirrors: contracts/pipeline/website-pipeline-codes.v1.json differs from the Pipeline's $codes, or the Pipeline has no such file" >&2
  exit 1
fi
