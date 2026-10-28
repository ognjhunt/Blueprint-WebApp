# Same-job walkthrough updates

The owner can choose **Update walkthrough** on the existing private job page.
This creates a new, immutable capture under the same request, using the existing
`captureSupplements` records and signed upload tokens. It does not create a new
job, change the original bytes, or require another intake form. Film-only links
cannot issue an update; an issued update token may upload only its bound source.
Live recording permission is checked on every write and publication.

Record the complete job cycle and include the missing view in the updated
walkthrough. The retained lineage is record continuity, not a registered fusion
of separate camera sessions. New repair records explicitly require a complete
walkthrough; coverage is checked against that recording rather than treating a
short additional clip as a reconstruction of the whole site. Earlier task item
photos remain useful as separate object observations.

Every finalized child binds its parent source identity and original job through
`website_capture_continuation.v1`. Browser identities bind exact Storage video
and manifest generations plus the manifest content hash; they do not claim a
SHA-256 of unread video bytes. An original upload that was retained but never
processed has an explicit `retained_unprocessed` parent projection with no
completion generation. The current child still needs its own completed producer,
privacy clearance and exact marker proof.

Successful publication selects `inboundRequests.active_capture_id`. Current job
status and assessment follow that revision. Existing source-bound outputs stay
stored; a different capture does not inherit their current applicability.
Fresh task-context/preparation reads of a superseded capture return
`website_run_capture_superseded`. Original owner/rights observations remain
available for read-only closeout and resource cleanup. A concurrent update may
not replace a newer selected sibling.

A verified child assessment can reuse the retained preparation allowance only
while its source-independent task context, rights and provider policy still
match. The existing caps, expiry and reservations do not reset. A different job
instruction cannot inherit an earlier per-task provider authorization.

Verification uses fake Storage/Firestore route tests, immutable original-byte
comparisons, token replay, current-source selection, held-source recovery,
foreign-job and tampered-source refusals, child sponsorship caps and expiry,
client update navigation, and the Pipeline's signed owner-observation decoder.
These checks do not establish a live reconstruction or a robot's capability.
