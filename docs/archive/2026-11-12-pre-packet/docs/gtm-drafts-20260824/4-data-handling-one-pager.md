# How Blueprint Handles Your Site Data — one-pager DRAFT (external-safe)

*Written for the operations lead and the counsel who will ask. Every mechanism named here
is enforced in the pipeline itself, not in a policy binder — several of them block our own
runs when a record is missing, which is the point.*

---

## What is captured

Two registered photographic passes of **one agreed workcell** — one without your task
objects, one with them — plus the task geometry needed to build the testbed. The capture
scope is written down and countersigned before the visit. We do not roam the facility.

## Consent before capture, enforced by the pipeline

A capture without its consent record does not process. This is not a promise: consent
parsing in our pipeline **fails closed** — downstream stages refuse inputs whose consent
artifacts are missing or malformed. The practical consequence for you: our field operator
cannot "capture now, sort out permissions later," because the data would be unusable to
us.

## What never appears

You give us a no-capture list before the visit (people, products, signage, equipment).
Camera paths are planned around it, and anything that still slips into frame is
**suppressed** in processing. Suppression is implemented as an auditable receipt bound to
the exact data it covers — we can show you, per item, that the suppressed region
contributes zero pixels to any rendered output, and the suppression survives every
downstream use because it travels with the data's fingerprint.

## Where your data lives and who can see it

- Site files are **hosted, not downloadable** — including for robot teams evaluating
  against your cell through our network. Evaluations run on our infrastructure against
  your hosted testbed; counterparties see results and the anonymized profile you
  approved, not your files.
- If you opt into the opportunity network, your listing is **anonymized by default**;
  named detail is released only at a shortlist stage you approve, with the permitted data
  uses recorded per listing.
- Every derived artifact is fingerprint-bound to its sources, so we can answer — exactly,
  not approximately — "what was this built from, and under which consent?"

## Revocation, at any time — including after delivery

You can revoke consent after the run is delivered. Revocation propagates: our serving
surfaces check takedown state before serving, so a revoked capture stops being served
rather than merely stopping being *sold*. Raw capture is treated as the authoritative
record while consent stands, and goes with the takedown when it doesn't.

## What we never do with your data

- No training of foundation models on your site data without a separate, explicit,
  written agreement — evaluation is the product, not data harvesting.
- No resale, no aggregation into public datasets, no "anonymized analytics" carve-out
  that quietly means otherwise.
- No publication of anything — including the fact of the engagement — without your
  signoff. A joint case study is an option you hold, not a default we assume.

## The honest edges

- Hosted infrastructure means our cloud providers process encrypted stores and rendered
  jobs; we bind artifacts by fingerprint so provenance survives infrastructure, and we'll
  name the providers on request.
- Formal certifications (e.g., SOC 2) are on our roadmap and not yet claimed; what we
  offer today is the stronger-than-usual alternative of *mechanically enforced* consent,
  suppression, and takedown — and we will walk your counsel through the receipts on a
  live example.

*Questions this page didn't answer are exactly what the scoping call is for.*
