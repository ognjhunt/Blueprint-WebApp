/**
 * One look for every email Blueprint sends a customer.
 *
 * Templates are written as plain text, which keeps them readable in code and
 * in every mail client. This turns that text into the branded HTML part and
 * gives the text part the same footer, so a message never arrives as a bare
 * wall of text or in a template from an older brand.
 *
 * The conversion is deliberately small:
 * - blank lines separate paragraphs; single newlines are line breaks;
 * - consecutive lines starting with "- " become a list;
 * - a paragraph that is only an https URL becomes a button. When the
 *   paragraph before it is a short label ending in ":" ("Open your task:"),
 *   that label becomes the button text instead of a separate line;
 * - any other URL is linked in place.
 * Everything else is escaped, so template text can never inject markup.
 */
import { COMPANY, COMPANY_POSTAL_LINE } from "../../client/src/data/company";

export const EMAIL_SIGN_OFF = "— The Blueprint team";

/**
 * "Hi Dana," or plain "Hi,". Site records store "there" as a placeholder
 * first name when the form left it blank; nobody is greeted by it.
 */
export function emailGreeting(firstName?: string | null): string {
  const name = String(firstName ?? "").trim().split(/\s+/)[0] ?? "";
  return name && name.toLowerCase() !== "there" && name !== "—" ? `Hi ${name},` : "Hi,";
}

const TEXT_FOOTER_MARKER = "\n\n--\n";

const INK = "#22251e";
const MUTED = "#62645d";
const GREEN = "#203d2e";
const PAPER = "#f6f5ef";
const CARD = "#fcfcf8";
const RULE = "#dcdfd4";
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_PATTERN = /https:\/\/[^\s<>"')\]]+/g;

function linkify(escaped: string): string {
  return escaped.replace(URL_PATTERN, (url) => {
    const trimmed = url.replace(/[.,;:]+$/, "");
    const rest = url.slice(trimmed.length);
    return `<a href="${trimmed}" style="color:${GREEN};text-decoration:underline;">${trimmed}</a>${rest}`;
  });
}

function isBareUrl(paragraph: string): boolean {
  return /^https:\/\/\S+$/.test(paragraph.trim());
}

function buttonHtml(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="background:${GREEN};border-radius:3px;">`
    + `<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:500;color:${PAPER};text-decoration:none;">${escapeHtml(label)}</a>`
    + "</td></tr></table>";
}

function paragraphHtml(paragraph: string): string {
  const lines = paragraph.split("\n");
  if (lines.every((line) => /^\s*- /.test(line))) {
    const items = lines
      .map((line) => `<li style="margin:0 0 6px;">${linkify(escapeHtml(line.replace(/^\s*- /, "")))}</li>`)
      .join("");
    return `<ul style="margin:0 0 18px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">${items}</ul>`;
  }
  const body = lines.map((line) => linkify(escapeHtml(line))).join("<br />");
  return `<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">${body}</p>`;
}

/** The body as HTML blocks, following the rules in the module comment. */
export function textToEmailHtml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const blocks: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const next = paragraphs[index + 1];
    // "Label:\nhttps://…" in one paragraph, the shape most templates use.
    const inline = paragraph.match(/^([^\n]{1,60}):\n(https:\/\/\S+)$/);
    if (inline) {
      blocks.push(buttonHtml(inline[1], inline[2]));
      continue;
    }
    if (next && isBareUrl(next) && /^[^\n]{1,60}:$/.test(paragraph)) {
      blocks.push(buttonHtml(paragraph.slice(0, -1), next.trim()));
      index += 1;
      continue;
    }
    if (isBareUrl(paragraph)) {
      blocks.push(buttonHtml("Open your task page", paragraph.trim()));
      continue;
    }
    blocks.push(paragraphHtml(paragraph));
  }
  return blocks.join("\n");
}

/** The same identity footer the HTML part carries, for the text part. */
export function withTextFooter(text: string): string {
  if (text.includes(TEXT_FOOTER_MARKER)) return text;
  return `${text.trimEnd()}${TEXT_FOOTER_MARKER}${COMPANY_POSTAL_LINE}\n${COMPANY.website}`;
}

export function renderBrandedEmailHtml(params: {
  subject: string;
  text: string;
  /** Shown instead of the default "Questions? Reply to this email…" line. */
  footerNote?: string;
  unsubscribeUrl?: string | null;
}): string {
  const footerNote = params.footerNote
    ?? `Questions? Reply to this email or write to ${COMPANY.emails.hello}.`;
  const unsubscribe = params.unsubscribeUrl
    ? `<br /><a href="${escapeHtml(params.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(params.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAPER};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="padding:0 4px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                  <td style="width:18px;height:18px;background:${GREEN};border-radius:2px;"></td>
                  <td style="padding-left:10px;font-family:${FONT};font-size:19px;font-weight:500;letter-spacing:-0.5px;color:${INK};">Blueprint</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="background:${CARD};border:1px solid ${RULE};border-radius:4px;padding:32px 32px 14px;">
                ${textToEmailHtml(params.text)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                ${escapeHtml(footerNote)}<br />
                ${escapeHtml(COMPANY_POSTAL_LINE)}${unsubscribe}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Both parts of a customer email from one plain-text template. */
export function brandedEmail(params: {
  subject: string;
  text: string;
  footerNote?: string;
  unsubscribeUrl?: string | null;
}): { text: string; html: string } {
  return {
    text: withTextFooter(params.text),
    html: renderBrandedEmailHtml(params),
  };
}
