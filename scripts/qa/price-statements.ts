/**
 * What counts as a price in words a site or a deployment company reads (owner, 2026-11-12: the site pays nothing;
 * deployment companies will pay, how is not decided, and no price is stated anywhere).
 *
 * One detector for every money guard: the copy scan (`client/tests/money/no-price-copy.guard.test.ts`), the built
 * emails (`server/tests/money-emails-no-price.test.ts`) and the API payloads the site and the company receive
 * (`server/tests/money-introduction-billable-events.test.ts`).
 *
 * Read sentence by sentence:
 * - an amount of money is always a finding, negated or not ("$0", "USD 30", "30 dollars"): there is no figure to
 *   state, and a figure a sentence says is not charged is still a figure;
 * - a rate ("per month", "/mo", "per introduction") is always a finding;
 * - a payment element (checkout, card details, billing, invoice, subscription plan, Stripe, pricing) and the words
 *   fee and price are findings unless the sentence negates them within a few words before ("There is no Blueprint
 *   fee, invoice or payment step").
 *
 * A third party's figure (a cited market number, the site's own budget, a liability cap) is not Blueprint's price,
 * but it still trips the detector: each guard allows it by name, with the reason, never by a looser pattern here.
 */

export interface PriceRule {
  name: string;
  test: (sentence: string) => boolean;
}

/** A negation in the 60 characters before a match: "no", "not", "never", "nothing", "without", "nor", "n't". */
const NEGATED_BEFORE = /\b(?:no|not|never|nothing|without|nor|none)\b|n['’]t\b/i;

function unnegated(sentence: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return [...sentence.matchAll(global)].some(match => !NEGATED_BEFORE.test(sentence.slice(Math.max(0, match.index! - 60), match.index)));
}

const CURRENCY_AMOUNT = /[$€£¥]\s?\d|\b(?:USD|EUR|GBP|CAD|AUD)\s?\$?\d|\d[\d,.]*\s?(?:k|m)?\s?(?:USD|EUR|GBP|dollars?|euros?|cents?)\b/i;
const RATE = /\bper\s+(?:month|year|annum|seat|user|introduction|intro|lead|match|referral)\b|\/\s?(?:mo|month|yr|year)\b|\b(?:monthly|yearly|annual)\s+(?:fee|plan|price|subscription|charge|billing)\b/i;
const PAYMENT_ELEMENT = /\b(?:checkout|check out now|pay now|buy now|add to cart|credit card|debit card|card number|card details|billing|invoices?|invoiced|subscriptions?|subscribe to (?:a |the |our )?plan|upgrade (?:to|your plan)|paid plans?|pricing|price list|free trial|stripe|paypal)\b/i;
const FEE_OR_PRICE = /\b(?:fees?|prices?|priced)\b/i;

export const PRICE_RULES: readonly PriceRule[] = [
  { name: "an amount of money", test: sentence => CURRENCY_AMOUNT.test(sentence) },
  { name: "a rate", test: sentence => RATE.test(sentence) },
  { name: "a payment element", test: sentence => unnegated(sentence, PAYMENT_ELEMENT) },
  { name: "a fee or a price", test: sentence => unnegated(sentence, FEE_OR_PRICE) },
];

/** A text cut into sentences the way a reader meets them: at sentence ends and at line breaks. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map(sentence => sentence.trim()).filter(Boolean);
}

/** Each rule each sentence of `text` breaks, as `rule: “sentence”`. */
export function priceFindings(text: string): string[] {
  const findings: string[] = [];
  for (const sentence of sentencesOf(text))
    for (const rule of PRICE_RULES) if (rule.test(sentence)) findings.push(`${rule.name}: “${sentence}”`);
  return findings;
}

/** Words of an API payload key that would carry a price, a charge, a payment or Blueprint's own costs. */
const PRICE_KEY_WORDS = new Set(["price", "prices", "priced", "pricing", "fee", "fees", "amount", "charge", "charged",
  "charges", "invoice", "invoices", "billing", "billable", "checkout", "subscription", "payment", "payments", "stripe",
  "currency", "usd", "cost", "costs", "spend", "balance", "topup"]);

/** `priceUsd` → ["price", "usd"]; `checkout_url` → ["checkout", "url"]. */
export function keyWords(key: string): string[] {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export const isPriceKey = (key: string) => keyWords(key).some(word => PRICE_KEY_WORDS.has(word));

/** Every key path in a JSON value whose key looks like a price, and every string in it the detector flags. */
export function payloadPriceFindings(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => payloadPriceFindings(item, `${path}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
      ...(isPriceKey(key) ? [`a price-shaped key: ${path}.${key}`] : []),
      ...payloadPriceFindings(item, `${path}.${key}`)]);
  return typeof value === "string" ? priceFindings(value).map(finding => `${path}: ${finding}`) : [];
}
