# Support Triage Shadow Comparison Proof

Generated: 2026-05-29T21:56:42.757Z
Fixture root: labs/autoagent/tasks
Lane: support_triage
Primary decision source: fixture expected.json records
Shadow decision source: deterministic_support_triage_shadow_policy_v1
Authority: primary_result_only; shadow output is observation_only and never acts

## Summary

- sample_count: 20
- clean_sample_count: 20
- regression_count: 0
- safety_blockers: none
- mismatched_decision_fields: none
- no_regression_window_days: 14

## Source Coverage

- general_support: 5
- billing_blocked: 5
- no_change_churn: 5
- public_copy_proof_drift: 5

## Records

- support-shadow-general-onboarding-948b485ecf28: fixture=dev/seed-support-general variant=general-onboarding promote=true
- support-shadow-general-login-guidance-cf31bc77d2e5: fixture=dev/seed-support-general variant=general-login-guidance promote=true
- support-shadow-general-docs-question-feaf24214fce: fixture=dev/seed-support-general variant=general-docs-question promote=true
- support-shadow-general-follow-up-ec174d3136f5: fixture=dev/seed-support-general variant=general-follow-up promote=true
- support-shadow-general-contact-update-824304287f2e: fixture=dev/seed-support-general variant=general-contact-update promote=true
- support-shadow-billing-refund-421bc23d18e3: fixture=holdout/seed-support-billing-blocked variant=billing-refund promote=true
- support-shadow-billing-invoice-5bf83cc1ca8f: fixture=holdout/seed-support-billing-blocked variant=billing-invoice promote=true
- support-shadow-billing-duplicate-charge-6e94ae378735: fixture=holdout/seed-support-billing-blocked variant=billing-duplicate-charge promote=true
- support-shadow-billing-receipt-967b56d2dc79: fixture=holdout/seed-support-billing-blocked variant=billing-receipt promote=true
- support-shadow-billing-cancel-charge-904383d54c64: fixture=holdout/seed-support-billing-blocked variant=billing-cancel-charge promote=true
- support-shadow-no-change-complete-without-artifact-bc8d6cb93b05: fixture=shadow/seed-support-no-change-churn variant=no-change-complete-without-artifact promote=true
- support-shadow-no-change-same-blocker-ffbd109db38c: fixture=shadow/seed-support-no-change-churn variant=no-change-same-blocker promote=true
- support-shadow-no-change-status-only-a56969185c67: fixture=shadow/seed-support-no-change-churn variant=no-change-status-only promote=true
- support-shadow-no-change-report-only-918d4fe7a4b9: fixture=shadow/seed-support-no-change-churn variant=no-change-report-only promote=true
- support-shadow-no-change-unsupported-done-c4d5fb5a70b7: fixture=shadow/seed-support-no-change-churn variant=no-change-unsupported-done promote=true
- support-shadow-public-copy-operational-proof-ff0ed88a7535: fixture=shadow/seed-support-public-copy-proof-drift variant=public-copy-operational-proof promote=true
- support-shadow-public-copy-hosted-session-9521cf347b29: fixture=shadow/seed-support-public-copy-proof-drift variant=public-copy-hosted-session promote=true
- support-shadow-public-copy-customer-proof-7b97ae379b7b: fixture=shadow/seed-support-public-copy-proof-drift variant=public-copy-customer-proof promote=true
- support-shadow-public-copy-provider-ready-0f69f25bf7f5: fixture=shadow/seed-support-public-copy-proof-drift variant=public-copy-provider-ready promote=true
- support-shadow-public-copy-rights-cleared-45474c60a5bf: fixture=shadow/seed-support-public-copy-proof-drift variant=public-copy-rights-cleared promote=true

## Safety Boundary

This is repo-local deterministic shadow comparison evidence only. It does not prove production automation quality, live sends, payments, payouts, provider execution, hosted-session fulfillment, rights/legal clearance, city launch, customer claims, Firestore export, Notion writes, or broad Paperclip/Hermes mutation.
