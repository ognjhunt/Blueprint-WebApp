/**
 * A small writer of text-only PDF documents (PDF 1.4), for briefs Blueprint makes from words it already shows on a page
 * (`companyJobSummary.ts`). No dependency: two of the standard fonts every PDF reader has (Helvetica and Helvetica-Bold,
 * never embedded), in WinAnsi encoding, laid out on US Letter pages with a footer and page numbers, and links as URI
 * annotations. The streams are not compressed, so the text can be read back (`server/tests/helpers/pdfText.ts`).
 *
 * What it cannot do: draw a character outside WinAnsi (Western European letters and the usual punctuation). A text with
 * one is not drawn with a gap: `pdfCanShow` says so beforehand, and the caller writes its own line in its place.
 */

export type PdfStyle = "regular" | "bold";

/** One thing on the page, top to bottom. */
export type PdfBlock =
  | { kind: "title"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "paragraph"; text: string; tone?: "body" | "hint" | "quote" }
  | { kind: "bullets"; items: readonly string[] }
  | { kind: "rows"; rows: ReadonlyArray<{ label: string; value: string }> }
  | { kind: "link"; text: string; url: string };

export interface PdfDocument {
  /** The document's title in its properties. */
  title: string;
  blocks: readonly PdfBlock[];
  /** Said at the foot of every page, beside its page number. */
  footer: string;
}

/* ----------------------------------------------------------------- characters */

/** WinAnsi's codes from 128 to 159 that differ from Latin-1. */
const WIN_ANSI_HIGH: Readonly<Record<number, number>> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Typography that only changes how a text is set, never what it says: other widths of space become a space, other
 * hyphens and the minus sign a hyphen, zero-width characters nothing, and line ends one kind.
 */
function typeset(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\t -   　]/g, " ")
    .replace(/[‐‑−]/g, "-").replace(/[​‌‍⁠﻿]/g, "");
}

function winAnsiCode(char: string): number | null {
  const point = char.codePointAt(0)!;
  if (point === 0x0a) return 0x0a;
  if ((point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff)) return point;
  return WIN_ANSI_HIGH[point] ?? null;
}

/** Whether every character of the text can be drawn in these fonts. */
export function pdfCanShow(text: string): boolean {
  for (const char of typeset(text)) if (winAnsiCode(char) === null) return false;
  return true;
}

/* ----------------------------------------------------------------- widths (Adobe's metrics, per 1000 em) */

/** Helvetica and Helvetica-Bold, characters 32 to 126. */
const ASCII_WIDTHS: Readonly<Record<PdfStyle, readonly number[]>> = {
  regular: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722,
    778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278,
    556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  bold: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722,
    778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333,
    611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
};
/** The other WinAnsi characters that are not a letter with an accent: [regular, bold]. */
const OTHER_WIDTHS: Readonly<Record<string, readonly [number, number]>> = {
  "‘": [222, 278], "’": [222, 278], "‚": [222, 278], "“": [333, 500], "”": [333, 500], "„": [333, 500],
  "–": [556, 556], "—": [1000, 1000], "•": [350, 350], "…": [1000, 1000], "·": [278, 278],
  "°": [400, 400], "×": [584, 584], "÷": [584, 584], "±": [584, 584], "¬": [584, 584],
  "€": [556, 556], "£": [556, 556], "¢": [556, 556], "¥": [556, 556], "¤": [556, 556], "§": [556, 556],
  "©": [737, 737], "®": [737, 737], "™": [1000, 1000], "†": [556, 556], "‡": [556, 556], "‰": [1000, 1000],
  "‹": [333, 333], "›": [333, 333], "«": [556, 556], "»": [556, 556], "¡": [333, 333], "¿": [611, 611],
  "ª": [370, 370], "º": [365, 365], "¼": [834, 834], "½": [834, 834], "¾": [834, 834], "µ": [556, 611],
  "¶": [537, 556], "ß": [611, 611], "æ": [889, 889], "Æ": [1000, 1000], "ø": [611, 611], "Ø": [778, 778],
  "þ": [556, 611], "Þ": [667, 667], "ð": [556, 611], "Ð": [722, 722], "Œ": [1000, 1000], "œ": [944, 944],
  "ƒ": [556, 556], "ˆ": [333, 333], "˜": [333, 333], "¨": [333, 333], "¯": [333, 333], "´": [333, 333],
  "¸": [333, 333], "¦": [260, 280], "¹": [333, 333], "²": [333, 333], "³": [333, 333], " ": [278, 278],
  "­": [333, 333],
};

function charWidth(char: string, style: PdfStyle): number {
  const point = char.codePointAt(0)!;
  if (point >= 0x20 && point <= 0x7e) return ASCII_WIDTHS[style][point - 0x20];
  const other = OTHER_WIDTHS[char];
  if (other) return other[style === "bold" ? 1 : 0];
  // A letter with an accent is as wide as its letter; anything else is counted wide, so a line never overruns.
  const base = char.normalize("NFD")[0];
  if (base !== char && base.codePointAt(0)! < 0x7f) return charWidth(base, style);
  return style === "bold" ? 650 : 600;
}

export function textWidth(text: string, style: PdfStyle, size: number): number {
  let width = 0;
  for (const char of text) width += charWidth(char, style);
  return (width * size) / 1000;
}

/** A paragraph broken into lines no wider than `width`; a word wider than a line (an address) is broken where it must. */
export function wrapText(text: string, style: PdfStyle, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of typeset(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, style, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      line = "";
      let rest = word;
      while (textWidth(rest, style, size) > width) {
        let cut = 1;
        while (cut < rest.length && textWidth(rest.slice(0, cut + 1), style, size) <= width) cut += 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/* ----------------------------------------------------------------- layout */

const PAGE = { width: 612, height: 792, margin: 54 } as const;
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
/** The lowest a line of content may sit: above the footer. */
const CONTENT_BOTTOM = PAGE.margin + 30;
const INK = "0.12 0.14 0.13";
const MUTED = "0.38 0.40 0.39";
const LINK = "0.09 0.33 0.55";
const ROW_LABEL_WIDTH = 124;
const BULLET_INDENT = 14;
const QUOTE_INDENT = 12;

interface Run { x: number; y: number; text: string; style: PdfStyle; size: number; color: string }
interface Link { x: number; y: number; width: number; height: number; url: string }
/** A thin line from one point to another: the rule under the title, the bar beside a quote. */
interface Rule { x1: number; y1: number; x2: number; y2: number }
interface LaidPage { runs: Run[]; links: Link[]; rules: Rule[] }

const STYLES = {
  title: { style: "bold", size: 17, color: INK, before: 0, after: 4 },
  meta: { style: "regular", size: 9.5, color: MUTED, before: 0, after: 2 },
  heading: { style: "bold", size: 12, color: INK, before: 14, after: 4 },
  subheading: { style: "bold", size: 10, color: INK, before: 8, after: 2 },
  body: { style: "regular", size: 10, color: INK, before: 0, after: 4 },
  quote: { style: "regular", size: 10, color: INK, before: 0, after: 4 },
  hint: { style: "regular", size: 8.5, color: MUTED, before: 0, after: 4 },
  link: { style: "regular", size: 10, color: LINK, before: 0, after: 4 },
} as const satisfies Record<string, { style: PdfStyle; size: number; color: string; before: number; after: number }>;
const leading = (size: number) => size * 1.35;

function layout(blocks: readonly PdfBlock[]): LaidPage[] {
  const pages: LaidPage[] = [];
  let page: LaidPage;
  let y = 0;
  const newPage = () => { page = { runs: [], links: [], rules: [] }; pages.push(page); y = PAGE.height - PAGE.margin; };
  newPage();
  /** Room for `height` more points on this page, else a new page; a block never starts in the footer. */
  const room = (height: number) => { if (y - height < CONTENT_BOTTOM && y < PAGE.height - PAGE.margin) newPage(); };
  const lines = (texts: readonly string[], x: number, look: (typeof STYLES)[keyof typeof STYLES]) => {
    for (const text of texts) {
      room(leading(look.size));
      y -= leading(look.size);
      if (text) page.runs.push({ x, y: y + look.size * 0.3, text, style: look.style, size: look.size, color: look.color });
    }
  };
  for (const block of blocks) {
    switch (block.kind) {
      case "title": case "meta": case "heading": case "subheading": {
        const look = STYLES[block.kind];
        const wrapped = wrapText(block.text, look.style, look.size, CONTENT_WIDTH);
        // A heading stays with the first lines under it.
        if (block.kind === "heading" || block.kind === "subheading") room(look.before + leading(look.size) * (wrapped.length + 2));
        if (y < PAGE.height - PAGE.margin) y -= look.before;
        lines(wrapped, PAGE.margin, look);
        y -= look.after;
        if (block.kind === "title") { page!.rules.push({ x1: PAGE.margin, y1: y + 1, x2: PAGE.width - PAGE.margin, y2: y + 1 }); y -= 6; }
        break;
      }
      case "paragraph": {
        const look = STYLES[block.tone ?? "body"];
        const indent = block.tone === "quote" ? QUOTE_INDENT : 0;
        for (const text of wrapText(block.text, look.style, look.size, CONTENT_WIDTH - indent)) {
          room(leading(look.size));
          const top = y;
          lines([text], PAGE.margin + indent, look);
          // A quote has a bar beside it, line by line, so it follows the quote onto the next page.
          if (indent) page!.rules.push({ x1: PAGE.margin + 2, y1: top, x2: PAGE.margin + 2, y2: y });
        }
        y -= look.after;
        break;
      }
      case "bullets": {
        const look = STYLES.body;
        for (const item of block.items) {
          const wrapped = wrapText(item, look.style, look.size, CONTENT_WIDTH - BULLET_INDENT);
          room(leading(look.size));
          page!.runs.push({ x: PAGE.margin + 3, y: y - leading(look.size) + look.size * 0.3, text: "•", style: "regular",
            size: look.size, color: look.color });
          lines(wrapped, PAGE.margin + BULLET_INDENT, look);
          y -= 1.5;
        }
        y -= look.after;
        break;
      }
      case "rows": {
        const look = STYLES.body;
        for (const row of block.rows) {
          const label = wrapText(row.label, "bold", look.size, ROW_LABEL_WIDTH - 10);
          const value = wrapText(row.value, "regular", look.size, CONTENT_WIDTH - ROW_LABEL_WIDTH);
          for (let index = 0; index < Math.max(label.length, value.length); index += 1) {
            room(leading(look.size));
            y -= leading(look.size);
            const base = y + look.size * 0.3;
            if (label[index]) page!.runs.push({ x: PAGE.margin, y: base, text: label[index], style: "bold", size: look.size, color: look.color });
            if (value[index]) page!.runs.push({ x: PAGE.margin + ROW_LABEL_WIDTH, y: base, text: value[index], style: "regular",
              size: look.size, color: look.color });
          }
          y -= 2;
        }
        y -= look.after;
        break;
      }
      case "link": {
        const look = STYLES.link;
        for (const text of wrapText(block.text, look.style, look.size, CONTENT_WIDTH)) {
          room(leading(look.size));
          y -= leading(look.size);
          const base = y + look.size * 0.3;
          page!.runs.push({ x: PAGE.margin, y: base, text, style: look.style, size: look.size, color: look.color });
          page!.links.push({ x: PAGE.margin, y: base - 2, width: textWidth(text, look.style, look.size), height: look.size + 3, url: block.url });
        }
        y -= look.after;
        break;
      }
    }
  }
  return pages;
}

/* ----------------------------------------------------------------- writing */

const number = (value: number) => (Math.round(value * 100) / 100).toString();

/** A PDF string literal of the text in WinAnsi, with every byte outside printable ASCII escaped. */
function pdfString(text: string): string {
  let out = "(";
  for (const char of typeset(text)) {
    const code = winAnsiCode(char);
    if (code === null || code === 0x0a) { out += "?"; continue; }
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += char;
  }
  return `${out})`;
}

const FONT_NAME: Readonly<Record<PdfStyle, string>> = { regular: "F1", bold: "F2" };

function contentStream(page: LaidPage, footer: string, pageNumber: number, pageCount: number): string {
  const ops: string[] = [];
  for (const rule of page.rules)
    ops.push(`0.80 0.83 0.80 RG ${rule.x1 === rule.x2 ? 2 : 0.6} w ${number(rule.x1)} ${number(rule.y1)} m ${number(rule.x2)} ${number(rule.y2)} l S`);
  const footerLook = STYLES.hint;
  const footerY = PAGE.margin - 6;
  const numbering = `Page ${pageNumber} of ${pageCount}`;
  const runs: Run[] = [...page.runs,
    ...wrapText(footer, footerLook.style, footerLook.size, CONTENT_WIDTH - 80).slice(0, 2).map((text, index) => ({ x: PAGE.margin,
      y: footerY - index * leading(footerLook.size), text, style: footerLook.style, size: footerLook.size, color: footerLook.color })),
    { x: PAGE.width - PAGE.margin - textWidth(numbering, footerLook.style, footerLook.size), y: footerY, text: numbering,
      style: footerLook.style, size: footerLook.size, color: footerLook.color }];
  for (const run of runs)
    ops.push(`BT /${FONT_NAME[run.style]} ${number(run.size)} Tf ${run.color} rg ${number(run.x)} ${number(run.y)} Td ${pdfString(run.text)} Tj ET`);
  return `${ops.join("\n")}\n`;
}

/** The document as PDF bytes: the same input always gives the same bytes (no dates, no random ids). */
export function renderPdf(document: PdfDocument): Buffer {
  const pages = layout(document.blocks);
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add("");
  const pagesRef = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const info = add(`<< /Title ${pdfString(document.title)} /Producer (Blueprint) >>`);
  const kids: number[] = [];
  pages.forEach((page, index) => {
    const stream = contentStream(page, document.footer, index + 1, pages.length);
    const contents = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`);
    const annots = page.links.map(link => add(`<< /Type /Annot /Subtype /Link /Border [0 0 0] /Rect [${number(link.x)} ${number(link.y)} `
      + `${number(link.x + link.width)} ${number(link.y + link.height)}] /A << /S /URI /URI ${pdfString(link.url)} >> >>`));
    kids.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] `
      + `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R`
      + `${annots.length ? ` /Annots [${annots.map(ref => `${ref} 0 R`).join(" ")}]` : ""} >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${kids.map(ref => `${ref} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
