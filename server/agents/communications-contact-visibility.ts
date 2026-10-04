/** Static visibility rules for public contact proof (owner decision 2026-10-04).
 * CSS is never rendered; detectably hidden content is excluded and every proof records that
 * basis. Each check fails closed (unreadable or unresolved declarations count as hiding), and
 * every scan is linear in the page size or bounded by an explicit budget. */

// Approximate CSS pixels per unit for a 16px font and ~1000px viewport/containing block.
const UNIT_PX: Record<string, number> = { "": 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6,
  em: 16, rem: 16, ex: 8, rex: 8, ch: 8, rch: 8, cap: 11, rcap: 11, ic: 16, ric: 16, lh: 19, rlh: 19, "%": 10 };
const NUMBER = /(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)([a-z]+|%)?/g;
type Measure = { n: number; unit: string; px: number };
const numbers = (value: string): Measure[] => [...value.matchAll(NUMBER)].map(([, n, unit = ""]) => ({ n: Number(n), unit,
  px: Number(n) * (UNIT_PX[unit] ?? (/^(?:[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))$/.test(unit) ? 10 : 1)) }));
const fraction = (value: string) => { const x = numbers(value)[0]; return x === undefined ? undefined : x.unit === "%" ? x.n / 100 : x.n; };
const tiny = (value: string) => { const x = numbers(value)[0]; return x !== undefined && x.px <= 1; };
// Off-screen hiding idioms (skip links, image replacement, off-canvas panels): a horizontal shift of
// 200px or more (half the containing block, or the element's own width for a transform), a
// vertical one of 500px or more, or anything beyond 5000px. Ordinary layout offsets such as
// centring (-50% transforms) or overlapping sections (-100px margins) stay visible.
type Axis = "x" | "y";
const shifted = (x: Measure | undefined, axis: Axis, ownSize = false) => x !== undefined && (x.unit === "%"
  ? x.n <= (ownSize || axis === "y" ? -100 : -50)
  : x.px >= 5000 || x.px <= (axis === "x" ? -200 : -500));
const offScreen = (value: string, axis: Axis, ownSize = false) => numbers(value).some(x => shifted(x, axis, ownSize));
/** Box shorthand components (top, right, bottom, left) per the CSS 1-4 value rules. */
const box = (list: Measure[]) => list.length === 1 ? [list[0], list[0], list[0], list[0]] : list.length === 2 ? [list[0], list[1], list[0], list[1]]
  : list.length === 3 ? [list[0], list[1], list[2], list[1]] : list.slice(0, 4);
const faint = (alpha: number | undefined) => alpha !== undefined && alpha <= 0.1;
const nearZero = (x: Measure) => Math.abs(x.unit === "%" ? x.n / 100 : x.n) <= 0.05;
const degrees = (value: string) => { const x = numbers(value)[0];
  return x === undefined ? undefined : x.n * (({ rad: 180 / Math.PI, grad: 0.9, turn: 360 } as Record<string, number>)[x.unit] ?? 1); };
const edgeOn = (angle: number | undefined) => angle !== undefined && Math.abs((Math.abs(angle) % 180) - 90) < 1;
const extent = (values: number[]) => values.reduce((a, b) => Math.max(a, b), -Infinity) - values.reduce((a, b) => Math.min(a, b), Infinity);

/** Removes CSS comments (outside strings) and legacy HTML comment markers, in one pass. */
function stripCssComments(css: string) {
  let out = "", at = 0, quote = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      out += css.slice(at, i) + " ";
      if (end < 0) return out;
      i = end + 1; at = end + 2;
    }
  }
  return (out + css.slice(at)).replace(/<!--|-->/g, " ");
}

function transparentColor(value: string) {
  // Any transparent component (also inside color-mix or light-dark) may hide the text.
  if (/\btransparent\b/.test(value)) return true;
  const hex = value.match(/^#([0-9a-f]{4}|[0-9a-f]{8})\b/);
  if (hex) return parseInt(hex[1].length === 4 ? hex[1][3].repeat(2) : hex[1].slice(6), 16) / 255 <= 0.1;
  const fn = value.match(/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^)]*)\)/);
  if (!fn) return false;
  const slash = fn[1].lastIndexOf("/"), parts = fn[1].split(",");
  return faint(fraction(slash >= 0 ? fn[1].slice(slash + 1) : parts.length === 4 ? parts[3] : ""));
}

// The lookbehind keeps the scan linear: a function name only starts at a word boundary.
const TRANSFORM_FUNCTION = /(?<![a-z0-9])([a-z0-9]+)\(([^()]*)\)/g;
function hidingTransform(value: string) {
  for (const [, name, args] of value.matchAll(TRANSFORM_FUNCTION)) {
    const list = numbers(args), parts = args.split(",");
    if (/^scale(?:x|y|z|3d)?$/.test(name) && list.some(nearZero)) return true;
    if (name === "translate" || name === "translate3d") { if (shifted(list[0], "x", true) || shifted(list[1], "y", true)) return true; }
    if (name === "translatex" && shifted(list[0], "x", true)) return true;
    if (name === "translatey" && shifted(list[0], "y", true)) return true;
    if (/^skew[xy]?$/.test(name) && parts.some(part => edgeOn(degrees(part)))) return true;
    if (/^rotate[xy]$/.test(name) && edgeOn(degrees(args))) return true;
    if (name === "rotate3d" && list.length >= 4 && (list[0].n !== 0 || list[1].n !== 0) && edgeOn(degrees(parts.at(-1) ?? ""))) return true;
    if (name === "matrix" && list.length === 6) {
      const [a, b, c, d, e, f] = list.map(x => x.n);
      if ((Math.abs(a) <= 0.05 && Math.abs(b) <= 0.05) || (Math.abs(c) <= 0.05 && Math.abs(d) <= 0.05)
        || shifted({ n: e, unit: "", px: e }, "x") || shifted({ n: f, unit: "", px: f }, "y")) return true;
    }
    if (name === "matrix3d" && list.length === 16) {
      const m = list.map(x => x.n);
      if ((Math.abs(m[0]) <= 0.05 && Math.abs(m[1]) <= 0.05) || (Math.abs(m[4]) <= 0.05 && Math.abs(m[5]) <= 0.05)
        || shifted({ n: m[12], unit: "", px: m[12] }, "x") || shifted({ n: m[13], unit: "", px: m[13] }, "y")) return true;
    }
  }
  return false;
}

// Properties whose unresolved value (custom property, attr(), env() or a CSS escape) fails closed.
const VISIBILITY_PROPERTY = /^(?:display|visibility|content-visibility|opacity|color|text-fill-color|filter|clip|clip-path|mask(?:-image)?|transform|scale|translate|rotate|font-size|font|text-indent|zoom)$/;
const SIZE = /^(?:font-size|width|height|max-width|max-height|inline-size|block-size|max-inline-size|max-block-size)$/;
// Offsets that move the element itself, by axis (end-side margins only move what follows).
const X_OFFSET = /^(?:left|right|inset-inline(?:-start|-end)?|margin-left|margin-inline-start)$/;
const Y_OFFSET = /^(?:top|bottom|inset-block(?:-start|-end)?|margin-top|margin-block-start)$/;
const MASK = /^mask(?:-image|-border(?:-source)?|-box-image)?$/;

function hidingDeclaration(property: string, value: string) {
  if (VISIBILITY_PROPERTY.test(property) && (/\b(?:var|attr|env)\(/.test(value) || value.includes("\\"))) return true;
  if (property === "display") return /^none\b/.test(value);
  if (property === "visibility") return /^(?:hidden|collapse)\b/.test(value);
  if (property === "content-visibility") return /^hidden\b/.test(value);
  if (property === "opacity" || property === "zoom") return faint(fraction(value));
  if (property === "filter") return [...value.matchAll(/opacity\(([^()]*)\)/g)].some(([, args]) => faint(fraction(args)));
  if (property === "color" || property === "text-fill-color") return transparentColor(value);
  if (SIZE.test(property)) return tiny(value);
  if (property === "font") return value.split(/\s+/).some(token => /^(?:0|(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?(?:[a-z]+|%))(?:\/|$)/.test(token) && tiny(token));
  if (X_OFFSET.test(property)) return offScreen(value, "x");
  if (Y_OFFSET.test(property)) return offScreen(value, "y");
  if (property === "inset" || property === "margin") {
    const [top, right, bottom, left] = box(numbers(value));
    return shifted(top, "y") || shifted(left, "x") || (property === "inset" && (shifted(right, "x") || shifted(bottom, "y")));
  }
  if (property === "margin-inline" || property === "margin-block") return shifted(numbers(value)[0], property === "margin-inline" ? "x" : "y");
  if (property === "text-indent") return offScreen(value, "x") || numbers(value).some(x => x.unit === "%" ? x.n >= 100 : x.px >= 999);
  if (property === "transform") return hidingTransform(value);
  if (property === "scale") return numbers(value).some(nearZero);
  if (property === "translate") { const list = numbers(value); return shifted(list[0], "x", true) || shifted(list[1], "y", true); }
  // A bidirectional override displays the text in a different order than it is written.
  if (property === "unicode-bidi") return /\b(?:bidi-override|isolate-override)\b/.test(value);
  if (property === "rotate") {
    const list = numbers(value), axis = /(?:^|\s)[xy](?:\s|$)/.test(value) || (list.length >= 4 && (list[0].n !== 0 || list[1].n !== 0));
    return axis && edgeOn(degrees(value.trim().split(/\s+/).at(-1) ?? ""));
  }
  if (property === "clip") return /\brect\(/.test(value);
  if (property === "clip-path") {
    if (/\b(?:url|path|shape)\(/.test(value)) return true;
    const shape = value.match(/\b(inset|circle|ellipse|polygon|xywh|rect)\(([^()]*)\)/);
    if (!shape) return false;
    const list = numbers(shape[2]);
    if (shape[1] === "inset") return list.some(x => x.unit === "%" && x.n >= 50);
    if (shape[1] === "circle" || shape[1] === "ellipse") return list.length > 0 && list[0].px <= 0.5;
    if (shape[1] === "polygon") {
      const points = shape[2].split(",").map(numbers).filter(point => point.length >= 2);
      return !points.length || extent(points.map(p => p[0].px)) <= 1.5 || extent(points.map(p => p[1].px)) <= 1.5;
    }
    return list.every(x => x.n === 0);
  }
  if (MASK.test(property)) return !/^(?:none|initial|unset|revert(?:-layer)?)$/.test(value);
  // An image as an element's content replaces its text.
  if (property === "content") return /\b(?:url|image-set|(?:repeating-)?(?:linear|radial|conic)-gradient)\(/.test(value);
  return false;
}

/** True when an inline or embedded declaration block detectably hides its element's text. */
export function hidingStyle(style: string) {
  if (!style.trim()) return false;
  for (const declaration of stripCssComments(style).toLowerCase().split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).replace(/!\s*important\s*$/, "").trim();
    // An escaped or reference-encoded property name is never decoded statically.
    if (name.includes("\\") || /&[a-z][a-z\d]*;/.test(name)) return true;
    if (/&[a-z][a-z\d]*;/.test(value) && VISIBILITY_PROPERTY.test(name.replace(/^-(?:webkit|moz|ms|o)-/, ""))) return true;
    if (hidingDeclaration(name.replace(/^-(?:webkit|moz|ms|o)-/, ""), value)) return true;
  }
  return false;
}

type Compound = { tag?: string; ids: string[]; classes: string[];
  attributes: { name: string; operator?: string; value?: string }[] };
export type HidingRules = { index: Map<string, Map<string, Compound>>; collapsed: Set<string>; count: number; checks: number };
// Lowercased values and whitespace tokens are computed once per element and attribute.
export type ElementFacts = { tag: string; id?: string; classes: Set<string>; attrs: Record<string, string>;
  lower: Map<string, string>; tokens: Map<string, Set<string>> };
// Distinct hiding rules, distinct rules per index key, and selector checks per page.
const MAX_HIDING_RULES = 10000, MAX_RULES_PER_KEY = 256, MAX_RULE_CHECKS = 2_000_000, MAX_SELECTOR_LENGTH = 4096;
const limit = () => { throw new Error("contact_resolution_markup_limit"); };

/** Splits on a top-level character, ignoring parentheses, brackets, strings and escapes. */
function splitTopLevel(text: string, separator: (ch: string) => boolean) {
  const parts: string[] = []; let depth = 0, quote = "", start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    else if (!depth && separator(ch)) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

/** The compound selectors of a complex selector, left to right (combinators dropped). */
const selectorCompounds = (selector: string) => splitTopLevel(selector.trim(), ch => /[\s>+~]/.test(ch)).filter(Boolean);

function matchingParen(text: string, open: number) {
  let depth = 0, quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  return -1;
}

const IDENT = /-?(?:[_a-z\u00a0-\uffff]|\\[0-9a-f]{1,6}\s?|\\[^\n\r\f0-9a-f])(?:[-\w\u00a0-\uffff]|\\[0-9a-f]{1,6}\s?|\\[^\n\r\f0-9a-f])*/iy;
const ATTRIBUTE = /\[\s*((?:[-\w]|\\.)+)\s*(?:([~|^$*]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|((?:[^\]\s\\]|\\.)+))\s*(?:[is]\s*)?)?\]/iy;
const PSEUDO = /(::?)(-?[a-z][-a-z0-9]*)/iy;
const ELEMENT_TEXT_PSEUDO = /^(?:first-line|first-letter)$/;
const LEGACY_PSEUDO_ELEMENT = /^(?:before|after|first-line|first-letter)$/;
const unescapeCss = (name: string) => name.replace(/\\([0-9a-f]{1,6})\s?|\\([\s\S])/gi, (_all, hex: string | undefined, ch: string | undefined) => {
  if (hex === undefined) return ch ?? "";
  const code = parseInt(hex, 16);
  return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : "\ufffd";
});

/** One compound selector; conditions (pseudo-classes) are ignored, so a match may over-exclude
 * but never under-exclude. Undefined for syntax it cannot read or for generated content only. */
function parseCompound(text: string) {
  const compound: Compound = { ids: [], classes: [], attributes: [] };
  let at = 0, conditional = false;
  const sticky = (pattern: RegExp) => { pattern.lastIndex = at; const match = pattern.exec(text); if (match) at = pattern.lastIndex; return match; };
  if (text[0] === "*") { compound.tag = "*"; at = 1; }
  else { const tag = sticky(IDENT); if (tag) compound.tag = unescapeCss(tag[0]).toLowerCase(); }
  while (at < text.length) {
    const ch = text[at];
    if (ch === "." || ch === "#") {
      at += 1; const name = sticky(IDENT);
      if (!name) return undefined;
      (ch === "." ? compound.classes : compound.ids).push(unescapeCss(name[0]).toLowerCase());
    } else if (ch === "[") {
      const match = sticky(ATTRIBUTE);
      if (!match) return undefined;
      const raw = match[3] ?? match[4] ?? match[5];
      compound.attributes.push({ name: unescapeCss(match[1]).toLowerCase(), operator: match[2],
        value: raw === undefined ? undefined : unescapeCss(raw).toLowerCase() });
    } else if (ch === ":") {
      const match = sticky(PSEUDO);
      if (!match) return undefined;
      const name = match[2].toLowerCase(), element = match[1] === "::" || LEGACY_PSEUDO_ELEMENT.test(name);
      if (text[at] === "(") {
        const close = matchingParen(text, at);
        if (close < 0) return undefined;
        at = close + 1;
      }
      // Hiding generated content (::before, ::marker, ...) does not hide the element's own text.
      if (element && !ELEMENT_TEXT_PSEUDO.test(name)) return undefined;
      if (!element) conditional = true;
    } else return undefined;
  }
  return { compound, conditional };
}

const keyed = (c: Compound) => c.ids.length > 0 || c.classes.length > 0 || c.attributes.length > 0;

/** The subject compound a hiding rule applies to. Ancestors and conditions are ignored, so a
 * class, id or attribute subject over-excludes; a bare element type counts only as a whole,
 * unconditional selector, since it would otherwise exclude every element of that type. Rules
 * a static reader cannot evaluate are an accepted limit: proofs record that CSS was not rendered. */
function selectorSubject(selector: string): Compound | undefined {
  const compounds = selectorCompounds(selector);
  const subject = compounds.length && !compounds[0].startsWith("@") ? parseCompound(compounds.at(-1)!) : undefined;
  if (!subject) return undefined;
  return keyed(subject.compound) || (compounds.length === 1 && !subject.conditional) ? subject.compound : undefined;
}

/** Every selector of a style rule whose own declarations hide, in one linear pass. Handles nested
 * rules, strings, grouping at-rules and blocks left open at the end of the sheet (closed there,
 * as browsers do). */
function forEachHidingSelector(css: string, visit: (selector: string) => void) {
  type Block = { selectors: string[] | null; declarations: string; skip: boolean };
  const stack: Block[] = [{ selectors: null, declarations: "", skip: false }];
  // Declarations are evaluated once per block, however many selectors share them.
  const close = () => { const block = stack.pop()!;
    if (!block.skip && block.selectors?.length && hidingStyle(block.declarations)) for (const s of block.selectors) visit(s); };
  let quote = "", start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "\\") { i++; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch !== "{" && ch !== "}") continue;
    const text = css.slice(start, i), block = stack.at(-1)!; start = i + 1;
    if (ch === "}") { block.declarations += text; if (stack.length > 1) close(); continue; }
    // A nested rule's prelude follows the enclosing block's last declaration.
    const cut = text.lastIndexOf(";"), prelude = text.slice(cut + 1).trim();
    block.declarations += text.slice(0, cut + 1);
    const atRule = /^@([-a-z]+)/i.exec(prelude)?.[1]?.toLowerCase();
    const grouping = atRule !== undefined && /^(?:media|supports|layer|container|scope|document|-moz-document|starting-style)$/.test(atRule);
    let selectors = block.selectors;
    if (atRule === undefined) {
      const own = splitTopLevel(prelude, c => c === ",").map(s => s.trim()).filter(Boolean);
      selectors = block.selectors ? block.selectors.flatMap(parent => own.map(child => child.includes("&") ? child.replaceAll("&", parent) : `${parent} ${child}`)) : own;
      // Nesting can multiply selector length at every level ("&&&&" expands each parent copy).
      if (selectors.length > 1024 || selectors.some(selector => selector.length > MAX_SELECTOR_LENGTH)) limit();
    }
    stack.push({ selectors, declarations: "", skip: block.skip || (atRule !== undefined && !grouping) });
    if (stack.length > 64) limit();
  }
  stack.at(-1)!.declarations += css.slice(start);
  while (stack.length > 1) close();
}

const ruleKey = (c: Compound) => c.ids.length ? `#${c.ids[0]}` : c.classes.length ? `.${c.classes[0]}`
  : c.tag && c.tag !== "*" ? c.tag : c.attributes.length ? `[${c.attributes[0].name}` : "*";

/** The bare compound an index key stands for (no further conditions). */
function keyCompound(key: string): Compound {
  const subject: Compound = { ids: [], classes: [], attributes: [] };
  if (key.startsWith("#")) subject.ids.push(key.slice(1));
  else if (key.startsWith(".")) subject.classes.push(key.slice(1));
  else if (key.startsWith("[")) subject.attributes.push({ name: key.slice(1) });
  else subject.tag = key;
  return subject;
}

/** Hiding rules from embedded style sheets, indexed for bounded matching. A key with more
 * distinct rules than the per-key budget collapses to its bare selector (over-excludes). */
export function hidingRules(sheets: readonly string[]): HidingRules {
  const rules: HidingRules = { index: new Map(), collapsed: new Set(), count: 0, checks: 0 };
  for (const sheet of sheets) {
    forEachHidingSelector(stripCssComments(sheet), selector => {
      const subject = selectorSubject(selector);
      if (!subject) return;
      const key = ruleKey(subject);
      if (rules.collapsed.has(key)) return;
      const bucket = rules.index.get(key) ?? new Map<string, Compound>(), identity = JSON.stringify(subject);
      if (bucket.has(identity)) return;
      if (++rules.count > MAX_HIDING_RULES) limit();
      if (bucket.size >= MAX_RULES_PER_KEY) {
        rules.collapsed.add(key);
        rules.index.set(key, new Map([["collapsed", keyCompound(key)]]));
        return;
      }
      rules.index.set(key, bucket.set(identity, subject));
    });
  }
  return rules;
}

function attributeMatches(element: ElementFacts, name: string, operator: string | undefined, expected: string | undefined) {
  const actual = element.attrs[name];
  if (actual === undefined) return false;
  if (!operator || expected === undefined) return true;
  let value = element.lower.get(name);
  if (value === undefined) { value = actual.toLowerCase(); element.lower.set(name, value); }
  if (operator === "=") return value === expected;
  if (operator === "~=") {
    let tokens = element.tokens.get(name);
    if (tokens === undefined) { tokens = new Set(value.split(/\s+/).filter(Boolean)); element.tokens.set(name, tokens); }
    return tokens.has(expected);
  }
  if (operator === "|=") return value === expected || value.startsWith(`${expected}-`);
  if (operator === "^=") return expected !== "" && value.startsWith(expected);
  if (operator === "$=") return expected !== "" && value.endsWith(expected);
  return expected !== "" && value.includes(expected);
}

/** Class and id comparisons are case-insensitive, as quirks-mode pages match them. */
export function elementFacts(tag: string, attrs: Record<string, string>): ElementFacts {
  return { tag, id: attrs.id?.toLowerCase(), classes: new Set((attrs.class ?? "").toLowerCase().split(/\s+/).filter(Boolean)), attrs, lower: new Map(), tokens: new Map() };
}
const compoundMatches = (c: Compound, e: ElementFacts) => (!c.tag || c.tag === "*" || c.tag === e.tag)
  && c.ids.every(id => id === e.id) && c.classes.every(name => e.classes.has(name))
  && c.attributes.every(a => attributeMatches(e, a.name, a.operator, a.value));

/** True when an embedded hiding rule selects the element. */
export function matchesHidingRule(rules: HidingRules, element: ElementFacts) {
  if (!rules.count) return false;
  const keys = new Set([...(element.id !== undefined ? [`#${element.id}`] : []), ...[...element.classes].map(name => `.${name}`), element.tag,
    ...Object.keys(element.attrs).map(name => `[${name}`), "*"]);
  for (const key of keys) {
    for (const compound of rules.index.get(key)?.values() ?? []) {
      if (++rules.checks > MAX_RULE_CHECKS) limit();
      if (compoundMatches(compound, element)) return true;
    }
  }
  return false;
}
