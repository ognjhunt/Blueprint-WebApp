# Shared-learning recovery verification

Objective: recover shared evidence/history readers that tolerate harmless formats and equivalent timestamps, retain valid sibling evidence through optional failures, and suppress broken revision lineages without promoting obsolete facts.

Repository: `ognjhunt/Blueprint-WebApp`. Code candidate: `ebc6d7f482400f13bbeb61fd733df2cc9afab8ba`, based on main `3c028e2d48e6d2a42cb58a747a33b36b4b6e31c0`. Draft PR: [#803](https://github.com/ognjhunt/Blueprint-WebApp/pull/803).

Run context: delegated from `01a0ef70-d046-74f6-9434-a19e5456b0ef`; prior owner is stopped. No token or spending envelope was supplied. Deadline supplied: October 2, 2026, 12:00 UTC / 07:00 Chicago. This extension does not establish readiness of the separately owned immediate research recovery.

The exact [recovery patch](../../recovery/learning-evidence-recovery-20261002.patch) was fetched from commit `dec6536ea01f96255063b6cd34a84d7017f00c09`, verified as 75,039 UTF-8 bytes with SHA256 `09f46414f919e01d521de7cadae1c737d5f0535db6b09a3c4c4ed0e076adf62c`, and applied cleanly to isolated base `20e67863d8fa75f9a4d73b64e3e91a935ae6d76d`. All 19 files were reconstructed. Rebase onto main reconciled only the two agent-guide conflicts: main's concrete autonomy rule was retained, with server advice for paging and valid sibling recovery. The final code diff contains 18 files because root guidance already shipped in PR #801.

The required independent GPT-6.1 Sol review found three defects, all fixed before final review:

- Malformed business revisions with changed record IDs could revive predecessors. Retained event and supersession pointers now identify affected ancestor lineages.
- Hash-valid cross-record supersessions could quarantine only the revision. Supersession edges now connect record groups before complete-lineage validation.
- Equivalent offset cutoffs could omit stored/live history or fail frozen-source equality. Readers canonicalize accepted instants before comparing cutoffs, and daily analysis uses the authorized canonical request.

Final independent review of `ebc6d7f482400f13bbeb61fd733df2cc9afab8ba` found no remaining concrete code blockers. The reviewer independently passed 4 files / 136 tests and `git diff --check`. Regression tests preserve unaffected siblings and verify that raw records and source provenance are untouched.

Observed verification:

- Focused research, consumer, business, source, native-hook, communications-consumer and portability suites: **8 files / 253 tests passed** on the code candidate.
- `npm run check`: passed; the release gate runs it again on the final code candidate.
- `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1 npm run build`: passed on the final code candidate. This is a compile-only build.
- Asset audit, public claims guard, shared-doctrine verification and static provider-portability audit: passed. The portability audit does not prove remote private artifact access or complete data migration.
- Required graph refresh: passed with an isolated local `graphifyy` interpreter, using the deterministic AST path. Graph metadata records zero model input/output tokens. One pre-existing manifest path was missing; no graph/navigation claim relies on it.
- All five [GitHub CI jobs](https://github.com/ognjhunt/Blueprint-WebApp/actions/runs/36966303674) passed on the code candidate: check, full coverage tests, browser E2E/operator/workspaces, Firebase rules emulators, and build/smoke. The additional `npm run alpha:check` release gate passed: typecheck plus full single-worker coverage; 5,207 tests passed, 0 failed/pending, 5,857 assertions including suites and 0 skipped.

The offline migration command consumed the existing [synthetic input](../research-learning-20261001/offline-input.json), SHA256 `82342d7ca8213d28dc2352628a2126631557e2f98295284f0f0f3ca1b322c84d`. Its new output matched the existing [canonical dry-run artifact](../research-learning-20261001/offline-dry-run.json) byte-for-byte: SHA256 `1f6ab699e70a9eb3954d8c8f650c1a3ab817099f7a495848cfa895d257233397`. Result: 26 proposed append events across 8 prospects, no errors. Replay with those 26 existing events proposed **0 appends**, preserved 26, and retained snapshot `e0694453bc60cf66e47534cf75f9057e84d84aaaec7316625b198a947b92f132`. These are fixture results; `readyForCutover` remains false and no live records were migrated.

Canonical recovery route: clone the user-owned GitHub repository, fetch this PR branch or its final commit, inspect the preserved patch/checksum, and run the focused tests and existing local dry-run/replay CLI. Code, original patch, evidence, fixture JSON, schema/version contracts and source hashes remain in company-controlled GitHub; private business records continue to use existing Firestore and authorized company exports. ChatGPT Library and provider sessions are not required to recover this work. Do not publish private source exports into this public repository.

Acceptance coverage: timestamp and public-label tests cover format tolerance; receipt/reply/site and business-history tests cover optional quarantine; corrupted-ID and hash-valid cross-record tests cover ancestor suppression; no-write/raw-byte assertions cover source preservation; native hooks, consumer exports, idempotent replay and the portability audit cover existing portable contracts. No scheduler, research bridge/caller, communications worker, approval UI or index repair files were changed.

Release branch state: **blocked** pending shared-worker research-window coordination. The parent owns that coordination because an active paid research window must take priority over this extension. Next action: parent confirms the window is clear, then uses the exact reviewed/green head for coordinated merge, main CI and existing CI-gated Render deploy, followed by deployed behavior proof. Retry condition: confirmed clear window and green final-head CI. Routing: this no-send repo packet and delegated closeout; no external messages. No new paid model API calls, credentials/access/security changes, emails, prospect sends or source deletion were performed. Communications remain draft-only. Deployment and production behavior are not claimed here.
