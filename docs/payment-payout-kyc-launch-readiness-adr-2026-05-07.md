# ADR: Payment, Payout, KYC, and Background-Check Launch Readiness

Date: 2026-05-07

## Decision

Keep Stripe as Blueprint's near-term baseline for buyer checkout and capturer payout readiness. Do not introduce Branch, Payfare, Adyen, Hyperwallet, Persona, Stripe Identity, or Checkr as a new production dependency in this repo-safe pass.

The implementation must describe Stripe as the current provider, not as a universal live-readiness claim. Live payout execution remains human-gated and disabled unless a finance owner explicitly sets `BLUEPRINT_LIVE_PAYOUT_EXECUTION_ENABLED` after verifying live Stripe account state, treasury balance, webhook reconciliation, payout exception monitoring, finance review ownership, and Stripe 1099 tax-reporting readiness.

## Architecture Lanes

Public gig platforms separate these concerns, and Blueprint should too:

- Buyer checkout: customer payment authorization, checkout, fulfillment, refunds/disputes.
- Capturer payout, KYC, and taxes: connected-account onboarding, requirements, payout methods, tax/KYC state, W-9/TIN/address completion, and 1099 filing readiness.
- Worker wallet or instant cashout: eligibility, bank/debit-card support, velocity limits, delays, fees, exception handling.
- Identity verification: government ID, selfie/device checks, account security, duplicate-account controls.
- Background checks: separate screening provider, legal consent, adverse-action/appeal process, ongoing checks where required.

Stripe Connect covers the near-term buyer checkout and capturer payout/KYC lane well enough for launch if live evidence exists. It does not prove background-check readiness. Stripe's current public changelog shows the `2026-02-25.clover` release, including Connect and payout-related updates, while this WebApp intentionally remains pinned to `2024-12-18.acacia` until a separate Stripe API upgrade pass reviews SDK/types and route behavior.

## Research Notes

- Stripe Connect supports marketplace onboarding, connected accounts, payments, and payouts, including Instant Payouts when account/country/external-account eligibility is met.
- Uber, DoorDash, Lyft, Instacart, Shipt, and Grubhub publish separate worker payout or cashout surfaces from background/identity screening and buyer payment surfaces.
- Taskrabbit requires a Tasker bank account and background/ID check posture, and separately requires client payments through the platform.
- None of this justifies Blueprint claiming instant pay, payout timing, broader banking, KYC completion, or background-check readiness from a backend URL, a Stripe publishable key, or mocked contract tests.

## Current Blueprint Posture

- Buyer checkout: Stripe Checkout/Connect contract tests are valid contract evidence only. Live buyer payment readiness still needs a live checkout/payment-intent artifact and webhook reconciliation.
- Capturer payout: Stripe is the current provider. `/v1/stripe/account` must report `provider_state_checked=true`, `provider_mode=live`, `live_provider_ready=true`, `payouts_enabled=true`, and no blocking requirements before launch copy can imply provider readiness.
- Live payout execution: fail-closed behind `BLUEPRINT_LIVE_PAYOUT_EXECUTION_ENABLED`
  and additionally requires `BLUEPRINT_FINANCE_REVIEW_OWNER` plus
  `BLUEPRINT_FINANCE_REVIEW_QUEUE_URI`, plus
  `BLUEPRINT_TAX_REPORTING_1099_RUNBOOK_URI`; this repo-safe pass does not
  enable it or name the human owner.
- Tax reporting: Stripe's 1099 product is the near-term owner. New US creator
  Connect accounts request `tax_reporting_us_1099_misc` for the 1099-NEC lane.
  Creator payouts stay blocked unless that capability is active and Stripe
  reports no tax identity/TIN/address requirements due or pending verification.
- iOS: payout UX now requires backend URL plus explicit `BLUEPRINT_PAYOUT_PROVIDER_READY=YES`.
- Android: external alpha stays honest; provider readiness defaults false and native payout onboarding remains off-device.
- KYC: Stripe Connect onboarding is the only current near-term KYC/account-requirements path. Persona, Stripe Identity, and Checkr are not integrated.
- Background checks: no integrated provider exists; any background-check claim is human-required until provider/account/env proof and operating policy exist.

## Human-Required Evidence Before Live Claims

- Live Stripe account state for the capturer/provider account.
- Live buyer checkout or PaymentIntent success plus webhook reconciliation.
- Live connected-account readiness showing no blocking Stripe requirements.
- Payout exception monitor for payout failures, canceled payouts, disbursement failures, and overdue finance reviews.
- Named human finance owner and review route before enabling payout execution:
  set `BLUEPRINT_FINANCE_REVIEW_OWNER` and `BLUEPRINT_FINANCE_REVIEW_QUEUE_URI`
  only after the actual owner and watched queue exist.
- Stripe 1099 tax-reporting readiness before creator payouts:
  `tax_reporting_us_1099_misc=active`, W-9/TIN/address requirements complete,
  and `BLUEPRINT_TAX_REPORTING_1099_RUNBOOK_URI` pointing at the beta 1099-NEC
  filing/issuance checklist.
- Identity/KYC provider decision: Stripe Connect only, or a deliberate addition of Persona/Stripe Identity/etc.
- Background-check decision: no Checkr/background provider claim until account, consent, adjudication, and appeal policy are in place.

## Sources

- Stripe changelog: https://docs.stripe.com/changelog/clover
- Stripe Connect overview: https://docs.stripe.com/connect/how-connect-works
- Stripe Connect Instant Payouts: https://docs.stripe.com/connect/instant-payouts
- Stripe Connect US tax reporting: https://docs.stripe.com/connect/tax-reporting
- Stripe Connect 1099 tax reporting setup: https://docs.stripe.com/connect/get-started-tax-reporting
- Stripe tax-reporting information requirements: https://docs.stripe.com/connect/required-verification-information-taxes
- Uber Instant Pay: https://www.uber.com/us/en/drive/driver-app/instant-pay/
- Uber screening: https://help.uber.com/riders/article/what-is-the-screening-process?nodeId=2843c9f3-1b01-4da3-8e42-572cdcd878ca
- DoorDash pay: https://dasher.doordash.com/en-us/about/pay
- DoorDash identity/background posture: https://about.doordash.com/en-us/news/an-update-on-our-work-to-build-trust-on-our-platform
- Lyft Express Pay: https://help.lyft.com/hc/en-us/all/articles/115012923167-Express-Pay
- Lyft driver requirements: https://www.lyft.com/driver-application-requirements
- Instacart payment methods: https://docs.instacart.com/storefront/learn_about_your_storefront/payments/payment_methods/
- Instacart integrity/identity/background posture: https://www.instacart.com/company/shopper-community/ensuring-the-integrity-of-the-instacart-platform
- Taskrabbit Tasker requirements: https://support.taskrabbit.com/hc/en-us/articles/46260520394651-What-s-Required-to-Become-a-Tasker
- Taskrabbit client payments: https://support.taskrabbit.com/hc/en-gb/articles/46260427597595-How-Do-I-Pay-My-Tasker
- Shipt shopper pay: https://help.shipt.com/how-do-shoppers-get-paid
- Shipt background check: https://help.shipt.com/en_US/applying-to-be-a-shopper/255300-what-are-the-details-regarding-shipt-s-background-check
- Grubhub driver requirements: https://driver-support.grubhub.com/hc/en-us/articles/360029692891-What-are-the-requirements-for-partnering-with-Grubhub
- Grubhub Instant Cash Out: https://driver-support.grubhub.com/hc/en-us/articles/360035571732-How-can-I-become-eligible-for-Instant-Cash-Out
