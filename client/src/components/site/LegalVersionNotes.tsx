import { useState } from "react";
import { X } from "lucide-react";
import {
  PREVIOUS_PRIVACY_URL,
  PREVIOUS_PRIVACY_VERSION,
  PREVIOUS_TERMS_URL,
  PREVIOUS_TERMS_VERSION,
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
  },
  privacy: {
    name: "Privacy Policy",
    verb: { future: "takes", past: "took" },
    current: { version: PRIVACY_VERSION, url: PRIVACY_URL },
    previous: { version: PREVIOUS_PRIVACY_VERSION, url: PREVIOUS_PRIVACY_URL },
  },
} as const;

/** Under the effective date of the current version. */
export function CurrentLegalVersionNote({ document }: { document: LegalDocument }) {
  const doc = documents[document];
  const previous = <a href={doc.previous.url}>previous version</a>;
  return legalUpdatePending() ? (
    <p className="ms-legal-version">
      This version takes effect on {legalEffectiveDate(doc.current.version)}. Until then, the {previous} (effective{" "}
      {legalEffectiveDate(doc.previous.version)}) applies.
    </p>
  ) : (
    <p className="ms-legal-version">
      This version replaced the {previous} (effective {legalEffectiveDate(doc.previous.version)}).
    </p>
  );
}

/** Under the effective date of the frozen previous version. */
export function PreviousLegalVersionNote({ document }: { document: LegalDocument }) {
  const doc = documents[document];
  const date = legalEffectiveDate(doc.current.version);
  return legalUpdatePending() ? (
    <p className="ms-legal-version">
      This version applies until {date}, when the <a href={doc.current.url}>updated {doc.name}</a> {doc.verb.future} effect.
    </p>
  ) : (
    <p className="ms-legal-version">
      This version applied until {date}, when the <a href={doc.current.url}>current {doc.name}</a> {doc.verb.past} effect.
    </p>
  );
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
