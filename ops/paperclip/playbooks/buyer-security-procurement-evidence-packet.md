# Blueprint Buyer Security And Procurement Evidence Packet

Status: reusable evidence packet, repo-grounded draft.
Last repo evidence scan: 2026-05-28.
Audience: buyer security, architecture, vendor-risk, and procurement reviewers.
Owner: `security-procurement-agent`, with `blueprint-cto`, `solutions-engineering-agent`, and `rights-provenance-agent` as source owners when evidence is missing.

This packet is assembled from current `Blueprint-WebApp` docs and code only. It is not a SOC 2 report, certification assertion, penetration-test report, DPA, legal opinion, privacy assessment, or live buyer/customer proof. It should be sent or adapted only with source citations intact and with missing evidence left visible.

## Buyer-Facing Summary

Blueprint is a capture-first, site-specific world-model product surface. `Blueprint-WebApp` exposes buyer intake, licensing, hosted-session access, ops workflows, and request-specific proof for downstream outputs from `BlueprintCapture` and `BlueprintCapturePipeline`. The current security/procurement posture is strongest where the repo already has code-backed controls: Firebase-authenticated API access, admin/ops role checks, hosted-session entitlement gates, HMAC-scoped hosted UI bootstrap tokens, field-level encryption for inbound request contact/request fields, Firestore as the active datastore, Render deployment configuration, optional Redis live-session state, and explicit rights/provenance boundaries.

Blueprint should not claim a buyer-specific site is rights-cleared, fulfilled, provider-executed, live-hosted, production-deployed, paid, or commercially unrestricted unless the exact request has proof from the owning system.

## Source Index

| Area | Supported Evidence | Source Files |
|---|---|---|
| Source-of-truth boundaries | Repo doctrine and current code are the evidence base; live systems own their own operational facts. | `docs/architecture/source-of-truth-map.md:7-24`, `docs/architecture/source-of-truth-map.md:69-82` |
| Product/data posture | Blueprint centers capture provenance, hosted access, and rights/privacy controls. | `PLATFORM_CONTEXT.md:23-31`, `PLATFORM_CONTEXT.md:55-61`, `WORLD_MODEL_STRATEGY_CONTEXT.md:74-86` |
| Authenticated API access | Protected routes require Firebase bearer token verification; many write/admin routes also use CSRF protection. | `server/middleware/verifyFirebaseToken.ts:5-29`, `server/routes.ts:78-183` |
| Admin/ops role checks | Admin/ops roles are derived from Firebase token claims and the `users` Firestore document. | `server/utils/access-control.ts:57-139` |
| Hosted-session gate | Protected hosted-session creation requires robot-team/admin access and a provisioned entitlement unless admin/session-owner exceptions apply. | `server/routes/site-world-sessions.ts:176-272`, `server/routes/site-world-sessions.ts:2756-2842` |
| Hosted-session UI token | Presentation UI bootstrap/proxy uses an HMAC-signed, expiring session token and an HTTP-only cookie scoped to the session UI path. | `server/utils/hosted-session-ui-auth.ts:27-63`, `server/routes/site-world-sessions.ts:1886-1901`, `server/routes/site-world-sessions.ts:2042-2067` |
| Hosted-session live state | Live hosted-session state prefers Redis with a configured TTL, falls back to memory, and mirrors session records to Firestore. | `server/utils/hosted-session-live-store.ts:7-16`, `server/utils/hosted-session-live-store.ts:87-122`, `server/routes/site-world-sessions.ts:296-350`, `DEPLOYMENT.md:398-403` |
| Field encryption | Inbound request contact and request fields are encrypted before Firestore persistence. AES-256-GCM is used, with data keys wrapped by Google KMS or a configured local master key. | `DEPLOYMENT.md:72-79`, `server/utils/field-encryption.ts:15-18`, `server/utils/field-encryption.ts:68-106`, `server/utils/field-encryption.ts:143-165`, `server/utils/field-encryption.ts:310-388`, `server/routes/inbound-request.ts:1292-1300` |
| Field-encryption test evidence | Unit tests assert ciphertext storage for contact fields and selected request/display-capture fields. | `server/tests/field-encryption.test.ts:22-29`, `server/tests/field-encryption.test.ts:105-145` |
| Retention policy | Current Paperclip policy lists collection-level retention periods and requires human-reviewed deletion in Phase 1. | `ops/paperclip/DATA_RETENTION_POLICY.md:5-23`, `ops/paperclip/DATA_RETENTION_POLICY.md:25-32`, `ops/paperclip/DATA_RETENTION_POLICY.md:34-58` |
| Firestore schema reference | Firestore is schemaless; `inboundRequests` and related ops fields are documented as operational references. | `ops/paperclip/FIRESTORE_SCHEMA.md:1-4`, `ops/paperclip/FIRESTORE_SCHEMA.md:36-83` |
| Deployment | The documented build/runtime path is Vite client plus esbuild server, deployed as a Render web service with health check `/health/ready`; secrets belong in Render env, not `render.yaml`. | `DEPLOYMENT.md:3-48`, `render.yaml:1-10` |
| Rights/provenance boundaries | Raw capture/provenance and rights/privacy/consent metadata are authoritative; downstream outputs must not rewrite them. | `PLATFORM_CONTEXT.md:55-61`, `WORLD_MODEL_STRATEGY_CONTEXT.md:137-154` |
| Sample rights packet shape | Public sample artifacts demonstrate proof/rights packet shape and explicitly avoid customer-contract or commercial-clearance claims. | `client/public/samples/sample-rights-sheet.md:1-43`, `client/public/samples/sample-site-package-manifest.json:1-72` |
| Unsupported public claims | Public copy can be confident, but exact unsupported claims about rights, fulfillment, payments, provider execution, live hosted fulfillment, traction, or customer proof must be blocked or qualified. | `docs/architecture/public-display-ready-claims-matrix.md:9-23`, `docs/architecture/public-display-ready-claims-matrix.md:51-75` |

## Current Supported Answers

### Auth And Access Control

Blueprint uses Firebase identity for protected WebApp APIs. The Express middleware expects an `Authorization: Bearer <Firebase ID token>` header, verifies it through Firebase Admin, and rejects missing, invalid, expired, or unverified tokens. Protected marketplace entitlement, checkout, admin, hosted-session, upload, city-launch, AI, QR, creator, and Stripe account routes are wired through the token middleware, with CSRF protection on many browser-facing mutating routes.

Admin and ops access is role-based. The current role helper resolves roles from Firebase token claims and the `users` Firestore document, supporting `admin` and `ops` role checks. This supports admin/ops route gating, but it is not an enterprise SSO/SAML/SCIM claim.

### Hosted-Session Access

Hosted sessions are gated separately from public sample/demo material. For protected site-world launch, the route requires an authenticated user, then checks one of these access paths: admin, session owner, or a matching provisioned hosted-session entitlement. Non-admin users must have a user profile with `buyerType` equal to `robot_team` before hosted-session access can proceed.

Protected session creation also checks launch readiness before creating a session. Runtime/render/media/explorer/export endpoints call the same launch-access gate, and render/media/explorer-frame paths require entitlement when loading an existing protected session.

Presentation-demo UI access is further scoped by a short-lived HMAC token. The bootstrap route validates the token, sets an HTTP-only, same-site cookie scoped to that session UI proxy path, and rejects missing/invalid UI session tokens on HTTP and WebSocket proxy paths.

### Field Encryption And Data Handling

Inbound request persistence encrypts buyer contact fields and many request/detail fields before writing to Firestore. The encryption utility uses AES-256-GCM for field values. Data keys are wrapped either with Google KMS through `FIELD_ENCRYPTION_KMS_KEY_NAME` or with a 32-byte base64 local master key in `FIELD_ENCRYPTION_MASTER_KEY`.

The launch-critical deployment note says one of those field-encryption env vars is required and that `/api/inbound-request` can fail even when readiness otherwise looks healthy if neither is configured. Unit tests cover encrypted contact fields and selected request/display-capture metadata fields.

### Retention

The current repo evidence includes a Paperclip data retention policy for operational collections. It lists retention periods such as 12 months for `waitlistSubmissions`, 12 months from creation or 30 days after close for unconverted `inboundRequests`, 24 months from last resolution activity for `contactRequests`, and longer finance retention for payout records. Deletion is human-reviewed in Phase 1, not fully automated.

Hosted-session live state is separate. The live store prefers Redis when `REDIS_URL` is configured, falls back to in-process memory, and uses `BLUEPRINT_HOSTED_SESSION_LIVE_TTL_SECONDS` with a default 12-hour TTL for Redis live-session records. Firestore acts as an async trail/mirror for hosted sessions.

### Deployment And Runtime Topology

The repo deployment path is a Node Render web service. The documented build pipeline runs `npm ci`, typecheck/test/build gates, Vite client build, prerender/sitemap, and esbuild server bundling. `render.yaml` declares the Render service, Node runtime, starter plan, Oregon region, auto deploy, build command, start command, and `/health/ready` health check.

Secrets are expected to live in the Render service environment, not in `render.yaml`. The required runtime environment includes Firebase client config, Firebase Admin credentials, field-encryption config, Stripe config, pipeline sync/review token config, Redis when configured, and other optional operational integrations.

### Rights, Provenance, And Buyer Proof Boundaries

Blueprint's current product doctrine treats raw capture, timestamps, poses, device metadata, provenance, rights, privacy, and consent metadata as authoritative. Hosted-session artifacts and site-specific world-model packages are sellable downstream products, but they do not rewrite capture/provenance truth.

Buyer-facing proof can describe the workflow, packet shape, and request path. It must not imply that a specific buyer site is rights-cleared, commercially unrestricted, provider-executed, rank-fidelity-scored, package-access-open, or hosted-session-fulfilled unless the exact record has supporting proof from the system that owns that fact.

## Missing Evidence And Blockers

| Missing Evidence | Why It Matters | Current Answer |
|---|---|---|
| SOC 2, ISO 27001, or similar certification evidence | Buyers may ask for formal security attestations. | Not evidenced in repo; do not claim certification. Route to founder/security owner if a buyer requires it. |
| Independent penetration-test report or vulnerability-management evidence | Buyers may ask for recent external security testing. | Not evidenced in repo; do not state that external testing is complete. |
| Counsel-reviewed DPA, privacy addendum, or buyer legal terms | Procurement may require binding data processing terms. | Not evidenced in repo; legal/contract language is human-gated. |
| Verified production Render env/dashboard state | Repo docs define required env; they do not prove current live secret configuration. | Answer from docs only unless Render/provider dashboard evidence is explicitly supplied. |
| Buyer-specific rights clearance | Rights are request/site/use specific. | Default to `rights reviewed per request` unless exact rights/provenance evidence is attached. |
| Buyer-specific hosted-session fulfillment | Session availability depends on entitlement, runtime artifacts, launch readiness, and live state. | Say hosted review is confirmed per site/request; do not guarantee fulfillment from docs alone. |
| Production deletion execution logs | Policy documents retention and human-reviewed deletion; logs proving specific deletion batches were not inspected. | State that retention policy exists and deletion is human-reviewed in Phase 1; do not claim automated deletion completion. |
| Enterprise SSO/SAML/SCIM | Current evidence shows Firebase auth and role-based checks, not enterprise identity federation. | Do not claim SSO/SAML/SCIM support unless implemented and evidenced later. |
| Formal incident-response test evidence | The security policy names incident reporting, but a tested incident program was not verified here. | Do not claim tested incident-response maturity. |
| Live buyer/customer facts | The goal excludes live buyer facts. | Do not include buyer logos, production use, revenue, traction, or customer proof unless separately approved and evidenced. |

## Unsupported Claims To Block

- "Blueprint is SOC 2, ISO 27001, HIPAA, GDPR, or CCPA certified/compliant" unless formal reviewed evidence exists.
- "A penetration test has been completed" unless the report and scope are attached.
- "All buyer data can be deleted automatically on request" because current retention evidence requires human-reviewed deletion in Phase 1.
- "All captures are rights-cleared" because rights/privacy/consent are request-specific.
- "Package access is already open" unless Stripe/entitlement/package/rights evidence supports that exact buyer/request.
- Any wording that promises hosted sessions will be live unless runtime/session/entitlement/live-state evidence supports that exact site/request.
- "Provider execution is complete" unless provider/runtime artifacts or package manifests support that exact request.
- "Production secrets are configured" unless Render or the owning secret store has been verified.
- "Public samples are customer results" because sample artifacts are explicitly representative.

## Reusable DDQ Language

**Access control:** Blueprint protects WebApp hosted-session and admin APIs with Firebase-authenticated bearer tokens. Admin/ops role checks are resolved from token claims and Firestore user records. Hosted-session launch requires a robot-team account, admin access, session ownership, or a matching provisioned entitlement, depending on the route and session.

**Hosted-session isolation and runtime access:** Protected hosted sessions are request/session scoped. Runtime, render, media, explorer, and export routes re-check hosted-session access before serving protected assets. Presentation-demo UI access uses a short-lived HMAC token and an HTTP-only cookie scoped to the session UI proxy path. Public demo sessions are a separate demo path and must not be treated as protected buyer access.

**Encryption:** Inbound buyer request contact and request fields are encrypted before Firestore persistence using AES-256-GCM field encryption. The data key is wrapped by either Google KMS or a configured 32-byte base64 local master key. The repo includes unit tests that verify ciphertext storage for selected fields.

**Retention:** Blueprint has a repo-side retention policy for operational collections, with Phase 1 deletion requiring human review before hard deletion. Hosted-session live state has a Redis TTL when Redis is configured, with Firestore used as the session trail/mirror. Specific deletion or retention execution proof must be provided per request if a buyer requires audit evidence.

**Rights/provenance:** Blueprint treats raw capture metadata, provenance, and rights/privacy/consent metadata as authoritative. Package access, export rights, public proof, and hosted review remain request-specific and must be verified against the exact listing or buyer record.

**Deployment:** The repo documents a Render Node web service build/start path with `/health/ready` health check. Secrets are expected in the service environment, not in `render.yaml`. Repo docs alone do not prove the current live Render configuration.

## Security-Procurement Agent Use

1. Attach this packet to the buyer/procurement issue as the first evidence map.
2. For every buyer question, answer only from the cited source files or a fresh owner-provided artifact.
3. If a question asks for legal terms, certifications, pen tests, privacy interpretations, rights clearance, live buyer facts, provider dashboards, Notion mutation, or production dashboard proof, mark it missing or human-gated instead of filling the gap with generic reassurance.
4. Keep unsupported claims in the packet. Removing them makes the packet easier to misuse.
