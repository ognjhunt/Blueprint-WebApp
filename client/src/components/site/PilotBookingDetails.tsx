import type { PilotBookingView } from "@/types/workspace";

/**
 * A booked pilot, as one side sees it: the other side's contact and the plain
 * statement that dates and terms are agreed directly between the site and its
 * delivery partner. The server sends the contact only while both consents stand.
 */
export function PilotBookingDetails({ booking, other, showAgreement = true }: {
  booking: PilotBookingView;
  other: "site" | "delivery partner";
  /** Off where the page already states that dates and terms are agreed directly. */
  showAgreement?: boolean;
}) {
  if (booking.consentWithdrawn) {
    return <p>Consent was withdrawn after this booking, so contact details are no longer shared.</p>;
  }
  const contact = booking.contact;
  return (
    <>
      {showAgreement && <p>Dates and terms are agreed directly between you and the {other}. Blueprint takes no cut.</p>}
      {contact ? (
        <dl>
          <dt>{other === "site" ? "Site contact" : "Delivery partner contact"}</dt>
          <dd>
            {[contact.name, contact.organization].filter(Boolean).join(", ")}
            {(contact.name || contact.organization) && <br />}
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            {contact.phone && <><br />{contact.phone}</>}
          </dd>
        </dl>
      ) : (
        <p>The {other}'s contact details are not on record.</p>
      )}
    </>
  );
}
