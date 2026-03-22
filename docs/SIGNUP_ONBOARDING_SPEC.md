# Archived Signup / Onboarding Spec

Date archived: 2026-03-21

This document described an older marketplace-first signup and onboarding concept.

It is no longer the product direction for `Blueprint-WebApp`.

Current public product direction:

1. `BlueprintCapture` supply-side capture
2. site-specific world models and hosted access sold through `Blueprint-WebApp`
3. qualification / readiness as an optional downstream trust layer, not the lead story

What is outdated in the archived spec:

- marketplace-first landing and personalization
- `/marketplace` as the primary post-signup destination
- “explore marketplace” onboarding goals
- qualification-first positioning as the top public story

What remains relevant:

- the repo still has account creation, intake collection, and onboarding state
- some legacy compatibility fields remain in Firestore and API contracts
- implementation should follow the current live product copy and routes, not this archived spec

If a new signup/onboarding spec is needed, write a fresh one around:

- capture supply onboarding
- world-model buyer onboarding
- optional site-operator commercialization onboarding
