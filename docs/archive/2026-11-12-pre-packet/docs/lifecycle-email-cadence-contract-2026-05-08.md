# Blueprint Lifecycle Email Cadence Audit and Contract

Date: 2026-05-08

## Audit Summary

Blueprint already had three useful pieces:

- Buyer post-purchase onboarding in `server/utils/buyer-onboarding.ts`, written to `onboarding_sequences` and routed through the human-gated support action policy.
- Buyer lifecycle and growth campaign drafting in `server/utils/growth-ops.ts`, routed through `action_ledger` with `GROWTH_CAMPAIGN_POLICY` and `LIFECYCLE_POLICY`.
- Paperclip agents that cleanly map to this work: `site-operator-partnership-agent`, `capturer-success-agent`, `robot-team-growth-agent`, `community-updates-agent`, and `growth-lead`.

The missing pieces were:

- no shared persona lifecycle contract for pre-entitlement site operators, capturers, and robot-team signups;
- no deterministic cadence worker connected to signup events;
- no local suppression ledger or public unsubscribe surface for commercial lifecycle emails;
- no explicit Paperclip instructions telling existing agents how to draft, skip, pause, and close lifecycle cadence work.

No new Paperclip agent is needed. Existing roles own the lifecycle cleanly.

## Research Inputs

External lifecycle research was used only to tune cadence mechanics; Blueprint doctrine remains primary.

- Userlist's onboarding template recommends focusing the onboarding sequence on the path to the activation moment, sending the first welcome messages broadly, and skipping later feature messages when users already used that feature: https://userlist.com/docs/campaign-templates/onboarding/
- Customer.io frames activation emails around a specific activation moment and one CTA that prompts the desired behavior: https://customer.io/learn/lifecycle-marketing/activation-email
- Userlist's behavior-triggered campaign guide emphasizes real customer properties/events instead of one-time imports: https://userlist.com/blog/behavior-email-campaign-triggers/
- Intercom's lifecycle guidance recommends triggering deeper-feature messages when the conditions are right, not only by elapsed time: https://www.intercom.com/blog/does-your-app-have-a-message-schedule/
- Userlist's 2026 frequency survey supports higher early frequency, then slower weekly/biweekly cadence based on engagement and value: https://userlist.com/blog/email-frequency-saas/
- FTC CAN-SPAM guidance requires a physical postal address and an opt-out mechanism that remains usable and is honored within 10 business days: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- SendGrid suppression docs confirm global suppressions prevent future sends to suppressed addresses: https://www.twilio.com/docs/sendgrid/api-reference/suppressions-global-suppressions/retrieve-all-global-suppressions
- Intercom subscription guidance reinforces category-level unsubscribes and preference clarity for non-essential communications: https://www.intercom.com/help/en/articles/5181083-manage-multiple-email-lists-with-granular-subscriptions

## Cadence Contract

All persona cadences live in `server/utils/lifecycle-cadence.ts` and enroll records in `lifecycle_email_cadences`.

| Persona | Activation Moment | Agent Owner | Sequence |
| --- | --- | --- | --- |
| Site operators | Site claim, access boundary, privacy/commercialization boundary, or operator reply | `site-operator-partnership-agent` | day 0, day 2, day 5, day 7, day 14, day 30 |
| Capturers | First capture/readiness step, first upload, QA pass, repeat capture | `capturer-success-agent` | day 0, day 2, day 5, day 7, day 14, day 30 |
| Robot teams | Exact-site request, proof path, hosted review start, entitlement | `robot-team-growth-agent` | day 0, day 2, day 5, day 7, day 14, day 30 |

Cadence rules:

- First week can be higher-touch, but it stops being daily.
- Later touches must be behavior-aware and lower frequency.
- Every message has one job and one CTA/question.
- If the activation action already happened, stale basics are skipped.
- If the recipient is suppressed, due steps are marked `suppressed` and no action ledger item is queued.
- Community updates are cross-audience, proof-led drafts owned by `community-updates-agent`; they are not a replacement for persona lifecycle emails.

## Worker and Evidence Flow

- Inbound robot-team and site-operator submissions call `createLifecycleCadenceForInboundRequest`.
- Waitlist submissions call `createLifecycleCadenceForWaitlistSubmission`; capturer roles enroll as capturer cadence, other waitlist users enroll as robot-team cadence.
- `runLifecycleCadenceWorker` is registered in `server/utils/opsAutomationScheduler.ts` under `BLUEPRINT_LIFECYCLE_CADENCE_ENABLED`.
- Due steps queue `send_email` actions through `PERSONA_LIFECYCLE_POLICY`.
- Live sends remain human-gated through `action_ledger`; queued cadence drafts do not prove delivery.
- Delivery evidence is only `sendEmail` returning `sent: true` after approval, plus downstream SendGrid events where present.
- SendGrid webhooks write `growth_campaign_events`; unsubscribe/complaint events also write `email_suppressions`.
- Public unsubscribe handling is `GET/POST /api/growth/email/unsubscribe`.
- Drafts, approvals, delivery state, and blockers remain in Firestore and Paperclip-visible action/human-blocker records.

## Buyer Lifecycle Integration

The existing buyer onboarding and buyer lifecycle code remains authoritative for post-entitlement support:

- `buyer-onboarding.ts` still handles purchase/onboarding sequences.
- `runBuyerLifecycleCheck` still handles entitlement aging and renewal-adjacent buyer success.
- Robot-team signup cadence is pre-entitlement/proof-path education owned by `robot-team-growth-agent`; once an entitlement exists, buyer success and buyer lifecycle code own support.

## Human Gates

Human review is required for:

- live lifecycle sends;
- broad outbound or campaign sends;
- unsupported product availability, adoption, proof, rights/privacy, or commercial claims;
- permission, legal, pricing, revenue-share, procurement, or public publication commitments.

The durable human gate path remains the standard Paperclip blocker packet and reply contract. Do not use `hlfabhunt@gmail.com`.

## Implemented Surfaces

- `server/utils/lifecycle-cadence.ts`
- `server/utils/email-suppression.ts`
- `server/routes/email-preferences.ts`
- `server/routes/inbound-request.ts`
- `server/routes/waitlist.ts`
- `server/utils/growth-ops.ts`
- `server/utils/opsAutomationScheduler.ts`
- `server/agents/action-policies.ts`
- `server/agents/action-executor.ts`
- `server/utils/human-blocker-autonomy.ts`
- `server/config/env.ts`
- `render.required.env.example`
- `render.optional.env.example`
- `DEPLOYMENT.md`
- Paperclip agent/program docs under `ops/paperclip/`

## Verification Plan

Focused tests cover persona sequence generation, offsets, skip/dedupe behavior, agent ownership metadata, human-gated policy classification, placeholder email rejection, unsubscribe/suppression, and scheduler integration:

- `server/tests/lifecycle-cadence.test.ts`
- `server/tests/action-policies.test.ts`
- `server/tests/ops-automation-scheduler.test.ts`
- `server/tests/growth-ops-creative-context.test.ts`
- adjacent coverage: `action-executor`, `admin-action-queue`, `buyer-onboarding`, `admin-growth-routes`, and `email` tests

Full closeout still requires `npm run check`, focused Vitest, broad enough coverage, and Graphify refresh after code changes.
