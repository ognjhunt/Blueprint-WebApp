import { describe, expect, it } from "vitest";
import { REMOVED, asWritten, removeIdentifyingDetails, removeNamesNotHeld } from "@/lib/contactRedaction";

/**
 * Stress test, 2026-11-27: the redaction's output was built from its folded form, so a company read "l'etagere" for
 * "l'étagère", "lampara" for "lámpara" and "カラス棚" (a crow shelf) for "ガラス棚" (a glass shelf). Every removal is still
 * made on the folded form; only the words kept come back as the writer wrote them.
 */
const none = { names: [], organisations: [], addresses: [], contacts: [] };
const company = (text: string, known = none) => asWritten(text, removeNamesNotHeld(removeIdentifyingDetails(text, known)));
/** The text as the patterns read it, without its marks and zero-width characters: what may differ is only these. */
const plain = (text: string) => text.normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "").normalize("NFKD")
  .replace(/\p{M}+/gu, "").normalize("NFC");

describe("the words a redaction kept, as written", () => {
  it("keeps every accent and mark of a sentence with nothing to remove", () => {
    for (const sentence of ["Déplacez la lampe de la table de chevet ronde vers l'étagère en verre au mur.",
      "Mueve la lámpara a la estantería de cristal.",
      "ランプを丸いナイトテーブルから壁のガラス棚に移動してください。", "램프를 유리 선반으로 옮기세요.",
      "Move the lamp to the shelf — gently…", "Move the 💡 lamp to the glass shelf ✅"])
      expect(company(sentence), sentence).toBe(sentence);
  });

  it("removes exactly what it removed before, and writes the rest as the site did", () => {
    expect(company("Déplacez la lampe vers l'étagère en verre au mur. Appelez Jean Dupont au 06 12 34 56 78."))
      .toBe(`Déplacez la lampe vers l'étagère en verre au mur. ${REMOVED} au ${REMOVED}.`);
    expect(company("Mueve la lámpara a la estantería de cristal — llama a José García al 612 345 678."))
      .toBe(`Mueve la lámpara a la estantería de cristal — llama a ${REMOVED} al ${REMOVED}.`);
    expect(company("ランプを壁のガラス棚に移動してください。090-1234-5678")).toBe(`ランプを壁のガラス棚に移動してください。${REMOVED}`);
    // German capitalises every noun, and a capitalised word inside a sentence is taken out as a possible name
    // (privacy over a mangled sentence, `removeNamesNotHeld`); the words kept keep their umlauts.
    expect(company("Stellen Sie die Kiste auf das Regal über der Tür.")).toMatch(/ über der /);
  });

  const known = { names: ["Zébraplant Foods", "Zébraplant"], organisations: ["Zébraplant Foods"],
    addresses: ["77 Quokka Lane, Springfield, IL 62704"], contacts: ["owner@site-plant.example", "+1 415 555 0134"] };
  const corpus = [
    "Stack cartons at Zébraplant Foods, 77 QUOKKA Lane, Springfield.", "Stack cartons at Zebraplant’s dock.",
    "Ask Dana Whitfield at 1418 Larkspur Avenue, Austin TX 78704, call 512-555-0147 or email dana.whitfield@example.com, then move the lamp.",
    "Move the lamp to the glass shelf; Maria O'Neill (maria@example.org, +44 20 7946 0958) can let you in at 22 Baker Street.",
    "Unload the cartons for 40 dollars an hour with a Boston Dynamics Stretch or a Universal Robots UR20.",
    "Rangez les cartons chez Zébraplant à Springfield, appelez le +1 415 555 0134.",
    "Ask D\u200Bana Whitfield (w\u00ADhitfield@example.com) to open the dock.", "Ｃａｌｌ ４１５ ５５５ ０１３４ before noon.",
  ];

  it.each(corpus)("leaks nothing it removed: %s", sentence => {
    const redacted = removeNamesNotHeld(removeIdentifyingDetails(sentence, known));
    const shown = asWritten(sentence, redacted);
    expect(plain(shown)).toBe(plain(redacted));
    expect(shown.split(REMOVED).length).toBe(redacted.split(REMOVED).length);
    expect(shown).not.toMatch(/z[eé]braplant|quokka|springfield|62704|site-plant|415|0134|dana|whitfield|larkspur|maria|o'neill|baker|7946/i);
    expect(shown).not.toMatch(/[\u200B-\u200D\u2060\uFEFF\u00AD]/);
  });

  it("gives back what it was given when the folded form is not its characters' own", () => {
    expect(asWritten("abc", "[removed]")).toBe("[removed]");
    expect(asWritten("", "")).toBe("");
  });
});
