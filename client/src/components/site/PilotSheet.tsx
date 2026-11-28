import {
  PILOT_SHEET_DONE_LABEL, PILOT_SHEET_FOOTER, PILOT_SHEET_HEADING, PILOT_SHEET_NOT_STATED, PILOT_SHEET_SENTENCE_LABEL,
  PILOT_SHEET_TERMS_LABEL, pilotTermsLines, type PilotSheet as PilotSheetView,
} from "@/lib/pilotOffers";

/**
 * The pilot sheet (owner, 2026-11-28), on both sides' pages after an introduction made from a pilot request: the site's
 * sentence for the job, its "what counts as done" (or "Not stated"), and the company's pilot terms as of the request. A
 * summary only: no signature, no acceptance, no new statement.
 */
export function PilotSheet({ sheet }: { sheet: PilotSheetView }) {
  return <section className="pilot-sheet" aria-label={PILOT_SHEET_HEADING}>
    <h3>{PILOT_SHEET_HEADING}</h3>
    <dl className="company-response-facts">
      <div><dt>{PILOT_SHEET_SENTENCE_LABEL}</dt><dd>{sheet.sentence.trim() ? `“${sheet.sentence.trim()}”` : PILOT_SHEET_NOT_STATED}</dd></div>
      <div><dt>{PILOT_SHEET_DONE_LABEL}</dt><dd>{sheet.done ? `“${sheet.done}”` : PILOT_SHEET_NOT_STATED}</dd></div>
      <div><dt>{PILOT_SHEET_TERMS_LABEL}</dt><dd><ul>{pilotTermsLines(sheet.terms).map(line => <li key={line}>{line}</li>)}</ul></dd></div>
    </dl>
    <p className="bare-helper ms-field-hint">{PILOT_SHEET_FOOTER}</p>
  </section>;
}

export default PilotSheet;
