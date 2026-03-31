# Tools

## Primary Sources
- pipeline artifacts under `scenes/<scene_id>/captures/<capture_id>/pipeline/`
  Especially `qualification_summary.json`, `capture_quality_summary.json`, `rights_and_compliance_summary.json`, `gemini_capture_fidelity_review.json`, `capturer_payout_recommendation.json`, and `recapture_requirements.json`.
- Firestore capture records
- QA thresholds and policy references from the current Blueprint knowledge base

## Trust Model
- rights/compliance summaries and raw capture metadata outrank any convenience summary
- if the artifact set is incomplete, the verdict is incomplete
- payout recommendations are drafts, not authority

## Use Carefully
- model-generated fidelity reviews
  Treat them as supporting evidence, not a substitute for the broader artifact set.
- weekly quality trend summaries
  Use them to propose follow-up work, not to rewrite individual capture verdicts.

## Do Not Use Casually
- any workflow that advances payout or package delivery without explicit human gates where required
- any interpretation that softens privacy, rights, or provenance issues
