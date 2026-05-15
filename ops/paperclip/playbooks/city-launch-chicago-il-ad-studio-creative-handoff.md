# Chicago, IL Ad Studio Claims And Creative Handoff

- status: task-seeded, not proof of generated assets or ad performance
- collection: `ad_studio_runs`
- owner_lane: `robot-team-growth-agent`
- human_gate: founder approval is required before live send or live spend; claims/rights/privacy exceptions stay human-gated.

## Required Run Evidence
- `claims_ledger.allowedClaims` and `claims_ledger.blockedClaims` must be present.
- `review.status` must be `draft_safe` before any Meta draft work.
- `prompt_pack` must exist before image/video handoff.
- `image_execution_handoff` must name the Paperclip/Codex execution surface and model intent.
- `video_task` or Higgsfield handoff is optional and must name provider auth status and first-frame provenance when used.
- `meta_draft.provider=ads_cli` is preferred because `meta_ads_cli_runs` stores command provenance.

## Evidence Boundary
Generated creative is marketing material, not ground truth.
Generated images and videos cannot substitute for capture provenance, rights clearance, proof-pack delivery, hosted-review evidence, recipient-backed sends, or ad performance.

## Scorecard Linkage
- gtm_contract: /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/autonomy-cert-city-EsTxyw/chicago-il/2026-05-15T22-10-21.677Z/city-launch-chicago-il-gtm-72h-contract.md
- checkpoint_manifest: /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/autonomy-cert-city-EsTxyw/chicago-il/2026-05-15T22-10-21.677Z/city-launch-chicago-il-scorecard-windows.json