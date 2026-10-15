/** Projection of the existing pilot record. Acceptance and a calendar entry
 * each fall short of a physical booking; retain historical price/terms as-is. */
export function projectPilotCoordination(record: Record<string, any> | null | undefined) {
  const proposal = record?.pilot_recommendation, acceptance = record?.pilot_booking;
  if (!proposal || !acceptance || acceptance.recommendationId !== proposal.id) return null;
  const agreement = acceptance.coordination;
  const scheduled = agreement?.state === "scheduled"
    && agreement.recommendationId === proposal.id && !proposal.reviewRequired
    && typeof agreement.calendarEventId === "string" && agreement.calendarEventId.length > 0
    && Number.isFinite(Date.parse(agreement.startsAt)) && Number.isFinite(Date.parse(agreement.endsAt))
    && Date.parse(agreement.endsAt) > Date.parse(agreement.startsAt)
    && agreement.providerAgreement?.evidenceRef && agreement.providerAgreement?.agreedBy
    && agreement.siteAgreement?.evidenceRef && agreement.siteAgreement?.agreedBy
    && typeof agreement.sitePreparation === "string" && agreement.sitePreparation.trim().length > 0;
  return {
    state: scheduled ? "scheduled" : "awaiting_coordination",
    // The site and the team agree the pilot directly (owner decision 2026-10-15).
    owner: "site_and_team",
    nextAction: proposal.reviewRequired
      ? "The job changed after booking. Blueprint must review the change against the booked scope."
      : scheduled ? "Follow the agreed site-preparation responsibilities. Any change to the date, scope or cost needs the applicable approval."
        : "You and the robot team agree the pilot's dates and terms directly. No date is reserved yet.",
    ...(scheduled ? { startsAt: agreement.startsAt, endsAt: agreement.endsAt, sitePreparation: agreement.sitePreparation } : {}),
    feeUsd: acceptance.amountUsd,
    commercialBasis: acceptance.commercialBasis,
    termsVersion: acceptance.termsVersion,
  };
}
