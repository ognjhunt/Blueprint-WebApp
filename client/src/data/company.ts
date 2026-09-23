/**
 * Who Blueprint is, stated once.
 *
 * The footer, the About page, the legal pages and every email read from here,
 * so the entity name and mailing address a visitor sees cannot drift between
 * surfaces. The mailing address is the one Blueprint already publishes in its
 * email footers; in-person capture visits are a separate fact (the Austin
 * metro) and are stated as a service area, never as where the company is.
 */
export const COMPANY = {
  legalName: "Blueprint Robotics, Inc.",
  shortName: "Blueprint",
  mailingAddress: "1005 Crete St, Durham, NC 27707",
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

/** "Blueprint Robotics, Inc. · 1005 Crete St, Durham, NC 27707" */
export const COMPANY_POSTAL_LINE = `${COMPANY.legalName} · ${COMPANY.mailingAddress}`;
