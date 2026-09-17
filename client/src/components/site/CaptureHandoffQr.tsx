/**
 * The link, as something a phone can pick up.
 *
 * ## The gap this closes
 *
 * The capture page is already right for a phone: its file input carries
 * `capture="environment"`, so tapping it opens the rear camera, records, and
 * hands the file straight back for upload. No camera roll, no "now get this
 * off my phone and onto my laptop".
 *
 * None of which helps if the link is on a laptop, which it is — the site just
 * filled in a form there. Without something like this, the first thing we ask
 * of someone who has just cleared our screen is that they email themselves a
 * URL.
 *
 * ## Why a code and not a text message
 *
 * A text message needs a phone number, which is a new piece of personal data to
 * collect, store, and justify; a consent surface to go with it; a sending
 * service we do not run today; and a delivery path that carriers filter links
 * out of. All of that to move a string three feet.
 *
 * A QR code is rendered here from a string the page already has. Nothing is
 * collected, nothing is sent, nothing can fail to arrive, and it works with the
 * phone already in their hand. `qrcode` was already a dependency of this repo
 * and imported by nothing.
 *
 * ## It is an addition, never the only route
 *
 * The plain link stays next to it. A code is useless on the phone that is
 * already holding it, useless to anyone reading with a screen reader, and
 * useless if the image fails — so it renders beside the URL rather than
 * instead of it, and it hides itself entirely rather than showing a broken
 * frame if generation fails.
 */
import { useEffect, useState } from "react";

export function CaptureHandoffQr({
  url,
  label = "Scan to record on your phone",
}: {
  url: string;
  label?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Imported lazily so the QR encoder is not in the bundle for every page
        // that does not draw one, which is all of them but two.
        const { toDataURL } = await import("qrcode");
        const encoded = await toDataURL(url, { margin: 1, width: 180 });
        if (!cancelled) setDataUrl(encoded);
      } catch {
        // No code, no message. The link beside it already works, and an error
        // about a convenience is noise at the moment someone is trying to act.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "flex-start",
        marginTop: "12px",
      }}
    >
      <img
        src={dataUrl}
        // Describes what it does rather than what it is: "QR code" tells a
        // screen-reader user nothing they can act on, and the link is right
        // there for them.
        alt={label}
        width={180}
        height={180}
        style={{ border: "1px solid var(--ms-rule)", background: "#fff" }}
      />
      <span className="ms-field-hint">{label}</span>
    </span>
  );
}
