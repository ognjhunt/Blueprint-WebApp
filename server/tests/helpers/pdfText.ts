/**
 * The text a PDF from `server/utils/simplePdf.ts` draws, line by line, read back from its uncompressed content streams:
 * every `(…) Tj` string, unescaped and decoded from WinAnsi. Also the link targets of its annotations. For tests only.
 */
const WIN_ANSI_HIGH: Readonly<Record<number, string>> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ",
  0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“",
  0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function unescape(literal: string): string {
  let out = "";
  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index];
    if (char !== "\\") { out += char; continue; }
    const octal = /^[0-7]{3}/.exec(literal.slice(index + 1));
    if (octal) {
      const code = parseInt(octal[0], 8);
      out += WIN_ANSI_HIGH[code] ?? String.fromCharCode(code);
      index += 3;
    } else {
      out += literal[index + 1];
      index += 1;
    }
  }
  return out;
}

/**
 * Every line of text the PDF draws, page by page and top to bottom: the runs drawn at one height on a page (a bullet and
 * its item, a row's label and its value) are one line, left to right, joined by a space.
 */
export function pdfTextLines(pdf: Buffer): string[] {
  const source = pdf.toString("latin1");
  const lines: string[] = [];
  for (const stream of source.matchAll(/stream\n([\s\S]*?)endstream/g)) {
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const op of stream[1].matchAll(/ ([\d.]+) ([\d.]+) Td \(((?:\\.|[^\\)])*)\) Tj/g)) {
      const y = Number(op[2]);
      rows.set(y, [...rows.get(y) ?? [], { x: Number(op[1]), text: unescape(op[3]) }]);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a))
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map(run => run.text).join(" "));
  }
  return lines;
}

/** The PDF's text as one string, a line per line drawn. */
export const pdfText = (pdf: Buffer) => pdfTextLines(pdf).join("\n");

/** Every address the PDF's link annotations open. */
export function pdfLinks(pdf: Buffer): string[] {
  return [...pdf.toString("latin1").matchAll(/\/URI \(((?:\\.|[^\\)])*)\)/g)].map(match => unescape(match[1]));
}

/** How many pages the PDF has. */
export function pdfPageCount(pdf: Buffer): number {
  return [...pdf.toString("latin1").matchAll(/\/Type \/Page\b(?!s)/g)].length;
}
