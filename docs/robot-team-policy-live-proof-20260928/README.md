# Live robot-team integration evidence, 2026-09-28

Owner: Nijel Hunt. ADP-011/day 7 admission; ADP-050/day 28 execution.

The owner restored live proof runs to the capability scope. These receipts
record actual production requests and isolated inference. They do not describe
an end-to-end completed evaluation of a newly submitted policy.

- `private-model-upload.json`: production account-bound upload, retained object
  generation and SHA-256, authenticated readback, anonymous access denied.
- `isolated-model-inference.json`: that uploaded ONNX model built into a pinned
  private image and actually returned validated actions inside a dedicated,
  no-mount runsc VM. The policy container was removed afterward.
- `https-policy-teardown.json`: the temporary free HTTPS service was removed,
  Render readback returned 404, and anonymous policy calls were rejected.
- `https-transport.json`: the deployed Pipeline queried a separate, authenticated
  HTTPS policy with synthetic approved observations and validated its actions.
- `candidate-submission.json`: production owner authentication and durable
  admission of a private CPU container contract. This grants no execution or
  provider authority.
- `skill-intent.json`: production trace write/read against a frozen synthetic
  task; submitted outcome injection rejected, zero motor-action evidence.
- `production-private-access-proof.json`: candidate and trace reads allow the
  owner (200), deny another owner (403), and deny anonymous access (401).
- `production-runtime-registration.json`: all three additional interfaces are
  accepted by the real team checkpoint API; registration does not prove execution.
- `production-model-plan-summary.json`: authenticated live planning selected
  zero tasks and refused execution preparation; no spending was committed.
- `historical-result-download.json`: a retained completed development evaluation
  was restored from a digest-verified archive and delivered through the live
  WebApp ticket path. That existing result is intentionally unlisted-public;
  it proves delivery, not private access or execution of this new policy.

Live private-credential upload exposed a KMS serialization defect:
`encrypted_credential.dekIv` and `dekAuthTag` were written as undefined even
though KMS does not produce those AES-wrapping fields. Firestore rejected the
record. Both encrypted field constructors now omit absent optional fields;
local AES wrapping still retains them. The repaired constructor successfully
persisted and decrypted a live production KMS/Firestore record, then removed
the temporary fixture (`kms-firestore-replay.json`). This operator-side replay
was followed by a successful production WebApp credential upload (201) with
KMS encryption and no plaintext credential fields
(`production-registry-lease-creation.json`).

Production outbox and sandbox qualification passed. The Render worker forwarded
the exact owned candidate, and Pipeline retained its admission. The dedicated
worker claimed the production KMS-bound single-use lease, pulled and verified
the private policy image, passed nine network-denial probes and synthetic
conformance, then removed both containers, policy image bytes and credential
ciphertext. A second claim returned 409. The worker used an operator-owned
development boot key and was invoked directly; automated native task execution
was not exercised. The separate Blueprint proxy bootstrap credential was
removed before claiming the customer lease. See
`production-outbox-dispatch-proof.json`, `production-container-proof-summary.json`
and `production-proxy-bootstrap-cleanup.json`.

The first credential attempt was stopped after intake restart/backoff, and its
unused ciphertext was removed (`first-attempt-cleanup.json`). The fresh owned
candidate and lease are retained separately.

Both temporary execution resources were deleted: the free HTTPS service and the
dedicated Lima VM (`https-policy-teardown.json`, `dedicated-worker-teardown.json`).
Private model uploads and immutable registry artifacts remain retained.

Pending: a configured
trusted native simulator and qualified task offer, execution of a newly
submitted policy, independent outcome and private completed-result delivery.
The production planner returned no eligible tasks; no supply, qualification,
spend authority or completed task is invented by the synthetic admission fixture.

Pipeline capability merge: `16d8551b413fe1a65fe70b3f77ad73ea0b42b287`;
confirmed deployed descendant: `16c128b7e03cc8dfce43ed2cedcc415ee3975c4d`.
WebApp capability merge: `53e206ce51b0e32fc75003c21fbffabf8295216c`;
the WebApp and worker both ran `2c3dafd06a86d6fa705b6fab7534d25bfbaa090e`
after its green CI-gated deployment (`production-web-release-verification.json`).
These are observed release identities, not an assertion that no later release
can supersede them.
