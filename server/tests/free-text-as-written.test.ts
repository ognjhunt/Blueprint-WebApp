/**
 * Stress test, 2026-11-27: what one side reads of the other's words was the redaction's folded form, so a company read
 * "Deplacez la lampe vers l'etagere" and "カラス棚に" (a crow shelf) for "ガラス棚に" (a glass shelf), and a site read a
 * company's French without its accents. Every removal is made as before; the words kept read as written. No model is
 * called.
 */
import { describe, expect, it } from "vitest";
import { siteWordsDeterministic } from "../utils/freeTextScreening";
import { siteReasonOf } from "../utils/jobCompanies";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { REMOVED } from "../../client/src/lib/contactRedaction";

const nobody = { names: [], addresses: [], contacts: [] };

describe("one side's words as the other reads them, before any model pass", () => {
  it("keep the site's accents and marks", () => {
    for (const sentence of ["Déplacez la lampe vers l'étagère en verre au mur.", "Mueve la lámpara a la estantería de cristal.",
      "ランプを壁のガラス棚に移動してください。"])
      expect(siteWordsDeterministic(sentence, nobody)).toBe(sentence);
    // The phone number is a pattern's to remove; a name the record does not hold is the model pass's (owner, 2026-11-27).
    expect(siteWordsDeterministic("Déplacez la lampe vers l'étagère. Appelez Jean Dupont au 06 12 34 56 78.", nobody))
      .toBe(`Déplacez la lampe vers l'étagère. Appelez Jean Dupont au ${REMOVED}.`);
    // A German sentence keeps its nouns and umlauts: none of them is taken for a name before the model pass.
    expect(siteWordsDeterministic("Stellen Sie die Kiste auf das Regal über der Tür.", nobody))
      .toBe("Stellen Sie die Kiste auf das Regal über der Tür.");
    // An address line before a postal code goes whole, as a street address always does.
    expect(siteWordsDeterministic("Unit 7, Riverside Industrial Estate, Leeds LS10 1AB: stack the totes.", nobody))
      .toBe(`${REMOVED}: stack the totes.`);
    expect(siteWordsDeterministic("Ship to Oakland, CA 94607 by noon.", nobody)).toBe(`Ship to ${REMOVED} by noon.`);
  });

  it("keep a company's accents for the site", () => {
    const answer = (inputs: string) => ({ recordedBy: "company", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, inputs });
    expect(siteReasonOf(answer("Nous pouvons déplacer la lampe vers l'étagère en verre."), nobody))
      .toBe("Nous pouvons déplacer la lampe vers l'étagère en verre.");
  });
});
