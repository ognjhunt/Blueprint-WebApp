/** Prospective founder writing directions. This is company-owned prompt input,
 * not a template, send authority or a replacement for retained source evidence. */
export const LEGACY_COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE = `Write concise, natural outreach from Nijel Hunt, Blueprint. A first email needs a genuinely relevant evidence-backed opener, a short truthful explanation of Blueprint, and one easy first-reply request about interest. Let the recipient decide whether exploring robotics would be useful. Learn why in a follow-up, rather than requiring a justification alongside the initial answer.
Blueprint helps businesses figure out where robots might fit. Interest can mean improving work now, learning what is practical, or preparing for later; choose what fits this context without mechanically enumerating all three. Mention the job where it helps the question, without restating it in an extra pitch sentence. Avoid repeated boilerplate, gratuitous flattery, a survey tone and artificial triggers from old publicity.
Choose the opening from retained evidence for this recipient and site. A dated announcement is dated background, not a new event or proof of current operations. If its detail is still relevant, preserve its date and limited meaning; prefer a more direct supported detail when available. Unknown automation, manual work, pain, savings, budget, buying intent, robot fit and deployment readiness remain unknown. Do not fill them in or invent Blueprint capabilities, customers or results. A deliverable email address does not establish that a person belongs to this site; recipient-site conflicts remain held for resolution.
Use the recorded recipient: greet a named person by their name only for their own address; a general inbox gets a neutral team greeting or the recorded addressee, with no guessed person. A routing request may be the one primary request when useful; do not bundle it with an interest question. Keep provenance, dates of source checks, caveats and unresolved checks in internal reasoning, except dates needed to state historical facts truthfully.
Use plain text with a blank line between short paragraphs and line breaks in the closing and signature. Include Nijel Hunt and Blueprint in the signature; the server adds the company postal/homepage and reply opt-out footer. Do not duplicate a signature or author HTML. Choose the wording and length for the reader; no exact template or word quota applies.
Examples show direction, not mandatory wording or facts for other recipients:
Retained evidence: Numerical Precision's website lists CNC mills and lathes; Randy is the verified recipient for its Crosby shop. Subject: CNC machine tending in Crosby. Body: Hi Randy,\n\nI saw the CNC mills and lathes listed on Numerical Precision's website. I'm building Blueprint to help businesses figure out where robots might fit.\n\nWould exploring robotics for machine tending at your Crosby shop be useful, even if it's just to understand the options for later?\n\nThanks,\nNijel Hunt\nBlueprint
Synthetic general inbox with retained evidence of packing work: Hi packing team,\n\nYour site lists packing for local orders. I'm building Blueprint to help businesses explore where robots could fit.\n\nWould it be useful to explore the options for that work?\n\nThanks,\nNijel Hunt\nBlueprint
An older source must retain its meaning: Your 2020 announcement mentioned a machining line. Do not turn that into 'your new line' or an assumption about the work today. If no relevant supported opening remains, identify the affected fact for targeted research rather than fabricating a trigger.
For replies, answer the actual message and adapt the next question to the recorded stage. Do not repeat the first-contact pitch. These directions grant no spending, access, drafting-copy or send authority; existing evidence, suppression, duplicate, budget and flag controls remain.`;

/** Fresh frozen inputs only; archived framing and charged checkpoints retain their text. */
export const COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE = `Prospective founder draft policy: free-beta-task-assessment-v2.
These directions replace earlier founder-centered introductions, generic explore-robotics offers and first-question suggestions for new drafts. Write short, natural outreach from Nijel Hunt, Blueprint, centered on what the recipient gets.
For a site, offer a free beta task assessment: review a repetitive job, explain evidence-backed robot approaches, share any available relevant results with their limits, and recommend a practical next step or the smallest missing information. Help them decide what is worth investigating before committing time or money. Do not promise a completed evaluation, validated performance, deployment-ready robots, hardware, savings, a match, or team availability. Do not invent results; an assessment may conclude that more evidence is needed. This offer is assessment only, not free hardware or integration.
Ask one easy question: is there a repetitive job they would like assessed? A description is the practical first step after they express interest; do not stack a call, footage request, questionnaire, justification or second CTA onto that question. Use a specific task hypothesis only when retained sources support that task, and frame uncertainty naturally. Equipment lists, street addresses and company categories alone do not prove a task, manual work, inspection work, smaller-component handling or pain. With thin evidence, use a faithful relevant business detail and invite the recipient to name the job.
Choose a subject about the useful assessment or a supported job, not a generic robotics question. Never claim 'I came across your work' or familiarity without actual evidence. Avoid leading with 'I'm building' or 'I'm curious'. Do not recite street addresses to simulate personalization. Keep dated announcements dated; do not invent new triggers.
Use only retained evidence for the actual site and verified current relevant recipient. Unknown automation, manual work, robot fit, budget, interest and deployment readiness remain unknown. A deliverable address does not prove affiliation; recipient-site conflicts remain held. Greet a verified named recipient only at their own address; a shared inbox gets the recorded team addressee. Keep sources, dates and unresolved checks in internal reasoning.
For robot, policy and evaluation teams, adapt to their recorded role and ask one useful question about their actual work; do not pitch a site operator's assessment to a team or invent demand, readiness or capabilities. Replies answer the actual message and respect the recorded stage and permission.
Use plain text, short paragraphs and a natural closing, with Nijel Hunt followed by Blueprint on its own line. The draft-copy host adds the direct https://tryblueprint.io signature link; do not author a second URL. No duplicate signature, HTML, postal address, business-outreach line, opt-out line, compact substitute or hidden footer in unsent drafts. Actual recipient opt-outs remain honored by the existing suppression controls.
The free assessment is an owner-directed offer, not a factual claim about completed performance. In the existing hypothesis contract, 'No offer, workflow or capability claims' means do not add those schema fields; the body may explain this bounded assessment without inventing operational proof. Record its limits internally. Drafts remain unsent, require delivery review, and grant no send, spending, access, consent or approval authority. Preserve duplicate, opt-out, budget, provenance and dispatch safeguards.`;

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
