# Identity/KYC & Background-Check Provider Decision Record (R033)

**Status: DECISION SCAFFOLD — awaiting `blueprint-cto` sign-off.**
This document is the engineering scaffold for the audit finding *"No identity/KYC
or background-check provider decision."* It provides the options analysis, a
recommendation grounded in the current stack, the integration plan, and the
exact gate artifacts each decision must produce. The **selection + contract +
live integration is a human/business decision** and is NOT satisfied by this
document alone. The paid-marketplace launch gate's `identity_kyc_provider_decision`
and `background_check_provider_decision` checks remain open until the sign-off +
artifacts below exist.

Today only Stripe Express onboarding creates connected accounts
(`server/.../stripeConnectAccounts.ts`, type `express`, country US); there is no
identity verification beyond Stripe's own Connect requirements and no
background-check path for physical site access.

## Why this is needed for the beta

- **Payout fraud / money-movement:** capturers receive real payouts; without
  identity verification a bad actor can create fake payout accounts.
- **Physical site access:** capturers enter third-party industrial sites
  (warehouses/factories). Site operators will expect screened personnel;
  background checks are table stakes for on-site industrial access.

## Option analysis

### Identity / KYC
| Provider | Fit with stack | Notes |
|---|---|---|
| **Stripe Identity (recommended)** | Native — Stripe is already primary for payments/Connect | Document + selfie verification, US-ready, one vendor/one dashboard, webhooks share the existing Stripe integration surface. Lowest new-vendor surface. |
| Persona | Neutral | Flexible flows, more configuration; new vendor + new webhooks. |
| Onfido | Neutral | Strong doc verification; new vendor. |

**Recommendation:** **Stripe Identity** — it reinforces a service already in use
(CLAUDE.md: keep the current Stripe stack primary), shares auth/webhook plumbing,
and avoids introducing a new primary vendor.

### Background checks (physical site access)
| Provider | Fit | Notes |
|---|---|---|
| **Checkr (recommended)** | New vendor, but the category standard | API-first, US coverage, criminal + identity checks suited to on-site access; well-documented webhooks. |
| Sterling | New vendor | Enterprise-grade; heavier onboarding. |

**Recommendation:** **Checkr** for the background-check lane, gated to capturers
who accept assigned on-site industrial jobs (not required for remote/open
capture). Keep it OFF the critical path for non-industrial captures.

## Integration plan (once signed off)

1. **Stripe Identity:** add a verification session on capturer onboarding before
   first payout eligibility; consume the `identity.verification_session.verified`
   webhook in the existing Stripe webhook handler; store `identity_verified` +
   timestamp on the capturer record; gate payout eligibility on it.
2. **Checkr:** trigger a background check when a capturer accepts their first
   on-site industrial job; consume the report webhook; store
   `background_check_status` + report id; gate on-site job assignment on `clear`.
3. **Secrets:** provider keys via the existing secret-management path with a
   documented rotation owner (ties to the secrets-rotation gap).
4. **Privacy:** identity + background data are sensitive PII — retention +
   deletion must be covered by the DPA/data-retention work; do not store raw
   documents, only verification status + provider reference ids.

## Gate artifacts this decision must produce (the human deliverables)

- `identity_kyc_provider_decision`: signed record naming the provider (Stripe
  Identity), owner, contract/DPA reference, and go-live date.
- `background_check_provider_decision`: signed record naming the provider
  (Checkr), scope (on-site industrial capturers), owner, contract reference.
- Evidence of one successful end-to-end verification (test identity) and one
  background-check dry run in the provider sandbox.

## Remaining human/infra action (blocks the gate)

- [ ] `blueprint-cto` approves the provider selections above (or overrides).
- [ ] Contracts/DPAs executed with the chosen providers.
- [ ] Integration built + sandbox evidence attached.
- [ ] Gate re-run so `identity_kyc_provider_decision` /
      `background_check_provider_decision` flip to satisfied.
