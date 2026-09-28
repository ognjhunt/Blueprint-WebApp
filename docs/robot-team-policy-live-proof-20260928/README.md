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
- `https-transport.json`: the deployed Pipeline queried a separate, authenticated
  HTTPS policy with synthetic approved observations and validated its actions.
- `candidate-submission.json`: production owner authentication and durable
  admission of a private CPU container contract. This grants no execution or
  provider authority.
- `skill-intent.json`: production trace write/read against a frozen synthetic
  task; submitted outcome injection rejected, zero motor-action evidence.
- `historical-result-download.json`: a retained completed development evaluation
  was restored from a digest-verified archive and delivered through the live
  WebApp ticket path. That existing result is intentionally unlisted-public;
  it proves delivery, not private access or execution of this new policy.

Live private-credential upload exposed a KMS serialization defect:
`encrypted_credential.dekIv` and `dekAuthTag` were written as undefined even
though KMS does not produce those AES-wrapping fields. Firestore rejected the
record. Both encrypted field constructors now omit absent optional fields;
local AES wrapping still retains them.

Pending: actual production credential/outbox/sandbox qualification, a configured
trusted native simulator and qualified task offer, execution of a newly
submitted policy, independent outcome, private result delivery and cleanup.
The production planner returned no eligible tasks; no supply, qualification,
spend authority or completed task is invented by the synthetic admission fixture.

Pipeline source deployed: `16d8551b413fe1a65fe70b3f77ad73ea0b42b287`.
WebApp capability merge: `53e206ce51b0e32fc75003c21fbffabf8295216c`;
subsequent production main also contains it. Runtime identities must be checked
again before reporting release closeout.
