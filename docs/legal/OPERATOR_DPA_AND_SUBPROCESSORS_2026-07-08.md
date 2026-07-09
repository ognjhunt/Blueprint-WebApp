# Operator Data Processing Terms, Subprocessor List & Access-Audit (R004)

**Status: LEGAL SCAFFOLD — awaiting counsel review + execution.**
This document is the engineering/ops scaffold for the audit P0 *"Operator DPA /
subprocessor list / access-audit terms and legal-EHS consent sign-off are
unsigned."* It provides the concrete, stack-grounded content the paid-marketplace
launch gate expects for evidence id **`operator_dpa_data_processing_terms`**
(retention policy + subprocessor list + access-audit terms for delivered packages
and hosted review access). **It is not a substitute for executed, counsel-reviewed
terms** — the gate remains open until the sign-off in the last section exists.

Stack is the approved primary set (see repo CLAUDE.md): Firebase/Firestore/Cloud
Storage, Stripe, Render, Redis, Notion, Paperclip, plus model/GPU providers.

## 1. Parties & roles

- **Blueprint** — processor/controller of capture evidence and buyer artifacts,
  depending on flow (capture supply vs. buyer delivery).
- **Site operator** — controller of the physical site and, where applicable, of
  worker personal data captured on site. The DPA governs Blueprint's processing
  of site-operator data and of personal data incidental to on-site capture.
- **Capturer** — supplier of capture evidence; separate capturer terms apply.
- **Robot-team buyer** — recipient of licensed Task Evaluation Runs / Post-Training
  Data Packages under the buyer license + this DPA's downstream-access terms.

## 2. Subprocessor list (current stack — keep in sync with `.env.example`)

| Subprocessor | Purpose | Data categories | Region |
|---|---|---|---|
| Google Firebase / Firestore | Auth, app state, control-plane records | account, request, entitlement, capture metadata | US (TODO confirm) |
| Google Cloud Storage | Raw capture bundles + delivered package artifacts | video/frames/depth, delivered packages | US (TODO confirm) |
| Stripe (Payments + Connect + Identity) | Buyer payment, capturer payout, KYC | payment, payout, identity verification | US/global |
| Render | Web app + API hosting | request/response, logs | US (TODO confirm) |
| Redis | Queue/cache, hosted-session state | ephemeral session/queue data | US (TODO confirm) |
| Notion | Internal ops docs/workflows | operational metadata (no buyer PII by policy) | US |
| GPU providers (RunPod / Vast / Lambda / DigitalOcean) | Eval/render compute | derived frames/artifacts during processing | US (TODO confirm per provider) |
| LLM providers (Gemini / OpenAI) | Capture review, enrichment, VLM labeling | frames/text sent for inference | US/global |
| Checkr (pending R033) | Background checks (on-site capturers) | identity + background report | US |

**Action:** confirm each region, sign each subprocessor's own DPA, and publish
this list at a public `/subprocessors` URL with a change-notification mechanism.

## 3. Retention policy (must match enforced code)

- Raw capture bundles: retain for `<TODO N>` months, then purge; a consent
  revocation triggers takedown (enforced: pipeline takedown notice → webapp
  `consentRevocationTakedown` flips entitlements to revoked, R027/R023).
- Delivered packages: retained per buyer license term; access is revocable
  (signed-URL mint refuses revoked entitlements, R027).
- Derived/generated artifacts + hosted-session state: `<TODO>` retention; must be
  reachable by the takedown drill (R049).
- Backups: `<TODO>` retention + a documented deletion path into backups (audit gap
  — see backup/DR item).

## 4. Access-audit terms (delivered packages + hosted review)

- Every buyer artifact signed-URL mint is entitlement-checked and logged
  (route-level; R027 adds a revoked-refusal audit line). **Action:** ship a
  queryable access-audit log (who accessed which package, when) and a retention
  for that log.
- Hosted-review access is entitlement-scoped; per-session isolation is a known
  gap to tighten before granting cross-team hosted access.

## 5. Sub-processor & access change control

- Notify site operators of new subprocessors `<TODO N>` days before use.
- Buyers lose access when consent/revocation/payment state changes (enforced via
  entitlement `access_state`).

## 6. Remaining human/legal action (blocks the gate)

- [ ] Counsel reviews + finalizes DPA/data-processing terms from this scaffold.
- [ ] Each subprocessor's own DPA executed; regions confirmed; `/subprocessors`
      page published.
- [ ] Retention `N` values decided and encoded (ties to storage-lifecycle work).
- [ ] Access-audit log shipped + retention set.
- [ ] Operator counter-signs; store the executed artifact and flip the gate's
      `operator_dpa_data_processing_terms` evidence to satisfied.
