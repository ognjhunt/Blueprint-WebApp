# Governance Simplification Design

Date: 2026-04-17

Owner: `webapp-codex`

Status: Approved for implementation by user-directed autonomy

## Goal

Simplify `/governance` into a shorter buyer-readable trust page that explains what Blueprint makes visible around rights, privacy, provenance, restrictions, and hosted-access boundaries without reading like a compliance memo.

The page should follow the new public-site standard:

- fewer sections
- shorter copy
- stronger visual hierarchy
- less policy-wall repetition
- faster trust comprehension
- exact-site truth preserved

## Product Constraints

This page must remain aligned with repo doctrine:

- rights, privacy, provenance, hosted-access boundaries, and truthful labeling must stay visible
- the page must not imply certifications or guarantees Blueprint has not published
- public listing does not mean unrestricted commercial clearance
- hosted access must remain clearly bounded and human-gated where appropriate

## Problem Summary

The current page is honest but too dense:

- multiple card grids explain similar trust ideas from slightly different angles
- trust cards, principles, buyer questions, published-vs-not-claimed, control cards, listing policy, and the control matrix all compete
- the page reads more like internal trust documentation than a premium public trust page

## Recommended Direction

Rebuild the page as a four-section trust snapshot:

1. Hero
2. What a buyer should be able to read
3. What Blueprint shows vs what Blueprint does not claim
4. Control and boundary summary with closing action

This should keep the trust story sharp while removing repeated scaffolding.

## Alternative Approaches Considered

### Approach A: Policy-style reference page

Pros:
- exhaustive

Cons:
- too dense for the new public-site direction
- repeats concepts rather than clarifying them

### Approach B: Buyer-readable trust snapshot

Pros:
- keeps the important truth
- faster to scan
- matches Home, world-models, hosted review, and pricing

Cons:
- requires disciplined trimming so nuance is preserved in fewer words

### Approach C: FAQ trust page

Pros:
- easy to structure

Cons:
- still text-heavy
- weaker visual hierarchy than the new direction

## Selected Approach

Approach B is the right fit.

The page should tell a serious buyer:

- what they should be able to inspect
- what Blueprint publishes today
- what Blueprint explicitly does not claim
- how access and rights boundaries stay controlled

## New Information Architecture

### 1. Hero

Headline:
- `Trust should be readable before purchase.`

Support line:
- `Blueprint makes rights, privacy, provenance, restrictions, and hosted-access boundaries part of the buyer surface instead of hiding them behind sales copy.`

Hero signal strip:
- `Rights stay explicit`
- `Hosted access stays bounded`
- `No trust claims beyond the listing`

### 2. What A Buyer Should Be Able To Read

Purpose:
- replace multiple overlapping card grids with one compact section

Recommended items:
- provenance and freshness
- rights and restrictions
- hosted-access boundary
- redaction and retention

Each item should describe the buyer-visible object, not abstract policy philosophy.

### 3. What Blueprint Shows Vs What Blueprint Does Not Claim

Purpose:
- preserve the truth boundary in one strong section

This section should clearly separate:
- what Blueprint publishes today
- what Blueprint does not claim

It should keep explicit language that no certification, blanket approval, or deployment guarantee is implied unless published.

### 4. Control And Boundary Summary

Purpose:
- merge listing policy, operational controls, and matrix material into one shorter section

Recommended content:
- public listing is still commercially bounded
- hosted sessions remain authenticated and entitlement-controlled
- rights/privacy/export exceptions remain human-gated

Close with one clean CTA:
- inspect the sample listing
- contact for request-scoped review

## Acceptance Criteria

- the page becomes materially shorter
- trust is understandable in one short scroll
- the page keeps hard boundaries visible
- it no longer reads like an internal trust memo

