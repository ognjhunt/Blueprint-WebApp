# P0 review and P1 integration

Scope: F1–F3 review, integration with F4–F8 and thumbnails, and the user-requested
Pipeline executor dependency before merge. P2 is deferred. This directly supports
ADP partner admission, authorization and inspectable evaluation evidence. No new
ADP backlog identifier or day gate was supplied; the named blockers are the
onboarding audit's F1–F8, and the completion artifacts are WebApp PR #617 and
Pipeline PR #1981 with offline regression evidence.

## Review corrections

- One-time plan confirmation no longer enables recurring autonomous spending.
  Signed plans bind exact tasks, prices and execution digests. The actual $50
  minimum top-up is shown, only the shortfall is requested, and existing funds
  can be used directly.
- Every ledger writer serializes through a team transaction lock. The funded
  reservation and immutable execution record commit together. A retry cannot
  reset dispatch, overwrite an outcome, or buy the same preparation twice.
- Execution start and cancellation have mutually exclusive transaction claims.
  Expired holds cannot start. A same-owner retry cannot extend the hold forever.
  Results and settlements must name the admitted execution's owner and digest.
- Repeated result delivery preserves the original evidence and meters episodes
  once. Conflicting results are rejected. Cross-run “best” claims were removed;
  no protocol equivalence was established. Blocked and zero-episode outcomes are
  explicit and carry no invented metrics.
- Description proposals require an actual verbatim source substring. Model prose
  cannot replace the operator's summary. Non-visible footage is not observation
  evidence. Transaction retries protect operator confirmation and stronger evidence.
- Browser receipts survive reload. Site-owner claim links coexist with P1's single
  status poll, upload placement and persistent update commitments.

## Minimal design retained

Task discovery precedes robot setup. Every browse, selected-task and plan card has
an owner-approved thumbnail or a clearly labelled task illustration. Photos use
explicit publication permission, local cropping and metadata-stripped raster
re-encoding. Exact site identity remains outside the public feed; images cannot
promise anonymity. The product value is useful evaluation evidence and managed
site access, not hiding an address.

## Verification boundary

All execution tests use offline fixtures and mocked external edges. No live
Stripe payment, Firestore mutation, provider allocation, deployment or outbound
message was performed for this review. Source merge and actual runtime fulfillment
must be reported separately. Final test and merge receipts are recorded in the PRs.
