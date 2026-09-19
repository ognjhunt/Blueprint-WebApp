# Onboarding P1 implementation — 2026-09-19

State: done (isolated implementation and local verification).
Objective: implement F4–F8 with a minimal site/robot-team journey and a thumbnail on every task card.
Session: `01a0b9b3-929d-7231-99b2-af466add8bf5`. No Paperclip issue or budget was supplied.
Stage reached: local code, API regressions, browser verification and production build. This is not a deployment or live delivery receipt.

The user assigned P0 to Fable in the original checkout. This branch is based on `0722d5f9`, preserves that work, and leaves payment, dispatch and result projection to that lane. The changes directly support partner admission, authorization and task-evaluation evidence review. No new program or fabricated public supply is introduced.

## Requirement coverage

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| F4: correct device handoff | Desktop shows a primary QR and task-page link; phones show the camera. | Desktop/phone intake browser cases. |
| F5: useful task rows | Exact owner-approved task title, objects, site type, region, target and pilot timing; unknown fields omitted. Private candidates retain a unique neutral task label. | Public projection tests; browser selected-task plan. |
| F6: browse before setup | `/contact/robot-team` and `/sites` use one inbound-request projection, with independent scene stage and pilot availability. Exact task selection passes through plan selection. Empty and outage states differ. Preferences persist without creating a team or run. | Feed/withdrawal, runnable gates, CSRF preferences and browse browser tests. |
| F7: usable capture page | One polling status; upload beside instructions; small brand/back header; optional brief, item photos, colleague handoff and public card disclosures. | Desktop/phone screenshots, single-status and upload-proximity assertions. |
| F8: committed updates | Persisted 24-hour receipt/screening or 48-hour other-stage check-ins; polling never extends a promise. Existing outbox worker enqueues due messages and advances the deadline after confirmed delivery. Failed delivery remains overdue. | Deadline persistence, failed-send/retry, terminal cancellation and orphan-queue tests. |
| Thumbnails | Every browse/selected/plan card has an owner-approved photo or a labeled task illustration. Local crop, explicit permission, bounded PNG decode/re-encode, metadata stripping, digest integrity and public withdrawal checks. | Metadata/permission/revocation tests and browser crop/remove/fallback cases. |

Public listing permission is separate from capture/evaluation permission. Existing submissions are never automatically published. Site contact details, original footage and scene are not projected into this feed. Paused, development-only and explicitly rights-restricted records are excluded. The existing paid-run readiness predicate is reused without weakening it. Legacy detail/API consumers remain compatible; the old `/sites` catalogue UI is replaced.

Thumbnails reduce accidental identity disclosure; they do not guarantee anonymity. Crops should exclude logos, faces, signs, shipping labels and recognizable surroundings. Public text also needs owner review. Someone can retain an already downloaded image after withdrawal. Blueprint's durable value remains task preparation, evaluation and evidence, not the secrecy of an address.

## Verification

- TypeScript: `npm run check` passed.
- Focused regressions: 86 tests across 12 files passed; an additional orphan-deadline regression was then added and the affected deadline/outbox suite passed 25 tests.
- Browser: 8 desktop/phone cases passed using `playwright.onboarding-p1.config.ts`; external requests and API writes mocked. No live Firestore writes, Stripe charges, provider execution or messages.
- Production build: `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1 npm run build` passed (local build, no production configuration).
- Full coverage run: 519 files / 3,338 tests passed initially. It exposed a `/sites` canvas mismatch and two outdated Firebase mocks; those were fixed and affected suites passed. Four remaining failures reproduced unchanged in a detached baseline at `0722d5f9`: one agent-team-spend ledger/policy error expectation, one per-lane provider fallback expectation, and two runtime-connectivity provider expectations. Full-suite green is not claimed.
- Architecture refresh: completed with an isolated temporary Python environment after the installed launcher lacked its package. `graphify-out/GRAPH_REPORT.md` and `graph.json` were published locally; 1,214 nodes and 1,968 edges. No semantic/model extraction.
- Claims guard and `git diff --check`: passed.
- Local screenshots and browser traces: `output/qa/onboarding-p1/`. Screenshots show explicit test fixtures, not live opportunities.

## Integration with P0

Owner: Fable's P0 lane in Blueprint-WebApp. Merge this branch with that lane's current code while preserving both sets of behavior:

- `RobotTeamPlanPreview`: keep `sceneId` in `/plan`, task facts and thumbnails alongside P0's funding/run buttons.
- `SelfCaptureUpload`: keep one status poll/render, adjacent uploader and owner listing controls while adding P0's result/claim actions.
- `site-task-brief`, `workspace`, `inbound-request`: retain the deadline hooks alongside real brief drafting and outcome projection.
- A terminal assessment must explicitly clear `site_task_next_update_iso` with `site_task_last_decision.kind = assessment_ready`, as the existing commitment contract does. A `results` display state alone does not mean all assessment work is over; it should not silently stop promised updates.
- Run the focused tests and browser cases after resolving these overlapping files. Any actual launch requires deployed identity, scheduled-worker and inbox evidence; none is inferred from this local work.

No Paperclip mutation or external message was needed for this repo-local branch. Retry/resume condition: integrate against the final P0 commit, rerun the shared-file checks, then follow the existing release process. Residual risks: production inventory, owner publication participation, scheduler liveness, actual email receipt and the P0 run/result loop remain separately unverified.
