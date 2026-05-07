# San Jose, CA Meta Ads Read-Only Proof And Paused Draft Gate

- status: provider-gated
- provenance_collection: `meta_ads_cli_runs`
- owner_lane: `robot-team-growth-agent`
- human_gate: founder approval is required before live paid spend.

## Allowed
- Read-only account/page/campaign/insights proof through the Meta Ads CLI when `META_ADS_CLI_ENABLED=1` and account env is configured.
- Paused campaign/ad set/creative/ad draft creation only after Ad Studio claims review is `draft_safe`, destination/media/page/account/budget env is valid, and founder budget/live-spend approval is recorded.

## Disallowed
- Do not create active campaigns, active ad sets, active ads, or live spend.
- Do not treat a paused draft, generated asset, or CLI proof as real ad performance.
- Do not bypass `meta_ads_cli_runs` provenance for the 72h city launch loop.

## Required Scorecard Evidence
- ad_studio_runs query: collection("ad_studio_runs").where("city", "==", city).orderBy("updated_at_iso", "desc").limit(100)
- meta_ads_cli_runs query: collection("meta_ads_cli_runs").where("city", "==", city).orderBy("createdAtIso", "desc").limit(100)
- gtm_contract: /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/proof-gated-buyer-launch-harness-CugiIK/san-jose-ca/2026-05-07T15-44-03.424Z/city-launch-san-jose-ca-gtm-72h-contract.md