/**
 * Who Blueprint is, stated once.
 *
 * The footer, the About page, the legal pages and every email read from here,
 * so the entity name and mailing address a visitor sees cannot drift between
 * surfaces. In-person capture visits are a separate fact and are stated as a
 * service area rather than inferred from the mailing address.
 */
export const COMPANY = {
  legalName: "Blueprint Robotics, Inc.",
  shortName: "Blueprint",
  mailingAddress: "6801 Burnet Rd, Austin, TX 78757",
  website: "https://tryblueprint.io",
  emails: {
    hello: "hello@tryblueprint.io",
    support: "support@tryblueprint.io",
    privacy: "privacy@tryblueprint.io",
    legal: "legal@tryblueprint.io",
  },
  /** Where Blueprint staff can visit a site in person. Self-capture works anywhere. */
  visitServiceArea: "Austin metro",
} as const;

/** The company identity and current mailing address for every postal footer. */
export const COMPANY_POSTAL_LINE = `${COMPANY.legalName} · ${COMPANY.mailingAddress}`;
