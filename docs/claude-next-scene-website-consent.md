# Claude authoring on a future website capture

This is an opt-in contract for a **new, separately identified** capture. It does
not change the provider, authority, spend, or receipts of a running scene.
Pipeline PR #2141 consumes the signed `authoring_provider: anthropic` and exact
`anthropic_provider_terms_reference` fields from `website_scene_sponsorship.v1`.

The owner capture link presents Anthropic's configured HTTPS terms URL and asks
for a name and explicit authorization. A film-only link cannot make this choice.
The choice is retained against the request and capture identities before the
scene grant exists. It cannot be changed after a sponsorship or preparation
reservation. The grant binds its digest and records the Anthropic reference in
the scene consent; the existing Vast/OpenAI preparation terms remain separately
bound to the configured reference. The prepared-scene intake accepts only
`[vast, openai, anthropic]` for this opt-in grant. The default remains
`[vast, openai]` and OpenAI authoring.

Configuration must supply a reviewed, actual Anthropic terms entry under
`TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON` with an `anthropic:` reference,
human-readable label, and HTTPS URL. No value is embedded in production config
by this change. The fixed website development-test allocation remains $25 per
scene: $5 preparation and $20 simulation. The new option refuses a mismatched
budget rather than changing that price. This page is not a provider launch
switch; Pipeline deployment, scoped `ANTHROPIC_API_KEY_FILE`, provider terms
review, owner consent for the specific new capture, and a bounded canary remain
separate gates before Claude can process any real scene.
