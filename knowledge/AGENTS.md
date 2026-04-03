# Hermes KB Guide

This directory is the constrained Hermes knowledge base for Blueprint.

## Why it exists

Use this directory to accumulate reusable research and support artifacts across Hermes runs.

Do not use this directory as the authority for:

- Paperclip issue state
- approvals
- rights or privacy decisions
- pricing or legal commitments
- capture provenance
- package manifests
- hosted runtime truth

## Edit rules

- Prefer updating an existing page over creating a duplicate page.
- Put raw source material in `raw/`.
- Put reusable synthesized pages in `compiled/`.
- Put task-specific outputs in `reports/`.
- Keep `indexes/` current when a page introduces new gaps, stale findings, or contradictions.
- Use the templates in `templates/`.
- Run `npm run lint:hermes-kb` after substantial KB edits.

## Required page behavior

Pages in `compiled/` and `reports/` must:

- include the required YAML frontmatter
- include the required section headings
- link out to canonical systems when discussing work state or policy truth
- state their authority boundary explicitly

## Default agent posture

- Hermes memory is support, not authority.
- When in doubt, link to Paperclip, Notion, repo docs, Firebase records, or package artifacts instead of summarizing them as if the KB were canonical.
