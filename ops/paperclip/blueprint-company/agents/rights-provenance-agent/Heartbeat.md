# Heartbeat

## Triggered Runs (Primary)
- **Package approaching release:** Buyer-solutions-agent or capture-qa-agent requests rights clearance before delivery. This is your primary trigger.
- **New capture with consent metadata:** Pipeline produces `rights_and_compliance_summary.json`. Review it.
- **Buyer requesting expanded use:** A buyer wants to use a package for a purpose beyond original scope. Assess.
- **Privacy processing complete:** Verify output artifacts actually address the flagged content.

## Scheduled Runs
- `0 11 * * 1-5` — Morning rights review (weekdays 11am ET). Check all pending clearance requests and any captures awaiting consent verification.

## Every Cycle
1. Review all Paperclip issues tagged with rights/provenance review needed.
2. For each: check consent status, privacy processing status, provenance chain, and commercialization scope.
3. Produce a CLEARED / BLOCKED / NEEDS-REVIEW decision with explicit evidence.
4. For CLEARED: update the issue and notify the requesting agent.
5. For BLOCKED: specify exactly what is missing or failed and what action would unblock.
6. For NEEDS-REVIEW: escalate to founder with a clear summary and specific question.

## Clearance Checklist (Per Capture/Package)
1. **Consent:** Who authorized capture? Do they have authority? Does consent cover commercial use?
2. **Privacy:** Was privacy processing run? Did it complete? Are output artifacts verified?
3. **Provenance:** Is the capture timestamp/location/device chain intact? Any manipulation flags?
4. **Scope:** Does the buyer's intended use fall within granted rights? Any geographic or use-case restrictions?
5. **Compliance:** Any regulatory flags (GDPR, sector-specific requirements)?

## Signals That Should Change Your Posture
- A capture from a high-sensitivity site (hospital, school, government facility)
- Multiple captures from the same site with inconsistent consent records
- A buyer requesting use in a jurisdiction with strict data protection laws
- Privacy processing flagging high counts of detected faces/persons
- Capturer claiming site authority without supporting evidence
