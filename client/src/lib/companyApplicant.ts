/**
 * A deployment company's name and website as a site reads them before it presses Accept (stress test round 2,
 * 2026-11-24: "Zed Robotics · call 415 555 0199" and "https://wa.me/14155550199" reached the site before Accept, though
 * a company's contact details are given only by the introduction the site asks for).
 *
 * - The name holds no contact detail: no phone number, email, handle or web address other than the company's own
 *   website's ("Covariant.ai" with https://covariant.ai is its name). An application with one is refused; a name stored
 *   before this rule that holds one is not shown, and the site reads the company's letter.
 * - The website is the company's own: an http or https address whose host is not a way to message or call someone
 *   (wa.me, t.me, m.me …) or a link shortener, with no phone number in its host. The site reads only its origin
 *   ("https://acme.example"), never a path, a query or a port.
 */
import { containsContactDetails } from "./contactRedaction";

/**
 * Hosts whose address reaches a person rather than a company's website: messaging and calling apps, contact pages of
 * link-in-bio services, and link shorteners (which hide where they lead). A subdomain of one counts too.
 */
export const CONTACT_OR_SHORTENER_HOSTS: readonly string[] = [
  // Messaging and calling.
  "wa.me", "whatsapp.com", "whatsapp.net", "t.me", "telegram.me", "telegram.dog", "telegram.org", "m.me", "messenger.com",
  "signal.me", "signal.group", "viber.me", "viber.com", "line.me", "lin.ee", "wechat.com", "weixin.qq.com", "kakao.com",
  "skype.com", "join.skype.com", "zoom.us", "meet.google.com", "discord.gg", "discord.com", "threema.id", "wire.com",
  "calendly.com", "cal.com", "linktr.ee", "beacons.ai", "bio.link", "carrd.co",
  // Link shorteners.
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "g.co", "ow.ly", "buff.ly", "is.gd", "v.gd", "rebrand.ly", "cutt.ly",
  "shorturl.at", "tiny.cc", "lnkd.in", "rb.gy", "s.id", "t.ly", "short.io", "bl.ink", "tr.im", "qr.ae", "trib.al", "dlvr.it",
  "shor.by", "msha.ke", "x.gd", "y2u.be", "youtu.be", "amzn.to", "fb.me", "ift.tt", "1url.com",
];

/** The hostname of a website address, lower case and without "www." or a final dot, or null when it is not http(s). */
function httpHost(website: string): { protocol: string; host: string } | null {
  let url: URL;
  try { url = new URL(website.trim()); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return host ? { protocol: url.protocol, host } : null;
}

const bare = (host: string) => host.replace(/^www\./, "");

/** Why a website address is not one a site may read as the company's own, or null when it is. */
export function applicantWebsiteProblem(website: unknown): "not_a_website" | "contact_or_shortener" | "phone_in_address" | null {
  if (typeof website !== "string") return "not_a_website";
  const parsed = httpHost(website);
  if (!parsed) return "not_a_website";
  const host = bare(parsed.host);
  if (CONTACT_OR_SHORTENER_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) return "contact_or_shortener";
  // A host with seven digits or more may be a phone number (or an IP address): never a company's website as a site reads it.
  if ((host.match(/\d/g)?.length ?? 0) >= 7) return "phone_in_address";
  return null;
}

/** The website's origin as the site reads it ("https://acme.example"), or null when the address may not be shown. */
export function applicantWebsiteOrigin(website: unknown): string | null {
  if (applicantWebsiteProblem(website) !== null) return null;
  const parsed = httpHost(website as string)!;
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Whether a company's name holds a contact detail: a phone number, an email, a handle, a link or a web address other
 * than its own website's (which the site reads anyway).
 */
export function applicantNameHoldsContactDetails(name: string, website?: string | null): boolean {
  const host = typeof website === "string" ? httpHost(website)?.host : undefined;
  const own = host ? [host, bare(host)] : [];
  // The website's own host, standing alone (never the end of an email address, "sales@zed.example").
  const rest = own.reduce((text, domain) => text.replace(new RegExp(`(?<![\\p{L}\\p{N}@._-])${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
    + "(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])", "giu"), " "), name.normalize("NFKC"));
  return containsContactDetails(rest);
}

/** Said when an application's company name holds a contact detail. */
export const APPLICATION_NAME_HOLDS_CONTACT = "Give your company's name without a phone number, email or web address. "
  + "Sites get your contact details only when they ask to be introduced, and your website goes in its own field.";
/** Said when an application's website is not one a site may read as the company's own. */
export const APPLICATION_WEBSITE_NOT_OWN = "Give your company's own website, starting with https:// or http://. A messaging, "
  + "calling or booking link, a link shortener and an address with a phone number in it are not accepted.";
