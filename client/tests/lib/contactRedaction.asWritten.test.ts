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
      "Move the 💡 lamp to the glass shelf ✅"])
      expect(company(sentence), sentence).toBe(sentence);
    // A look-alike form reads plain, as the patterns read it: an ellipsis is three full stops, a circled letter a letter.
    expect(company("Move the lamp to the shelf — gently…")).toBe("Move the lamp to the shelf — gently...");
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

  // A review of PR #1467: a held name folding to a word the redaction writes ("Thé" folds to "The", as in "The site")
  // took its own characters back through that word: "Thé site moves cartons.". A word the redaction writes is never
  // given a writer's characters, whichever original word it lines up with.
  it("never gives a word the redaction wrote the characters of a name it took out", () => {
    for (const [names, sentence] of [[["Thé"], "Thé moves cartons."], [["Sité"], "Ask Sité to move the cartons."],
      [["Ｔｈｅ"], "Ｔｈｅ moves cartons."], [["Removéd"], "Removéd stacks the totes."]] as const) {
      const known = { names: [...names], organisations: [], addresses: [], contacts: [] };
      const redacted = removeNamesNotHeld(removeIdentifyingDetails(sentence, known));
      const shown = asWritten(sentence, redacted);
      expect(shown, sentence).toBe(redacted);
      expect(shown, sentence).not.toMatch(/é|Ｔ/);
    }
    // With nothing taken out the sentence is the writer's whole, "thé" (tea) included; once something is, a kept word
    // spelt like one of those words reads plain ("the"): privacy over an accent.
    expect(company("Servez le thé à la cuisine.")).toBe("Servez le thé à la cuisine.");
    expect(company("Servez le thé, appelez le 06 12 34 56 78.")).toBe(`Servez le the, appelez le ${REMOVED}.`);
  });

  // An independent review of PR #1467.
  it("never shows a removed word's characters through a kept word that folds the same", () => {
    for (const [sentence, removed] of [["12 गांधी Street, गधा", "गांधी"], ["Deliver to 12 Müller Street, then Muller signs.", "Müller"],
      ["Unit 7, Ríverside, Leeds LS10 1AB, Riverside totes", "Ríverside"], ["Giao tới 12 Lê Lợi Street Le", "Lê"],
      ["Deliver to 12 Ｍｉｌｌ Street Mill", "Ｍｉｌｌ"]] as const) {
      const shown = company(sentence);
      expect(shown, sentence).not.toContain(removed);
    }
  });

  it("gives no invisible character, overlay or look-alike letter back", () => {
    // As the deterministic pass a reader's words get (no name pass), with something removed so the words are restored.
    const kept = (text: string) => asWritten(text, removeIdentifyingDetails(text, none));
    for (const word of ["l\u034Famp", "ⓛⓐⓜⓟ", "l\u0336a\u0336m\u0336p", "la\u2062mp", "l\uFE00amp"])
      expect(kept(`Move the ${word} to the shelf, call 512-555-0147.`), word).toBe("Move the lamp to the shelf, call [removed].");
  });

  it("finds a street address of other countries' shapes, and the address before a postal code on its own lines", () => {
    for (const [sentence, gone] of [
      ["Deliver to Hauptstraße 12, 10115 Berlin before noon.", /Hauptstra|10115|Berlin/],
      ["Livrez au 12 rue de la Paix, 75002 Paris le matin.", /Paix|75002|Paris/],
      ["Entrega en Calle Mayor 5, 28013 Madrid.", /Mayor|28013|Madrid/],
      ["Consegna in Via Roma 10, 00184 Roma.", /Via Roma|00184/],
      ["Bezorg op Damrak 1, 1012 LG Amsterdam.", /Damrak|1012|Amsterdam/],
      ["Our dock is in Fitzroy VIC 3065.", /Fitzroy|3065/],
      ["Ship to Alameda County, California 94501.", /Alameda|94501/],
      ["Harbour House, Unit 7, Riverside Industrial Estate, Hunslet, Leeds LS10 1AB: stack the totes.", /Harbour|Riverside|Hunslet|Leeds|LS10/],
      ["The Old Mill on the Green, Bakewell DE45 1AA: move the sacks.", /Old Mill|Green|Bakewell|DE45/],
      ["Send cartons to:\nUnit 7\nRiverside Industrial Estate\nLeeds\nLS10 1AB", /Riverside|Leeds|LS10/],
      ["Ask Mr. Smith at the dock.", /Smith/], ["Mail ダナ@example.com about the totes.", /ダナ|example/],
      ["Écrivez à josé.garcía@exemple.fr pour entrer.", /jos|garc|exemple/i]] as const)
      expect(removeIdentifyingDetails(sentence, none), sentence).not.toMatch(gone);
    // A postal code never takes the line above it unless that line is the address's own.
    expect(removeIdentifyingDetails("Overflow goes to the dock\nThen Leeds LS10 1AB", none)).toMatch(/^Overflow goes to the dock\s/);
    expect(removeIdentifyingDetails("Bay 4\nLeeds LS10 1AB", none)).toContain("Bay 4");
  });

  it("keeps a long text quick and small", () => {
    const text = Array.from({ length: 60 }, (_, i) => `mail ops${i}@harbor-${i}.example now`).join(", ").slice(0, 2000);
    const started = Date.now();
    const shown = company(text);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(shown).not.toMatch(/@|harbor-/);
  });

  it("gives back what it was given when the folded form is not its characters' own", () => {
    expect(asWritten("abc", "[removed]")).toBe("[removed]");
    expect(asWritten("", "")).toBe("");
  });
});
