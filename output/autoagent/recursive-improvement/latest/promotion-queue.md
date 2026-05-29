# AutoResearch Promotion Queue

- Scope: Repo-local candidate queue only. Does not mutate Paperclip, Hermes, providers, Firebase, Notion, Stripe, Render, or production behavior.
- Generated at: 2026-05-29T21:57:11.149Z
- Queued items: 5

Each item is a candidate for the next repo-local AutoAgent eval, prompt patch, policy patch, or closeout-rule patch. The queue does not authorize live sends, provider calls, production Paperclip mutation, Notion writes, Stripe/Firebase/Render changes, or operational launch claims.

| Priority | Lane | Source family | Owner | Target file | Expected negative control | Validation command | Promotion threshold | Rollback condition | Residual risk |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | autoagent_eval | human_gate_or_reply_durability_blocker | webapp-codex | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` | A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected. | `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts` | Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present. | Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation. | The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered. |
| 2 | autoagent_eval | public_copy_proof_drift | webapp-codex | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` | A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected. | `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts` | Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present. | Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation. | The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered. |
| 3 | autoagent_eval | live_side_effect_boundary_risk | webapp-codex | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` | A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected. | `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts` | Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present. | Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation. | The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered. |
| 4 | autoagent_eval | no_change_closeout_churn | webapp-codex | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` | A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected. | `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts` | Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present. | Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation. | The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered. |
| 5 | autoagent_eval | hosted_session_proof_gap | webapp-codex | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` | A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected. | `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts` | Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present. | Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation. | The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered. |

## 1. Human Gate Or Reply Durability Blocker

- Queue id: `autoresearch:autoagent_eval:human_gate_or_reply_durability_blocker`
- Lane: autoagent_eval
- Owner: webapp-codex
- Target file: `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md`
- Observed count: 182
- Observed agents: local-artifact-observer
- Proof paths: runs=ops/paperclip/reports/autonomous-buyer-loop-blocker-closeout-2026-05-05.md:55, ops/paperclip/reports/autonomy-lane-status-and-human-blocker-adoption-2026-04-12.md:82, ops/paperclip/reports/growth-lead-daily-2026-04-23.md:22, ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:11, ops/paperclip/reports/human-reply-handling-implementation-2026-04-12.md:19, ops/paperclip/reports/gtm-send-executor/2026-05-24/send-executor-manifest.json:19, ops/paperclip/reports/gtm-send-executor/2026-05-24/send-executor.md:22, ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-24T15-01-51-741Z/blocker-status.json:54; issues=none; source=repo-local agent-improvement-observer
- Expected negative control: A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.
- Validation command: `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts`
- Promotion threshold: Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.
- Rollback condition: Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.
- Residual risk: The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.
- Blocked claims: live Paperclip readiness, Hermes/provider recovery, production promotion

## 2. Public Copy Proof Drift

- Queue id: `autoresearch:autoagent_eval:public_copy_proof_drift`
- Lane: autoagent_eval
- Owner: webapp-codex
- Target file: `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md`
- Observed count: 124
- Observed agents: local-artifact-observer
- Proof paths: runs=labs/autoagent/README.md:37, labs/autoagent/tasks/README.md:35, ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:120, ops/paperclip/reports/city-launch-deep-research/seattle-wa/2026-04-20T19-03-22.064Z/01-initial-research.md:2428, ops/paperclip/reports/city-launch-execution/austin-tx/2026-05-06T16-29-00.131Z/founder-decision-packet.md:52, ops/paperclip/reports/city-launch-execution/austin-tx/2026-05-06T16-58-46.601Z/founder-decision-packet.md:52, ops/paperclip/reports/city-launch-execution/austin-tx/2026-05-07T15-22-54.503Z/deep-research-blocker-packet.md:56, ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-launch-durham-nc.md:114; issues=none; source=repo-local agent-improvement-observer
- Expected negative control: A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.
- Validation command: `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts`
- Promotion threshold: Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.
- Rollback condition: Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.
- Residual risk: The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.
- Blocked claims: live Paperclip readiness, Hermes/provider recovery, production promotion

## 3. Live Side Effect Boundary Risk

- Queue id: `autoresearch:autoagent_eval:live_side_effect_boundary_risk`
- Lane: autoagent_eval
- Owner: webapp-codex
- Target file: `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md`
- Observed count: 122
- Observed agents: local-artifact-observer
- Proof paths: runs=labs/autoagent/README.md:68, labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md:53, ops/paperclip/reports/autonomous-buyer-loop-blocker-closeout-2026-05-05.md:42, ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md:115, ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-24T15-01-51-741Z/blocker-status.json:80, ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-24T15-01-51-741Z/blocker-status.md:91, ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-25T01-36-09-729Z/blocker-status.json:81, ops/paperclip/reports/autonomous-growth-blockers/durham-nc/2026-04-25T01-36-09-729Z/blocker-status.md:92; issues=none; source=repo-local agent-improvement-observer
- Expected negative control: A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.
- Validation command: `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts`
- Promotion threshold: Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.
- Rollback condition: Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.
- Residual risk: The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.
- Blocked claims: live Paperclip readiness, Hermes/provider recovery, production promotion

## 4. No Change Closeout Churn

- Queue id: `autoresearch:autoagent_eval:no_change_closeout_churn`
- Lane: autoagent_eval
- Owner: webapp-codex
- Target file: `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md`
- Observed count: 7
- Observed agents: local-artifact-observer
- Proof paths: runs=labs/autoagent/tasks/support-triage/CASE_FORMAT.md:39, labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/expected.json:14, labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/input.json:11, labs/autoagent/harbor/support-triage/shadow/seed-support-no-change-churn/files/source.json:3, labs/autoagent/tasks/support-triage/cases/shadow/seed-support-no-change-churn/expected.json:14, labs/autoagent/tasks/support-triage/cases/shadow/seed-support-no-change-churn/input.json:11, labs/autoagent/tasks/support-triage/cases/shadow/seed-support-no-change-churn/source.json:3; issues=none; source=repo-local agent-improvement-observer
- Expected negative control: A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.
- Validation command: `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts`
- Promotion threshold: Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.
- Rollback condition: Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.
- Residual risk: The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.
- Blocked claims: live Paperclip readiness, Hermes/provider recovery, production promotion

## 5. Hosted Session Proof Gap

- Queue id: `autoresearch:autoagent_eval:hosted_session_proof_gap`
- Lane: autoagent_eval
- Owner: webapp-codex
- Target file: `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md`
- Observed count: 2
- Observed agents: local-artifact-observer
- Proof paths: runs=labs/autoagent/harbor/preview-diagnosis/shadow/seed-preview-hosted-session-proof-gap/files/input.json:8, labs/autoagent/tasks/preview-diagnosis/cases/shadow/seed-preview-hosted-session-proof-gap/input.json:8; issues=none; source=repo-local agent-improvement-observer
- Expected negative control: A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.
- Validation command: `npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts`
- Promotion threshold: Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.
- Rollback condition: Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.
- Residual risk: The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.
- Blocked claims: live Paperclip readiness, Hermes/provider recovery, production promotion
