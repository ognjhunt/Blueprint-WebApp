# Intake recovery slice

The description-first form previously retained draft fields, create request identity,
retry credential, and acknowledged private job link only in React memory. A lost
create response followed by reload could create another intake; a browser closed
while uploading lost its route back to the already saved job.

The repair keeps a private device-local record for 24 hours from draft creation.
Expired records are rejected and removed on the next visit, rather than promising
background deletion. Signed-in accounts use separate keys, wait for auth resolution
before restoration, and clear the prior account's record on account switch/logout.
Anonymous recovery relies on possession of the browser profile; it does not provide
identity isolation on a shared device. Both draft and saved-job views provide an
explicit clear action. Clearing device recovery does not cancel/delete server work.

An uncertain create retries the exact original request. Protected submission and
acknowledgement snapshots prevent autosaves from a pre-mounted tab erasing recovery.
The submit action adopts the latest same-account receipt or exact submitted body.
Modern browsers with Web Locks serialize the small local freeze across tabs;
no network operation holds that lock. Browsers without Web Locks retain server
idempotency and sequential/reload recovery, but truly simultaneous differing-answer
submissions across tabs are outside the verified browser guarantee. A confirmed validation
rejection allows corrections with the same identity. Replayed saves cannot upload
newly selected footage under the original description/authority. The saved recovery
route is written before video transfer; return checks the storage receipt before
claiming video receipt or processing. File bytes and checked consent controls are
never saved in localStorage. Inferred country and manual corrections retain their
separate semantics after return.

Supported recovery is same-job receipt reconciliation and original-file reselection
through the existing job page. The multipart transport does not support byte-range
resume. Storage-disabled browsers receive an explicit notice that draft restoration
is unavailable. This slice does not establish live-provider completion or video
perception quality.

Scoped client checks:

```bash
npx vitest run client/tests/components/SiteCaptureStart.test.tsx client/tests/lib/siteCaptureDraft.test.ts client/tests/lib/selfCaptureVideo.test.ts
npx vitest run client/tests/contexts/AuthProviderFirebaseLoad.test.tsx client/tests/contexts/GoogleSignInGesture.test.tsx
```

The frontend browser regression starts the normal form and explicitly intercepts
API transport/receipts; it checks reload after a lost response and actual Chromium
process restart during upload. It creates a synthetic video with local `ffmpeg`;
no customer video, provider dispatch, or notification delivery is involved:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test e2e/site-intake-recovery.spec.ts --config=playwright.intake.config.ts --workers=1 --repeat-each=3
```

The separate backend spec uses the scoped reliability launcher, real application
handlers, and disposable Firebase emulators on loopback ports 8080 and 9199 with
project `demo-blueprint-reliability`. This is emulator evidence, not production
storage or provider evidence. Notifications are durable outbox rows without delivery.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test e2e/site-intake-backend-reliability.spec.ts --config=playwright.intake-backend.config.ts --workers=1
```

Private program results retain the baseline/candidate receipts and semantic catalog.
Release and readiness decisions require independent review, integrated required
checks, deployed-version receipts, and broader joined-path/reference evidence.
