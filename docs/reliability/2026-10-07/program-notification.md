# Encrypted notification boundary regression

Independent joined review identified **NOTIFY-ENCRYPTED-001 / P2**: intake encrypts contact fields, but coverage-shortfall code cast the stored contact to plaintext types. The resulting email recipient was an object. A permissive fake sink concealed the defect; real `emailDomain` requires a string before dispatch.

The minimized test uses actual `encryptInboundRequestForStorage`, producer, coverage worker, publication/status and outbox with fake Firestore/model and a strict local mail sink. On baseline `eaebc3627590ca29c2a163bf1cbd8609217e9bec`, the encrypted case invokes the strict sink once with an object, records an unknown outcome, and shows `add_views` to the customer. Legacy plaintext and withdrawal neighbors pass. The unavailable-decryption neighbor also exposes the missing boundary. Final baseline **2/4**, candidate **4/4**; **33/33** focused checks pass, including existing encryption, consent and 20 joined worker checks. These four additional regressions add no credit to the program's 300-case floor. Canonical observations, exact source hashes and replay live in `program-notification.json`.

The repair uses the existing `decryptFieldValue` helper only for email and greeting immediately before enqueue. The canonical contact stays encrypted. Empty/non-string destination is not enqueued; unavailable decryption follows the existing protected warning and skips the notice, without establishing a durable notification retry. Consent/source fencing, outbox identity, duplicate dispatch behavior and customer status are preserved. No new fields, storage service, migration, provider call or customer send is introduced. Existing unknown outbox entries are not silently resent or rewritten: inspect and reconcile them through the existing safe recovery process. This patch does not establish a production incident or email-delivery receipt.

The initial baseline test incorrectly inspected stale copied fake DB rows and omitted brief confirmation. That harness issue was corrected without a runtime change; initial output remains retained and only `baseline-final` supplies the scored evidence. No acceptance threshold changed.

```bash
RELIABILITY_NOTIFICATION_OUTPUT=output/reliability-program/notification/replay npx vitest run server/tests/reliability-encrypted-notification.test.ts --maxWorkers=1
npm run check
```

No credentials, footage, paid provider or inbox are required. The fixture master key is a deterministic local test key. Raw results remain ignored under `output/reliability-program/notification/`; observations exclude addresses, ciphertext and signed links. Fresh typecheck passed. Independent review approved the exact diff and separately replayed all four strict regressions. Integration checks, combined Graphify refresh, merge and deployed verification remain coordinator gates.
