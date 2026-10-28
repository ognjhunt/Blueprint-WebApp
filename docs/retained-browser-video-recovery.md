# Recover a saved video without a customer return visit

Once the original recording and its receipt are retained, a failed server probe, manifest write
or completion-marker write is Blueprint's work. The existing capture-outbox
worker resumes the exact retained generation even when the browser and HTTP
request are gone. Upload completion and worker recovery share the same manifest,
privacy-decision and publication implementation; the worker does not run a
second upload pipeline.

The default upload and return pages say the recording is saved and the customer
can leave. Manual retry remains inside closed optional processing details. A
current permission hold remains visible. Reconstruction gaps and optional
walkthrough updates do not become automatic requests to film again.

The worker uses the existing five-minute outbox cadence, its explicit opt-out,
upload reservations, source-bound privacy receipts and rotating scan cursors.
Each pass admits at most one stored source and one held publication. An
unreadable source cannot starve later work or publication recovery. No timer,
service, model call, spending authority or public sharing is added.

Recovery rechecks current recording authority, the original manifest consent,
immutable source identity and selected recording. A newer recording, withdrawn
permission, permanently unreadable source or another uploader's reservation is
preserved. Publication checks current rights and the selected original in the
same transaction as the advisory intent. Probe-runtime availability is checked
before downloading; a stalled source read times out and closes its stream.

Validation covers closed-HTTP recovery, marker-only recovery, both queue kinds
making progress, no second video generation or probe, current authority and
source selection, reservation ownership, bounded download and the scheduler's
existing disable flag. The nine impacted server suites pass 192 cases; the two
customer-page suites pass 164 and the bounded-outcome suite passes eight.
TypeScript, Graphify and whitespace checks pass.
The tests use local HTTP, fake storage/Firestore and scripted transport seams;
they do not establish live reconstruction or a scored result.

This follow-up stacks on the independent quiet-customer change, WebApp #1137.
It does not require optional extra recordings (WebApp #1136 / Pipeline #3037).
Deployment and a supported real upload-to-result journey remain release-owner
acceptance work. Existing founder holds and stopped worker settings stay in
force.
