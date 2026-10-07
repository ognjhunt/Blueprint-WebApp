/**
 * The shared layout for application confirmations and transactional notices.
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
const FONT = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
// PNG export of client/public/brand/mark.svg. Mail clients that block images
// still show the adjacent live-text wordmark and the complete message.
const LOGO_URL = `${COMPANY.website}/brand/email-mark.png`;

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
    return `<a class="email-link" href="${trimmed}" style="color:${GREEN};text-decoration:underline;overflow-wrap:anywhere;word-break:break-word;">${trimmed}</a>${rest}`;
  });
}

function isBareUrl(paragraph: string): boolean {
  return /^https:\/\/\S+$/.test(paragraph.trim());
}

function buttonHtml(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `<table class="email-button" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 12px;"><tr><td align="center" bgcolor="${GREEN}" style="background:${GREEN};border-radius:3px;mso-padding-alt:14px 24px;">`
    + `<a class="email-button-link" href="${safeUrl}" style="display:block;border:1px solid ${GREEN};border-radius:3px;padding:14px 24px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:500;color:${PAPER};text-align:center;text-decoration:none;mso-padding-alt:0;">${escapeHtml(label)}</a>`
    + "</td></tr></table>"
    + `<p class="email-muted" style="margin:0 0 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">If the button doesn't open, use this link: `
    + `<a class="email-link" href="${safeUrl}" style="color:${GREEN};text-decoration:underline;">${escapeHtml(label)}</a>.</p>`;
}

function paragraphHtml(paragraph: string): string {
  const lines = paragraph.split("\n");
  if (lines.every((line) => /^\s*- /.test(line))) {
    const items = lines
      .map((line) => `<li style="margin:0 0 6px;">${linkify(escapeHtml(line.replace(/^\s*- /, "")))}</li>`)
      .join("");
    return `<ul class="email-copy" style="margin:0 0 20px;padding-left:20px;font-family:${FONT};font-size:16px;line-height:1.65;color:${INK};">${items}</ul>`;
  }
  const body = lines.map((line) => linkify(escapeHtml(line))).join("<br />");
  return `<p class="email-copy" style="margin:0 0 20px;font-family:${FONT};font-size:16px;line-height:1.65;color:${INK};overflow-wrap:anywhere;word-break:break-word;">${body}</p>`;
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
      blocks.push(buttonHtml("Open your job page", paragraph.trim()));
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
    ? `<br /><a class="email-muted" href="${escapeHtml(params.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(params.subject)}</title>
    <style>
      table { border-collapse: separate; border-spacing: 0; }
      @media only screen and (max-width: 480px) {
        .email-outer { padding:24px 12px !important; }
        .email-brand { padding:24px 22px 0 !important; }
        .email-content { padding:24px 22px 8px !important; }
        .email-heading { font-size:23px !important; }
        .email-button { width:100% !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-background { background:#181f1a !important; }
        .email-card { background:#222b24 !important; border-color:#465247 !important; }
        .email-copy, .email-heading, .email-wordmark { color:${PAPER} !important; }
        .email-muted { color:#b6bdb3 !important; }
        .email-link { color:#c1d8bc !important; }
        .email-button td { background:#dce8d6 !important; }
        .email-button-link { background:#dce8d6 !important; border-color:#dce8d6 !important; color:${GREEN} !important; }
      }
    </style>
  </head>
  <body class="email-background" style="margin:0;padding:0;background:${PAPER};-webkit-text-size-adjust:100%;">
    <table class="email-background" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${PAPER}" style="background:${PAPER};">
      <tr>
        <td class="email-outer" align="center" style="padding:40px 16px;">
          <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;table-layout:fixed;">
            <tr>
              <td class="email-card" bgcolor="${CARD}" style="background:${CARD};border:1px solid ${RULE};border-radius:4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;">
                  <tr>
                    <td class="email-brand" style="padding:32px 32px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                        <td width="35" valign="middle"><img src="${LOGO_URL}" alt="" width="35" height="35" style="display:block;width:35px;height:35px;border:0;border-radius:2px;" /></td>
                        <td class="email-wordmark" valign="middle" style="padding-left:14px;font-family:${FONT};font-size:27px;line-height:35px;font-weight:500;letter-spacing:-1px;color:${INK};">${escapeHtml(COMPANY.shortName)}</td>
                      </tr></table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:28px 32px 12px;">
                      <h1 class="email-heading" style="margin:0 0 24px;font-family:${FONT};font-size:26px;line-height:1.3;font-weight:500;letter-spacing:-0.6px;color:${INK};overflow-wrap:anywhere;">${escapeHtml(params.subject)}</h1>
                      ${textToEmailHtml(params.text)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-muted" style="padding:24px 4px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};">
                ${escapeHtml(footerNote)}<br />
                ${escapeHtml(COMPANY_POSTAL_LINE)}${unsubscribe}
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
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
