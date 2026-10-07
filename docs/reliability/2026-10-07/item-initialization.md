# Preserve accepted inventory across delayed first reads

`GET /api/site-task-brief/:token/items` is used by `TaskItemsPanel` on mount, including the panel inside a collapsed HTML `details` element. On its first read it derives suggestions from the stored brief. This is local noun matching, with `basis: suggested` and `assetStatus: pending`; it does not invoke a model, enqueue notifications, authorize processing or change consent.

The old initializer nevertheless had a data-loss race: read missing inventory, await brief, then replace the entire inventory with `set(..., {merge:false})`. While that GET waited, an owner could successfully add an item and a film link could successfully upload its photo. The delayed GET then discarded both accepted records. Both owner and film GETs could cause this overwrite.

The route now calls `initializeItemInventory`, which uses Firestore `DocumentReference.create`. Its server-enforced `exists:false` precondition allows only the absent inventory to be seeded. On an already-exists conflict, the route reads and returns the winning inventory. Other errors, unknown write outcomes and a missing conflict readback fail explicitly through the existing 503 response. A lost acknowledgement does not cause a replacing write on retry.

## Reproduction and verification

The controlled route regression pauses the first GET after its missing-inventory check while the brief is being read. It then completes an owner item POST (HTTP 200) and a film photo POST (HTTP 201), snapshots the accepted inventory, and releases the original GET. The assertion requires both the durable inventory and returned item/photo count to preserve that snapshot. It covers both owner and film first-read tokens.

- Before fix: both new interleavings failed; 9 unrelated route cases were deselected. The late read replaced the owner label/location and exact stored photo reference with derived suggestions.
- After fix: **26 passed**, three files: `server/tests/task-item-routes.test.ts` (11), `task-item-inventory.test.ts` (10), `task-item-initialization.test.ts` (5).
- The initializer suite uses the installed Firestore SDK and replaces initialization/final RPC sinks. It inspects the actual single commit's `currentDocument: {exists:false}`, exercises numeric and string already-exists codes, retains a winning photo/asset record, and distinguishes unknown write failure and absent conflict readback. This proves SDK request shape, not live datastore behavior.
- `npm run check`, the required Graphify refresh and `git diff --check` passed. Local logs are `work/items-before.log`, `work/items-final.log`, `work/items-typecheck.log` and `work/items-graphify.log`.
- Test processes used the deny-egress preload with loopback permission for route listeners. No external attempt was recorded. No production requests, uploads, provider calls, sends or deployments occurred.

```bash
NODE_OPTIONS='--require /workspace/work/reliability-baseline/deny-egress.cjs' \
BLUEPRINT_TEST_EGRESS_LOG=/workspace/work/backend-contracts/work/items-egress.jsonl \
node node_modules/vitest/vitest.mjs run \
  server/tests/task-item-routes.test.ts \
  server/tests/task-item-inventory.test.ts \
  server/tests/task-item-initialization.test.ts --maxWorkers=1 --minWorkers=1
```

The initializer change preserves the existing first-read initialization contract and adds no transaction callback or new collection/index. The separate follow-up in `item-mutations.md` addresses the existing owner edit/remove read/modify/write race; the initializer proof above does not stand in for that transaction-retry evidence.

## Separate advisory: native capture link checks still recover retained work

Source inspection at WebApp integration `c58fac22a204412b8b9b604005c6fc82f9ddb473` found a distinction that must remain explicit in the campaign's status-read claims:

- Modern WebApp callers (`selfCaptureVideo.ts`, `SiteCaptureStart.tsx`, `SelfCaptureUpload.tsx`) use `GET /api/self-capture/uploads/:token/status`. That route sets `recoverLegacy:false` and does not perform the recovery described below.
- The current native Capture `Shared/Flow/CaptureLinkAPI.swift` still uses the root `GET /api/self-capture/uploads/:token` in `checkLink()`. `CaptureFlowModel` calls it during initial checking and retry/reconnect. This is an active native compatibility contract, not an unused historical URL.
- `legacyStatusRecoveryAllowed` refuses modern browser pending/stored receipt records and requires existing recording authorization, current derived-processing rights, retained video and original manifest consent. It never creates consent. `resumeStoredCapture` rechecks current authority after recovery.
- The retired `capturePrivacyScreen.ts` is a pure `unscreened/not_reviewed` result, not a model invocation. Recovery can update privacy evidence. App `finishClearedBundle` can materialize the retained completion files, record upload identity, enqueue coverage intent and publish the processing marker. It does not itself enqueue the `video_received` email; that notice belongs to the upload-completion path.
- `captureCoverageQueue.ts` can later execute `runAgentTask` through the outbox pump or automation scheduler. Model execution requires `BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED`, a valid current source/recording-consent/brief binding and the existing bounded job claim. `BLUEPRINT_SITE_VIDEO_EVIDENCE_APPLY` controls verdict promotion; it is not the cost gate. This inspection did not read deployed flag values.
- A processing marker can start extraction and downstream handoff. It is not itself a paid scene grant: `websiteSceneSponsorship.ts` separately checks configured policy, current rights, confirmed task, disclosure/provider terms and budget authority; `taskEvaluationSceneIntake.ts` retains the idempotent intake/provider-status contract.

The existing isolated `site-capture-bundle-routes.test.ts` case “a held privacy screen stores the capture but writes no marker, then finishes when it clears” is a safe reproduction of the root GET's mutation using fake storage/screen/coverage sinks. It is part of the previously executed 49-case suite; no native or live call was made during this advisory inspection.

Assessment: the root native GET is scoped retained-work recovery, but it cannot honestly be called read-only or guaranteed free of eventual model cost. Treat this as a native GET/recovery semantics limitation, separate from the repaired P1 inventory-loss race. Any decision to make every native link check read-only needs explicit recovery compatibility work; this patch does not silently strand already retained native captures by changing that contract.
