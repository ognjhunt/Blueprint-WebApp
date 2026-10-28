# Saved video recovery during server measurement

Beta journey step: receive a site's video once, then recover processing inside the same job. Owner request, 2026-10-28: implement the upload-to-result simplification cuts.

This companion change builds on WebApp #1128, integrated through `fb72e098735291d6fbff8f5c67877da6889843cc`. That implementation removes browser decoding as an upload prerequisite and supports immutable same-job source corrections. Its ordinary whole-file route still probes the temporary file before saving the canonical original. A missing or unavailable probe runtime therefore asks a customer to send a potentially large video again. The combined source follows the owner's October 28 choice of one job-evaluation path, with the separate finalist tier removed.

The whole-file route now saves the original bytes and journals the exact returned Storage generation before probing. Its existing private receipt retains the original permission, task, owner identity and reception time. An incomplete draft has `media_probe_pending: true` and omits unknown measurements. That draft is never published to extraction.

Successful measurement enriches the same receipt under a transaction that compares both the original receipt and its current write reservation. The existing manifest/privacy/marker path then resumes. A probe outage leaves the receipt retryable against its exact stored generation. An unreadable stream stays retained, publishes no marker, and offers the existing same-job correction path. Cleanup and write-claim release finish before the response advertises an immediate retry. Multipart uploads retain their existing saved-parts recovery path.

This adds no provider, account, spend, consent, storage service or public contract. It uses #1128's existing pinned FFmpeg inspection, source lineage, private receipt, processing retry and permission checks. A saved unreadable file does not qualify a scene or authorize extraction. A source/lease/publication change refuses a stale measurement.

The owner page also projects the selected recording's preview. An older ready preview remains historical while its same-job update is processing or has no preview; it no longer appears as the new recording's result. Legacy jobs without a selected revision retain their existing projection. The Pipeline companion extends the existing preview queue, worker, download and retry scans to immutable source revisions and includes their job-scoped archives in the existing withdrawal plan.

Verification:

- `capture-link-at-submit.test.ts`, `browser-video-probe-receipt.test.ts`, `self-capture-media-metadata.test.ts`, `footage-after-saved-job-journey.test.ts`, `site-task-brief-status.test.ts`, `task-evaluation-launch-forward-worker.test.ts`, and `website-atlas-auto-preview.test.ts`: 199 tests passed after integrating the single-evaluation parent. These cover real FFmpeg metadata and real upload routes with synthetic files, retained unreadable bytes, immediate retry without reupload, same-job correction, immutable receipt enrichment, concurrent source/lease/publication refusal, legacy-link status, the lightweight forwarding worker and the current recording's preview.
- `npm run check`: passed.
- `site-capture-bundle-routes.test.ts`, `website-capture-binding.test.ts`, `self-capture-owner-withdrawal.test.ts`, `self-capture-manifest.test.ts`, and `website-capture-owner-observation.test.ts`: 116 tests passed, protecting native/browser conflicts, retained lineage, permission withdrawal, canonical manifest fields and owner readback.
- Required Graphify AST refresh: passed.

A local browser check of the earlier combined guest intake at 390 px showed the video/location/email flow with no password input, no horizontal overflow and no console errors. It submitted no form and used synthetic Firebase configuration. After integrating the single-evaluation parent, all 113 intake and recovery component tests passed. Recovery copy matches the existing complete-walkthrough update path; short-angle fusion with prior geometry remains outside this implementation.

The broader simplification consumer is Pipeline #3026. Its owner continues to own that pair's merge and rollout; this change is a reviewable addition to the WebApp upload slice. No live account, provider call, upload, production mutation or deployment was performed by these checks.
