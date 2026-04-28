# Durham, NC No-Signal Recovery

- status: triggered
- evaluated_at: 2026-04-28T17:01:25.659Z
- trigger_rule: no positive applicant/capturer/reply/operator signal after 3 days or 2 sent direct-outreach actions
- reason: Triggered because Durham, NC has 2 sent direct-outreach actions, 0 recorded responses, 0 live supply responses, and 0 live buyer/operator engagements.
- dispatch_status: dispatched

## Thresholds

- no_signal_after_days: 3
- min_sent_actions: 2

## Signal Snapshot

| Signal | Count / value |
| --- | --- |
| sent direct outreach | 2 |
| sent direct outreach with recipient evidence | 2 |
| first sent at | 2026-04-20T00:00:00.000Z |
| days since first send | 8.71 |
| recorded responses | 0 |
| routed responses | 0 |
| reply conversions | 0 |
| live supply responses | 0 |
| approved capturers | 0 |
| onboarded capturers | 0 |
| capturing capturers | 0 |
| live buyer/operator engagements | 0 |
| qualified site/operator intros | 0 |
| explicit no-response outcomes | 0 |

## Delegation Plan

| Delegation | Owner | Safe autonomous outputs | Human gates |
| --- | --- | --- | --- |
| capturer growth recovery | capturer-growth-agent | source-bucket diagnosis; capturer-facing campaign brief; revised source plan with applicant/capturer signal metrics | live posting; paid spend; trust/payout exceptions |
| city-opening CTA and routing recovery | city-launch-agent | CTA/routing update; source-bucket map; updated no-signal scorecard | policy posture changes; rights/privacy exceptions |
| marketing, brand, and content draft lane | community-updates-agent | campaign mock pack; landing-copy variants; short video/storyboard concepts; channel-specific draft copy | live public posting; paid spend; brand-risk exceptions |
| non-public-location access recovery | site-operator-partnership-agent | site-operator target buckets; rights-aware operator intro pack; private-site access sequence draft | private controlled site commitment; rights/privacy exception; non-standard commercial commitment |
| proof-led outbound recovery | outbound-sales-agent | recipient-evidence check; proof-led outbound copy variants; no-response outcome ledger update | live send without approved transport; recipient-evidence gap; commercial exception |

## Measurement Outputs

- applicant
- reply
- qualified site/operator intro
- capturer candidate
- explicit no-response outcome

## Human Gates That Remain

- live public posting
- paid spend
- rights/privacy exceptions
- private controlled site commitments
- live sends without recipient-backed evidence or approved transport