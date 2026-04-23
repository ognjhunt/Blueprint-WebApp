# Durham, NC Deep Research Playbook

Recovered on 2026-04-22 from the completed Durham initial Deep Research pass plus the completed critique pass after Gemini billing exhausted during the follow-up round. This artifact intentionally keeps only claims that were already present in the Durham research or are explicitly marked `validation required`.

## Executive summary

Durham should move forward as a narrow, capture-first exact-site hosted review launch, but only on a subscale logistics scope. The first Durham motion is not a full-facility warehouse capture and it is not a broad buyer launch. It is one lawful-access path into one empty or pre-tenant logistics bay, paired with one small professional capturer cohort and a buyer lane that stays research-only until recipient-backed buyer contacts are verified.

The Durham work that can proceed now is reversible and internal: define the first lawful-access path, constrain the first capture boundary to a sub-10,000 sq ft empty or pre-tenant bay, screen export-control and air-gap risk before dispatch, line up AEC-grade capturer supply, and keep the Durham scorecard honest. The Durham work that remains blocked is outward buyer direct outreach, because the current research does not contain recipient-backed buyer contact emails.

## Truth constraints

- Durham is still a gated cohort pilot, not a public city launch.
- Durham Logistics Center and Welcome Venture Park are uncontacted candidate sites, not proof-ready assets.
- Private controlled interiors require explicit authorization before capture dispatch.
- Export-control, defense, and air-gap screening must happen before field dispatch, not after capture.
- Do not assume standard Blueprint pipeline limits are safe for a full 351,030 sq ft warehouse. Start with one subscale empty or pre-tenant bay.
- Do not treat generic inboxes as recipient-backed buyer outreach. The current Durham buyer lane is not outwardly addressable yet.
- Do not assume buyer stack, delivery format, security posture, or public-cloud compatibility. Verify before outreach.

## City proof-motion thesis

Durham is a plausible proof-motion city because it combines logistics-site buildout, Triangle technical density, and a credible AEC survey supply lane. The correct Durham motion is one exact-site hosted review wedge around a subscale logistics interior, not a citywide marketplace or full-building coverage story.

## Why this city now for Blueprint

- Durham research identified live logistics development and facility turnover that can create lawful-access opportunities for bounded exact-site capture.
- Durham research identified professional AEC and surveying capability in the Triangle, which is a better early supply lane than generic gig capture.
- Durham research identified robotics and industrial automation companies worth keeping in the Durham demand map, even though recipient-backed buyer outreach evidence is not ready yet.

## Narrow wedge definition

- Primary site lane: logistics and industrial interiors, constrained to one empty or pre-tenant bay.
- Primary workflow lane: AMR pre-deployment evaluation and hosted review for a specific bounded interior.
- Primary buyer proof path: `exact_site` when the exact Durham bay is captured and rights-cleared; otherwise keep buyer work in `scoped_follow_up`.
- First real motion: secure lawful access to one subscale Durham bay, produce one rights-cleared proof asset, and use that asset to support hosted review preparation.

## Evidence-backed claims

- Durham research identified Lovett Industrial and Durham Logistics Center as a real candidate operator path for Durham logistics-site access.
- Durham research identified Welcome Venture Park and Guardian-related expansion activity as a Durham candidate adjacent logistics path.
- Durham research identified Summit Design / Triangle AEC capability as a credible professional supply lane for capture-quality surveying work.
- Durham research identified BotBuilt and ROI Industries as Durham-area buyer research candidates worth keeping in the demand map.

## Inferred claims

- A bounded empty-bay capture is more plausible than a full-facility launch from both budget and pipeline-risk perspectives.
- The first Durham launch should prioritize operator and capturer supply paths before live buyer direct outreach.
- Durham can progress meaningfully even if the buyer lane stays blocked on recipient-backed contact evidence for now.

## Hypotheses needing validation

- Validation required: one sub-10,000 sq ft empty or pre-tenant logistics bay can be accessed lawfully through operator or leasing channels.
- Validation required: the current capture and pipeline path can handle the chosen Durham subspace without custom infrastructure.
- Validation required: BotBuilt, ROI Industries, or another Durham robotics buyer actually fit the exact-site hosted review wedge for the chosen logistics scope.
- Validation required: AEC supply agreements permit Blueprint to host and reuse resulting site models for buyer proof motion.

## What Must Be Validated Before Live Outreach

- Verify before outreach: operator authorization and export-control screening for any private Durham logistics interior.
- Verify before outreach: the exact physical scope of the first Durham site target, including whether the candidate bay is empty or pre-tenant.
- Verify before outreach: recipient-backed buyer contacts for Durham robotics or automation targets. Until then, the buyer lane remains draft-only.
- Verify before outreach: artifact compatibility expectations for Durham robotics buyers, especially mesh, point-cloud, and hosted-review requirements.

## What not to say publicly yet

- Do not say Durham is live.
- Do not say Durham has proof-ready sites.
- Do not say Blueprint already has lawful access to Durham Logistics Center or Welcome Venture Park.
- Do not say Durham buyers are launch-ready or that buyer direct outreach is underway.
- Do not say Blueprint can handle full-facility warehouse capture at Durham Logistics Center today.

## Instrumentation spec

Use only approved analytics references and proof-motion milestones:

- `robot_team_inbound_captured`
- `proof_path_assigned`
- `proof_pack_delivered`
- `hosted_review_ready`
- `hosted_review_started`
- `hosted_review_follow_up_sent`
- `human_commercial_handoff_started`
- `proof_motion_stalled`
- `inboundRequests.ops.proof_path`

Durham-specific milestone focus:

- first lawful access path
- first approved capturer
- first completed capture
- first rights-cleared proof asset
- first hosted review

## Immediate next actions

1. Lock the first Durham site boundary to one subscale empty or pre-tenant bay.
2. Route pre-dispatch export-control and rights screening before any field dispatch.
3. Keep site-operator and leasing contact paths active.
4. Line up AEC-grade capturer supply in Durham or the wider Triangle.
5. Keep buyer demand research alive, but block live buyer sends until recipient-backed contacts exist.

## Machine-readable activation payload

```city-launch-activation-payload
{
  "schema_version": "2026-04-13.city-launch-activation-payload.v1",
  "machine_policy_version": "2026-04-13.city-launch-doctrine.v1",
  "city": "Durham, NC",
  "city_slug": "durham-nc",
  "city_thesis": "Durham should start as one subscale exact-site hosted review motion around a single empty or pre-tenant logistics bay with pre-dispatch export-control screening and no buyer-lane live outreach until recipient-backed buyer contacts exist.",
  "primary_site_lane": "industrial_warehouse_empty_bay",
  "primary_workflow_lane": "amr_pre_deployment_evaluation_for_subscale_logistics_bays",
  "primary_buyer_proof_path": "exact_site",
  "lawful_access_modes": [
    "site_operator_intro",
    "capturer_existing_lawful_access"
  ],
  "preferred_lawful_access_mode": "site_operator_intro",
  "rights_path": {
    "summary": "Pre-dispatch site-operator authorization and export-control screening are required before any private controlled interior capture. Unscreened logistics or defense-adjacent interiors must remain blocked.",
    "private_controlled_interiors_require_authorization": true,
    "validation_required": true,
    "source_urls": []
  },
  "validation_blockers": [
    {
      "key": "subscale_target_scope",
      "summary": "Constrain the first Durham capture to one sub-10,000 sq ft empty or pre-tenant bay instead of a full 351,030 sq ft facility.",
      "severity": "high",
      "owner_lane": "city-launch-agent",
      "validation_required": true,
      "source_urls": []
    },
    {
      "key": "recipient_backed_buyer_contacts",
      "summary": "BotBuilt and ROI Industries remain research-backed buyer candidates, but direct buyer outreach is blocked until recipient-backed human contact emails are verified.",
      "severity": "high",
      "owner_lane": "city-demand-agent",
      "validation_required": true,
      "source_urls": []
    },
    {
      "key": "pre_dispatch_export_control_screen",
      "summary": "Export-control, defense, and air-gap constraints must be screened during site-operator intake before any capturer is dispatched.",
      "severity": "high",
      "owner_lane": "rights-provenance-agent",
      "validation_required": true,
      "source_urls": []
    }
  ],
  "required_approvals": [
    {
      "lane": "designated-human-rights-reviewer",
      "reason": "Private interior capture cannot start until site authorization and export-control screening are explicitly cleared."
    },
    {
      "lane": "growth-lead",
      "reason": "First live external sends should stay inside the bounded Durham posture and recipient evidence rules."
    }
  ],
  "owner_lanes": [
    "city-launch-agent",
    "city-demand-agent",
    "capturer-growth-agent",
    "rights-provenance-agent",
    "buyer-solutions-agent",
    "analytics-agent",
    "outbound-sales-agent",
    "beta-launch-commander"
  ],
  "issue_seeds": [
    {
      "key": "lock-subscale-site-scope",
      "title": "Lock the first Durham subscale site scope",
      "phase": "founder_gates",
      "owner_lane": "city-launch-agent",
      "human_lane": "growth-lead",
      "summary": "Reduce the first Durham target from full-facility rhetoric to one empty or pre-tenant logistics bay with explicit physical scope.",
      "dependency_keys": [],
      "success_criteria": [
        "One exact Durham bay or equivalent bounded interior is named.",
        "The first capture boundary is documented as sub-10,000 sq ft."
      ],
      "metrics_dependencies": [
        "first_lawful_access_path"
      ],
      "validation_required": true
    },
    {
      "key": "pre-dispatch-rights-screen",
      "title": "Move export-control and rights screening before field dispatch",
      "phase": "founder_gates",
      "owner_lane": "rights-provenance-agent",
      "human_lane": "designated-human-rights-reviewer",
      "summary": "Confirm site authorization, defense/export-control posture, and privacy boundaries before any Durham capturer is dispatched.",
      "dependency_keys": [
        "lock-subscale-site-scope"
      ],
      "success_criteria": [
        "The first Durham candidate is screened for private-interior authorization.",
        "Any export-control or air-gap blocker is recorded before dispatch."
      ],
      "metrics_dependencies": [
        "first_lawful_access_path"
      ],
      "validation_required": true
    },
    {
      "key": "seed-aec-capturer-cohort",
      "title": "Line up Durham AEC capturer supply",
      "phase": "supply",
      "owner_lane": "capturer-growth-agent",
      "human_lane": "ops-lead",
      "summary": "Use Triangle AEC-capable supply lanes to identify the first small professional cohort for Durham capture.",
      "dependency_keys": [
        "pre-dispatch-rights-screen"
      ],
      "success_criteria": [
        "At least one Durham or Triangle AEC-grade capturer candidate is queued for trust review.",
        "The first Durham supply lane stays bounded to a small vetted cohort."
      ],
      "metrics_dependencies": [
        "first_approved_capturer"
      ],
      "validation_required": true
    },
    {
      "key": "keep-buyer-lane-research-only",
      "title": "Keep the Durham buyer lane research-only until contacts are real",
      "phase": "demand",
      "owner_lane": "city-demand-agent",
      "human_lane": "growth-lead",
      "summary": "Carry BotBuilt and ROI Industries as research-backed buyer candidates while blocking live buyer sends until recipient-backed contact evidence exists.",
      "dependency_keys": [],
      "success_criteria": [
        "Durham buyer candidates remain visible in the target ledger.",
        "No live buyer send is marked ready without a recipient-backed contact email."
      ],
      "metrics_dependencies": [
        "proof_path_assigned"
      ],
      "validation_required": true
    },
    {
      "key": "verify-buyer-artifact-fit",
      "title": "Verify Durham buyer artifact and hosted-review fit",
      "phase": "commercial",
      "owner_lane": "buyer-solutions-agent",
      "human_lane": "ops-lead",
      "summary": "Validate mesh, point-cloud, and hosted-review expectations for Durham robotics buyers before claiming stack fit.",
      "dependency_keys": [
        "keep-buyer-lane-research-only"
      ],
      "success_criteria": [
        "At least one Durham buyer-fit hypothesis is reduced to a concrete artifact requirement.",
        "Any air-gap or delivery blocker is recorded explicitly."
      ],
      "metrics_dependencies": [
        "proof_pack_delivered",
        "hosted_review_ready"
      ],
      "validation_required": true
    },
    {
      "key": "keep-durham-scorecard-honest",
      "title": "Keep the Durham scorecard honest",
      "phase": "measurement",
      "owner_lane": "analytics-agent",
      "human_lane": "ops-lead",
      "summary": "Track Durham only with approved proof-motion events and milestones, and surface blocked buyer-contact and lawful-access gaps directly.",
      "dependency_keys": [],
      "success_criteria": [
        "Durham blockers are visible in the city launch scorecard.",
        "No Durham-specific analytics vocabulary is introduced."
      ],
      "metrics_dependencies": [
        "robot_team_inbound_captured",
        "proof_path_assigned",
        "proof_pack_delivered",
        "hosted_review_ready",
        "hosted_review_started",
        "hosted_review_follow_up_sent",
        "human_commercial_handoff_started",
        "proof_motion_stalled"
      ],
      "validation_required": false
    }
  ],
  "metrics_dependencies": [
    {
      "key": "robot_team_inbound_captured",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Use the current WebApp event surfaces and keep Durham city attribution verified."
    },
    {
      "key": "proof_path_assigned",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Use the current WebApp proof-path routing surfaces."
    },
    {
      "key": "proof_pack_delivered",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Track when Durham leaves planning and actual proof artifacts move."
    },
    {
      "key": "hosted_review_ready",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Track when a Durham hosted-review surface is technically ready."
    },
    {
      "key": "hosted_review_started",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Track whether Durham proof converts into review behavior."
    },
    {
      "key": "hosted_review_follow_up_sent",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Keep Durham follow-up measurable without inventing new events."
    },
    {
      "key": "human_commercial_handoff_started",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Track when Durham shifts into a real human commercial thread."
    },
    {
      "key": "proof_motion_stalled",
      "kind": "event",
      "status": "required_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Expose blocked Durham motion instead of smoothing it over."
    },
    {
      "key": "first_lawful_access_path",
      "kind": "milestone",
      "status": "required_not_tracked",
      "owner_lane": "city-launch-agent",
      "notes": "The first Durham lawful-access path still needs explicit confirmation."
    },
    {
      "key": "first_approved_capturer",
      "kind": "milestone",
      "status": "required_not_tracked",
      "owner_lane": "capturer-growth-agent",
      "notes": "The first Durham AEC-grade capturer is not approved yet."
    },
    {
      "key": "first_rights_cleared_proof_asset",
      "kind": "milestone",
      "status": "required_not_tracked",
      "owner_lane": "rights-provenance-agent",
      "notes": "Rights-cleared Durham proof assets do not exist yet."
    },
    {
      "key": "first_hosted_review",
      "kind": "milestone",
      "status": "required_not_tracked",
      "owner_lane": "buyer-solutions-agent",
      "notes": "Durham hosted review remains a downstream milestone."
    }
  ],
  "named_claims": [
    {
      "subject": "Durham Logistics Center",
      "claim_type": "company",
      "claim": "Durham Logistics Center is a real Durham logistics-site candidate worth keeping in the first operator access path, but it is not proof-ready and the initial scope must stay subscale.",
      "validation_required": true,
      "source_urls": []
    },
    {
      "subject": "Welcome Venture Park",
      "claim_type": "company",
      "claim": "Welcome Venture Park remains an adjacent Durham logistics candidate, not an activated Blueprint site.",
      "validation_required": true,
      "source_urls": []
    },
    {
      "subject": "Triangle AEC survey supply",
      "claim_type": "delivery",
      "claim": "Triangle AEC-grade survey firms are the preferred Durham supply lane over generic gig capture.",
      "validation_required": true,
      "source_urls": []
    },
    {
      "subject": "Durham buyer lane",
      "claim_type": "stack",
      "claim": "Durham buyer direct outreach should stay blocked until recipient-backed contacts and artifact-fit requirements are verified.",
      "validation_required": true,
      "source_urls": []
    }
  ]
}
```

## Structured launch data appendix

```city-launch-records
{
  "schema_version": "2026-04-12.city-launch-research.v1",
  "generated_at": "2026-04-22T21:42:42Z",
  "capture_location_candidates": [
    {
      "name": "Durham Logistics Center (subscale empty-bay candidate)",
      "contact_email": "madison.jones@lovettindustrial.com",
      "source_bucket": "industrial_warehouse",
      "channel": "site_operator_intro",
      "status": "identified",
      "location_summary": "Operator route for one empty or pre-tenant bay inside Durham Logistics Center. Do not treat the full facility as proof-ready.",
      "site_category": "warehouse",
      "workflow_fit": "subscale empty-bay AMR evaluation",
      "priority_note": "Start with one sub-10,000 sq ft bay only after site authorization and export-control screening are confirmed.",
      "source_urls": [],
      "explicit_fields": [
        "name",
        "contact_email",
        "source_bucket",
        "channel"
      ],
      "inferred_fields": [
        "location_summary",
        "workflow_fit",
        "priority_note"
      ]
    },
    {
      "name": "Durham Logistics Center (leasing route candidate)",
      "contact_email": "andrew.young@colliers.com",
      "source_bucket": "industrial_warehouse",
      "channel": "site_operator_intro",
      "status": "identified",
      "location_summary": "Leasing-route contact for the same Durham Logistics Center scope. Use only after confirming operator permission path and subscale bay target.",
      "site_category": "warehouse",
      "workflow_fit": "subscale empty-bay AMR evaluation",
      "priority_note": "Useful as a leasing-route introduction, but still validation-required for lawful access.",
      "source_urls": [],
      "explicit_fields": [
        "name",
        "contact_email",
        "source_bucket",
        "channel"
      ],
      "inferred_fields": [
        "location_summary",
        "workflow_fit",
        "priority_note"
      ]
    },
    {
      "name": "Welcome Venture Park (candidate only)",
      "source_bucket": "industrial_warehouse",
      "channel": "site_operator_intro",
      "status": "identified",
      "location_summary": "Adjacent Durham logistics candidate. Keep blocked until the exact subspace, operator path, and rights posture are explicit.",
      "site_category": "warehouse",
      "workflow_fit": "adjacent-site logistics proof path",
      "priority_note": "Do not promote as proof-ready or launch-ready.",
      "source_urls": [],
      "explicit_fields": [
        "name",
        "source_bucket",
        "channel"
      ],
      "inferred_fields": [
        "location_summary",
        "workflow_fit",
        "priority_note"
      ]
    }
  ],
  "buyer_target_candidates": [
    {
      "company_name": "BotBuilt",
      "status": "researched",
      "workflow_fit": "Durham robotics buyer candidate for exact-site or adjacent-site facility evaluation after contact and artifact-fit verification.",
      "proof_path": "scoped_follow_up",
      "notes": "Keep as a researched buyer candidate only until recipient-backed contact and exact site demand are verified.",
      "source_bucket": "robotics_buyer",
      "source_urls": [],
      "explicit_fields": [
        "company_name"
      ],
      "inferred_fields": [
        "workflow_fit",
        "notes"
      ]
    },
    {
      "company_name": "ROI Industries",
      "status": "researched",
      "workflow_fit": "Industrial automation buyer candidate, but direct outreach remains blocked until a recipient-backed contact is verified.",
      "proof_path": "scoped_follow_up",
      "notes": "Do not treat the generic ROI inbox as launch-ready buyer evidence.",
      "source_bucket": "industrial_automation",
      "source_urls": [],
      "explicit_fields": [
        "company_name"
      ],
      "inferred_fields": [
        "workflow_fit",
        "notes"
      ]
    }
  ],
  "first_touch_candidates": [
    {
      "reference_type": "prospect",
      "reference_name": "Durham Logistics Center (subscale empty-bay candidate)",
      "channel": "email",
      "touch_type": "first_touch",
      "status": "queued",
      "campaign_id": null,
      "issue_id": null,
      "notes": "Draft only. Send only after site scope, rights screen, and sender readiness are confirmed.",
      "source_urls": [],
      "explicit_fields": [
        "reference_name",
        "channel"
      ],
      "inferred_fields": [
        "notes"
      ]
    },
    {
      "reference_type": "prospect",
      "reference_name": "Durham Logistics Center (leasing route candidate)",
      "channel": "email",
      "touch_type": "first_touch",
      "status": "queued",
      "campaign_id": null,
      "issue_id": null,
      "notes": "Use only as a bounded operator-access route, not as evidence that the site is already available.",
      "source_urls": [],
      "explicit_fields": [
        "reference_name",
        "channel"
      ],
      "inferred_fields": [
        "notes"
      ]
    }
  ],
  "budget_recommendations": [
    {
      "category": "field_ops",
      "amount_usd": 0,
      "note": "Do not approve paid Durham capture spend until the first site is constrained to one sub-10,000 sq ft bay and lawful access is explicit.",
      "source_urls": [],
      "explicit_fields": [
        "category",
        "amount_usd",
        "note"
      ],
      "inferred_fields": []
    },
    {
      "category": "outbound",
      "amount_usd": 0,
      "note": "Keep the Durham buyer lane draft-only until recipient-backed buyer contacts are verified.",
      "source_urls": [],
      "explicit_fields": [
        "category",
        "amount_usd",
        "note"
      ],
      "inferred_fields": []
    }
  ]
}
```
