/** Prospective founder writing directions. This is company-owned prompt input,
 * not a template, send authority or a replacement for retained source evidence. */
export const COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE = `Write concise, natural outreach from Nijel Hunt, Blueprint. A first email needs a genuinely relevant evidence-backed opener, a short truthful explanation of Blueprint, and one easy first-reply request about interest. Let the recipient decide whether exploring robotics would be useful. Learn why in a follow-up, rather than requiring a justification alongside the initial answer.
Blueprint helps businesses figure out where robots might fit. Interest can mean improving work now, learning what is practical, or preparing for later; choose what fits this context without mechanically enumerating all three. Mention the job where it helps the question, without restating it in an extra pitch sentence. Avoid repeated boilerplate, gratuitous flattery, a survey tone and artificial triggers from old publicity.
Choose the opening from retained evidence for this recipient and site. A dated announcement is dated background, not a new event or proof of current operations. If its detail is still relevant, preserve its date and limited meaning; prefer a more direct supported detail when available. Unknown automation, manual work, pain, savings, budget, buying intent, robot fit and deployment readiness remain unknown. Do not fill them in or invent Blueprint capabilities, customers or results. A deliverable email address does not establish that a person belongs to this site; recipient-site conflicts remain held for resolution.
Use the recorded recipient: greet a named person by their name only for their own address; a general inbox gets a neutral team greeting or the recorded addressee, with no guessed person. A routing request may be the one primary request when useful; do not bundle it with an interest question. Keep provenance, dates of source checks, caveats and unresolved checks in internal reasoning, except dates needed to state historical facts truthfully.
Use plain text with a blank line between short paragraphs and line breaks in the closing and signature. Include Nijel Hunt and Blueprint in the signature; the server adds the company postal/homepage and reply opt-out footer. Do not duplicate a signature or author HTML. Choose the wording and length for the reader; no exact template or word quota applies.
Examples show direction, not mandatory wording or facts for other recipients:
Retained evidence: Numerical Precision's website lists CNC mills and lathes; Randy is the verified recipient for its Crosby shop. Subject: CNC machine tending in Crosby. Body: Hi Randy,\n\nI saw the CNC mills and lathes listed on Numerical Precision's website. I'm building Blueprint to help businesses figure out where robots might fit.\n\nWould exploring robotics for machine tending at your Crosby shop be useful, even if it's just to understand the options for later?\n\nThanks,\nNijel Hunt\nBlueprint
Synthetic general inbox with retained evidence of packing work: Hi packing team,\n\nYour site lists packing for local orders. I'm building Blueprint to help businesses explore where robots could fit.\n\nWould it be useful to explore the options for that work?\n\nThanks,\nNijel Hunt\nBlueprint
An older source must retain its meaning: Your 2020 announcement mentioned a machining line. Do not turn that into 'your new line' or an assumption about the work today. If no relevant supported opening remains, identify the affected fact for targeted research rather than fabricating a trigger.
For replies, answer the actual message and adapt the next question to the recorded stage. Do not repeat the first-contact pitch. These directions grant no spending, access, drafting-copy or send authority; existing evidence, suppression, duplicate, budget and flag controls remain.`;

export const COMMUNICATIONS_WRITING_QUALITY_VERSION = "blueprint.communications-writing-quality.v1";
const normalize = (value: string) => value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Advisory only: neither these signals nor their absence attest content truth
 * or authorize a copy/send. No style phrase is a hard rejection. */
export function communicationsWritingSignals(body: string, boundedJob: string) {
  const signals: { code: string; path: string; detail: string }[] = [];
  const job = normalize(boundedJob), prose = normalize(body);
  if (job && prose.split(job).length > 2) signals.push({ code: "repeated_job_statement", path: "body",
    detail: "The job is stated more than once; consider keeping it only where it helps the first reply." });
  return signals;
}

/** Report substantial shared sentences/paragraphs across a saved batch. Short identity,
 * greetings and signatures are excluded. This is a quality signal, never a
 * quota, rejection, content attestation or trigger for another model call. */
export function communicationsBatchRepetition(bodies: readonly string[]) {
  const paragraphs = new Map<string, Set<number>>();
  bodies.forEach((body, index) => {
    // Sentence spans catch boilerplate around a substituted task name too.
    for (const paragraph of body.split(/\n\s*\n/).flatMap(value => [value, ...value.split(/[.!?]+(?:\s|$)/u)])) {
      const key = normalize(paragraph);
      if (key.split(/\s+/).length < 12) continue;
      const rows = paragraphs.get(key) ?? new Set<number>();
      rows.add(index); paragraphs.set(key, rows);
    }
  });
  return [...paragraphs].filter(([, rows]) => rows.size > 1)
    .map(([paragraph, rows]) => ({ paragraph, draftIndexes: [...rows], advisoryOnly: true as const }));
}
