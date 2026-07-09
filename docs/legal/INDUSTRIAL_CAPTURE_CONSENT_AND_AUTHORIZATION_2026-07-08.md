# Industrial Capture Consent & Authorization Layer (R001)

**Status: LEGAL SCAFFOLD (framework + code enforcement) — awaiting counsel sign-off.**
Addresses the audit P0 *"Consent/authorization model is retail/public-space framed
with no industrial (warehouse/factory) legal layer"* — the single most important
legal blocker for the founder's industrial-first goal. The *code* enforcement is
now largely in place (see §4); the *legal framework + sign-off* is the remaining
human deliverable.

Industrial sites (warehouses, factories, distribution/fulfillment centers) are
**private property with workers, proprietary processes, and safety regimes** —
the retail/"lawful visible area" model is insufficient. Capture there requires
explicit operator authorization, worker-privacy handling, safety compliance, and
proprietary-information controls.

## 1. Site-operator authorization (required for industrial/private sites)

A capture at an industrial/private site MUST carry a recorded operator
authorization before it can clear the rights gate:

- Authorizer name + title (someone with authority to permit capture).
- Signed date + optional expiry.
- Allowed areas and explicit restrictions (e.g. LOTO zones, production lines,
  employee break/medical areas).
- Optional attached authorization document (PDF/photo).
- Escort/PPE conditions where applicable.

## 2. Worker / employee privacy

- Workers are identifiable and generally have NOT consented to capture. Redaction
  of persons **and** industrial-sensitive PII (badges/IDs, screens/monitors,
  whiteboards, signage, vehicle plates) is required before a site can be treated
  as privacy-cleared.
- Jurisdiction-specific rules (two-party consent states, biometric privacy laws
  such as BIPA) must be evaluated per site region — **counsel action.**

## 3. Proprietary information & safety

- Proprietary processes/equipment: NDA / proprietary-data handling terms with the
  site operator; ability to exclude/redact designated proprietary zones.
- EHS/safety: capturers on industrial sites must acknowledge site safety rules;
  background checks for on-site access (see R033 scaffold).

## 4. Code enforcement already in place (this is real, not aspirational)

- **Site-gated consent (R011):** `policy_only` consent no longer self-clears for
  industrial/private sites — they require `permission_document_uri` or a
  lawful-basis attestation, else blocker
  `policy_only_insufficient_for_private_or_industrial_site`.
- **Operator authorization capture (R012/R020):** the capture app's
  `VenuePermission` is now a real Codable, capturable, persisted authorization
  record (authorizer/areas/restrictions/attachment) with an industrial preset,
  written into the capture bundle's rights metadata — no longer a retail demo.
- **Industrial redaction (R010):** privacy redaction is site-type-aware; industrial
  sites must handle badge/screen/signage/plate classes before `privacy_state`
  can be `cleared`.
- **Site type as capture truth (R005/R018):** the capturer declares the site type;
  a canonical taxonomy classifies industrial vs. non-industrial so the above gates
  fire on the right sites.

## 5. Remaining human/legal action (blocks the P0)

- [ ] Counsel drafts the industrial site-operator authorization agreement + worker-
      privacy notice + NDA/proprietary terms from this framework.
- [ ] Per-region legal review (two-party consent, biometric laws) for the beta's
      target metros.
- [ ] EHS/safety acknowledgement copy finalized; background-check provider decided
      (R033).
- [ ] Sign-off recorded so the paid-gate legal/EHS + consent evidence flips to
      satisfied. Until then, industrial captures must carry a real operator
      authorization (enforced) and the launch must not claim blanket lawful basis.
