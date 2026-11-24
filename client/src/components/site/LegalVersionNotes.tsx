import { useState } from "react";
import { X } from "lucide-react";
import { COMPANY } from "@/data/company";
import {
  BYGONE_PRIVACY_VERSION,
  BYGONE_TERMS_VERSION,
  EARLIER_PRIVACY_VERSION,
  EARLIER_TERMS_VERSION,
  FORMER_PRIVACY_VERSION,
  FORMER_TERMS_VERSION,
  LAPSED_TERMS_VERSION,
  OLDER_PRIVACY_VERSION,
  OLDER_TERMS_VERSION,
  PREVIOUS_PRIVACY_URL,
  PREVIOUS_PRIVACY_VERSION,
  PREVIOUS_TERMS_URL,
  PREVIOUS_TERMS_VERSION,
  PRIOR_PRIVACY_VERSION,
  PAST_PRIVACY_VERSION,
  PAST_TERMS_VERSION,
  PRIOR_TERMS_VERSION,
  PRIVACY_URL,
  PRIVACY_VERSION,
  TERMS_URL,
  TERMS_VERSION,
  legalEffectiveAtMs,
  legalEffectiveDate,
  legalUpdatePending,
} from "@/lib/legalAcceptance";

/**
 * How the Terms and Privacy Policy say which version is in force.
 *
 * Owner decision (2026-10-15): an update is published with a future effective
 * date, the previous version stays in force until then, and a site banner
 * announces it. No email is sent for this update.
 */
type LegalDocument = "terms" | "privacy";

const documents = {
  terms: {
    name: "Terms",
    verb: { future: "take", past: "took" },
    current: { version: TERMS_VERSION, url: TERMS_URL },
    previous: { version: PREVIOUS_TERMS_VERSION, url: PREVIOUS_TERMS_URL },
    email: COMPANY.emails.legal,
  },
  privacy: {
    name: "Privacy Policy",
    verb: { future: "takes", past: "took" },
    current: { version: PRIVACY_VERSION, url: PRIVACY_URL },
    previous: { version: PREVIOUS_PRIVACY_VERSION, url: PREVIOUS_PRIVACY_URL },
    email: COMPANY.emails.privacy,
  },
} as const;

/**
 * Every version before the current one that this repository keeps, newest first (launch copy g-047, Terms and Privacy
 * 2026-11-21.1): a site's job keeps the Privacy version it was started under, so a site can see which version was in
 * force when. Only the previous version is routed; the older pages are kept byte for byte and their page shells print
 * the previous slot's date, so they are listed by date, not linked. Versions before 2026-11-02.1 are not kept here.
 */
const pastVersions: Record<LegalDocument, ReadonlyArray<{ version: string; url?: string; replacedSameDay?: true }>> = {
  terms: [
    // 2026-11-23.3 was replaced by 2026-11-23.4 on the day it took effect.
    { version: PREVIOUS_TERMS_VERSION, url: PREVIOUS_TERMS_URL, replacedSameDay: true },
    // 2026-11-23.2 was replaced by 2026-11-23.3 on the day it took effect.
    { version: OLDER_TERMS_VERSION, replacedSameDay: true },
    { version: FORMER_TERMS_VERSION },
    { version: PRIOR_TERMS_VERSION },
    { version: PAST_TERMS_VERSION },
    { version: BYGONE_TERMS_VERSION },
    // 2026-11-12.1 was replaced by 2026-11-12.2 on the day it took effect.
    { version: LAPSED_TERMS_VERSION, replacedSameDay: true },
    { version: EARLIER_TERMS_VERSION },
  ],
  privacy: [
    // 2026-11-23.1 was replaced by 2026-11-23.2 on the day it took effect.
    { version: PREVIOUS_PRIVACY_VERSION, url: PREVIOUS_PRIVACY_URL, replacedSameDay: true },
    { version: OLDER_PRIVACY_VERSION },
    { version: FORMER_PRIVACY_VERSION },
    { version: PRIOR_PRIVACY_VERSION },
    { version: PAST_PRIVACY_VERSION },
    // 2026-11-12.2 has the same words as 2026-11-12.1, in force from the same day: one entry.
    { version: BYGONE_PRIVACY_VERSION },
    { version: EARLIER_PRIVACY_VERSION },
  ],
};

/**
 * The version id beside each date (stress test, 2026-11-24): several versions took effect on November 23, 2026, so a
 * date alone cannot tell them apart. The id is said here, in the shared notes under each page's effective date, so no
 * pinned page changes (`legalPages.pinned.test.ts` digests each page's own source file, not this one).
 */
export const versionLine = (version: string) => `Version ${version}`;

function PastLegalVersions({ document }: { document: LegalDocument }) {
  const doc = documents[document];
  return (
    <details className="ms-legal-versions">
      <summary>Past versions</summary>
      <ul>
        {pastVersions[document].map(({ version, url, replacedSameDay }) => {
          const label = `${versionLine(version)}, effective ${legalEffectiveDate(version)}${replacedSameDay ? ", replaced the same day" : ""}`;
          return <li key={version}>{url ? <a href={url}>{label}</a> : label}</li>;
        })}
      </ul>
      <p>
        Only the previous version is online. To ask for another, or for one from before November 2, 2026, email{" "}
        <a href={`mailto:${doc.email}`}>{doc.email}</a>.
      </p>
    </details>
  );
}

/** Under the effective date of the current version. */
export function CurrentLegalVersionNote({ document }: { document: LegalDocument }) {
  const doc = documents[document];
  const previous = <a href={doc.previous.url}>previous version</a>;
  return <>
    <p className="ms-legal-version">{versionLine(doc.current.version)}.</p>
    {legalUpdatePending() ? (
      <p className="ms-legal-version">
        This version takes effect on {legalEffectiveDate(doc.current.version)}. Until then, the {previous} (version{" "}
        {doc.previous.version}, effective {legalEffectiveDate(doc.previous.version)}) applies.
      </p>
    ) : (
      <p className="ms-legal-version">
        This version replaced the {previous} (version {doc.previous.version}, effective {legalEffectiveDate(doc.previous.version)}).
      </p>
    )}
    <PastLegalVersions document={document} />
  </>;
}

/** Under the effective date of the frozen previous version. */
export function PreviousLegalVersionNote({ document }: { document: LegalDocument }) {
  const doc = documents[document];
  const date = legalEffectiveDate(doc.current.version);
  return <>
    <p className="ms-legal-version">{versionLine(doc.previous.version)}.</p>
    {legalUpdatePending() ? (
      <p className="ms-legal-version">
        This version applies until {date}, when the <a href={doc.current.url}>updated {doc.name}</a> (version{" "}
        {doc.current.version}) {doc.verb.future} effect.
      </p>
    ) : (
      <p className="ms-legal-version">
        This version applied until {date}, when the <a href={doc.current.url}>current {doc.name}</a> (version{" "}
        {doc.current.version}) {doc.verb.past} effect.
      </p>
    )}
  </>;
}

const DISMISS_KEY = "blueprint.legalUpdateNotice.dismissed";
const NOTICE_ID = `${TERMS_VERSION}|${PRIVACY_VERSION}`;

function noticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === NOTICE_ID;
  } catch {
    return false;
  }
}

/** The site-wide notice of an announced update, shown until it takes effect. */
export function LegalUpdateBanner() {
  const [dismissed, setDismissed] = useState(noticeDismissed);
  if (dismissed || !legalUpdatePending()) return null;
  const effective = legalEffectiveAtMs(TERMS_VERSION) >= legalEffectiveAtMs(PRIVACY_VERSION) ? TERMS_VERSION : PRIVACY_VERSION;
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, NOTICE_ID);
    } catch {
      // Storage can be blocked; the notice still closes for this page view.
    }
    setDismissed(true);
  };
  return (
    <div className="legal-update-banner" role="region" aria-label="Terms and Privacy Policy update">
      <p>
        Our updated <a href={TERMS_URL}>Terms of Service</a> and <a href={PRIVACY_URL}>Privacy Policy</a> take effect on{" "}
        {legalEffectiveDate(effective)}. Until then, the previous versions apply.
      </p>
      <button type="button" aria-label="Dismiss the Terms and Privacy Policy update notice" onClick={dismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
