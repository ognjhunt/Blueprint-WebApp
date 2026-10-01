import { digest, type LearningEvent } from "./contract";
import type { LearningSnapshot, SnapshotRow } from "./snapshot";

function active(row: SnapshotRow) { return row.history.filter(e => row.currentEventIds.includes(e.eventId)); }
function last<T extends LearningEvent["kind"]>(events: LearningEvent[], kind: T) {
  return events.filter((e): e is Extract<LearningEvent, { kind: T }> => e.kind === kind).at(-1);
}
export function describeRow(row: SnapshotRow, snapshot: LearningSnapshot) {
  const events = active(row);
  const touches = events.filter((e): e is Extract<LearningEvent, { kind: "outreach_observed" }> => e.kind === "outreach_observed" && e.data.intent === "outreach");
  const jobs = [...new Set(touches.map(e => e.data.jobId))];
  const firstTouch = touches[0];
  const research = last(firstTouch ? events.filter(e => e.occurredAt <= firstTouch.occurredAt) : events, "research_observed");
  const contactAtTouch = last(firstTouch ? events.filter(e => e.occurredAt <= firstTouch.occurredAt) : events, "contact_observed");
  const accepted = jobs.filter(job => touches.some(e => e.data.jobId === job && e.data.status === "accepted"));
  const delivery = (job: string) => last(events.filter(e => e.kind !== "delivery_observed" || (e.data.jobId === job
    && touches.some(t => t.data.jobId === job && (!t.data.messageId || (t.data.messageId === e.data.messageId && t.data.threadId === e.data.threadId))))), "delivery_observed");
  const delivered = jobs.filter(job => delivery(job)?.data.status === "verified_delivered");
  const bounced = jobs.filter(job => delivery(job)?.data.status === "bounced");
  const replies = events.filter((e): e is Extract<LearningEvent, { kind: "reply_observed" }> => e.kind === "reply_observed"
    && touches.some(t => t.data.threadId !== null && t.data.threadId === e.data.threadId && t.occurredAt <= e.occurredAt));
  // The first accepted touch defines a prospect-level observation window;
  // attempts with unknown acknowledgement never enter the mature denominator.
  const firstAccepted = touches.find(e => e.data.status === "accepted");
  const mature = Boolean(firstAccepted && Date.parse(snapshot.asOf) - Date.parse(firstAccepted.occurredAt) >= snapshot.maturityDays * 86400000);
  const substantive = replies.filter(e => e.data.classification.label !== "automatic"
    && (!firstAccepted || (e.data.threadId === firstAccepted.data.threadId && e.occurredAt >= firstAccepted.occurredAt)));
  const reliable = substantive.filter(e => !e.data.classification.uncertain && e.data.classification.method === "human");
  const latest = reliable.at(-1);
  const outcome = last(events, "outcome_observed");
  return {
    prospectId: row.prospectId, crmId: research?.entities.crmId ?? firstTouch?.entities.crmId ?? null,
    hasResearch: Boolean(research),
    city: research?.data.city ?? "unknown", industry: research?.data.industry ?? "unknown",
    taskId: research?.entities.taskId ?? null, teamIds: research?.entities.teamIds ?? [],
    contactAvailabilityAtTouch: contactAtTouch?.data.availability ?? "unknown",
    outreachVersion: firstTouch?.data.outreachVersion ?? "unknown", campaignId: firstTouch?.data.campaignId ?? "unknown",
    messageVariant: firstTouch?.data.messageVariant ?? "unknown", messageDigest: firstTouch?.data.messageDigest ?? null,
    timingWindow: firstTouch?.data.timingWindow ?? "unknown",
    attemptedTouches: jobs.length, acceptedTouches: accepted.length, verifiedDeliveredTouches: delivered.length,
    verifiedDeliveredAcceptedTouches: delivered.filter(j => accepted.includes(j)).length,
    bouncedTouches: bounced.length, unknownAcknowledgementTouches: jobs.filter(j => !accepted.includes(j)).length,
    matureAcceptedProspect: mature && Boolean(firstAccepted && !bounced.includes(firstAccepted.data.jobId)), replied: substantive.length > 0,
    matureNonresponse: mature && substantive.length === 0 && Boolean(firstAccepted && !bounced.includes(firstAccepted.data.jobId)),
    pending: Boolean(firstAccepted && !mature && substantive.length === 0),
    explicitRejection: latest?.data.classification.label === "rejection",
    curiosity: latest?.data.classification.label === "curiosity",
    interestSubtype: latest?.data.classification.interest ?? "unknown",
    outcome: outcome?.data.outcome ?? "unknown",
    reachedOutcomes: [...new Set(events.filter((e): e is Extract<LearningEvent, { kind: "outcome_observed" }> => e.kind === "outcome_observed").map(e => e.data.outcome))],
    evidenceIds: events.map(e => e.eventId), unknowns: row.unknowns,
  };
}
type Description = ReturnType<typeof describeRow>;
function counts(rows: Description[]) {
  const n = (fn: (r: Description) => boolean) => rows.filter(fn).length;
  const sum = (key: "attemptedTouches" | "acceptedTouches" | "verifiedDeliveredTouches" | "bouncedTouches" | "unknownAcknowledgementTouches") => rows.reduce((v, r) => v + r[key], 0);
  const mature = rows.filter(r => r.matureAcceptedProspect);
  return { scopedProspects: rows.length, researchedProspects: n(r => r.hasResearch), attemptedTouches: sum("attemptedTouches"), acceptedTouches: sum("acceptedTouches"),
    verifiedDeliveredTouches: sum("verifiedDeliveredTouches"), bouncedTouches: sum("bouncedTouches"), unknownAcknowledgementTouches: sum("unknownAcknowledgementTouches"),
    matureAcceptedProspects: mature.length, repliedProspects: n(r => r.replied),
    matureRepliedProspects: mature.filter(r => r.replied).length, matureNonresponseProspects: n(r => r.matureNonresponse),
    pendingProspects: n(r => r.pending), explicitRejections: n(r => r.explicitRejection), curiosityReplies: n(r => r.curiosity),
    matureReplyRate: { numerator: mature.filter(r => r.replied).length, denominator: mature.length },
    // Delivery proof has its own denominator; never call accepted mail delivered.
    verifiedDeliveryRate: { numerator: rows.reduce((n, r) => n + r.verifiedDeliveredAcceptedTouches, 0), denominator: sum("acceptedTouches") },
    laterOutcomes: Object.fromEntries(["call_held", "evaluation_participation_agreed", "pilot_agreed", "deployment_capacity_confirmed", "pilot_started", "pilot_completed", "lost"]
      .map(outcome => [outcome, n(row => (row.reachedOutcomes as string[]).includes(outcome))])) };
}

/** Descriptive hypothesis planning, never a causal claim or stopping rule. */
export function planResearchLearning(snapshot: LearningSnapshot, focus: { city: string; industry: string }) {
  if (!["research", "contact", "outreach", "replies", "outcomes"].every(s => snapshot.scope.sections.includes(s as any))) {
    throw new Error("learning_planner_sections_missing");
  }
  const rows = snapshot.rows.map(row => describeRow(row, snapshot));
  const cohorts = [
    { name: "focus", rows: rows.filter(r => r.city === focus.city && r.industry === focus.industry) },
    { name: "same_industry_other_cities", rows: rows.filter(r => r.city !== "unknown" && r.city !== focus.city && r.industry === focus.industry) },
    { name: "other_industries_same_city", rows: rows.filter(r => r.city === focus.city && r.industry !== "unknown" && r.industry !== focus.industry) },
  ].map(cohort => {
    const groups = new Map<string, Description[]>();
    for (const row of cohort.rows) {
      const key = digest({ taskId: row.taskId, teamIds: row.teamIds, contact: row.contactAvailabilityAtTouch,
        message: row.messageVariant, messageDigest: row.messageDigest, outreachContract: row.outreachVersion, campaign: row.campaignId, timing: row.timingWindow });
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return { name: cohort.name, prospectIds: cohort.rows.map(r => r.prospectId), counts: counts(cohort.rows),
      strata: [...groups].map(([key, group]) => ({ key, controls: { taskId: group[0].taskId, teamIds: group[0].teamIds,
        contact: group[0].contactAvailabilityAtTouch, message: group[0].messageVariant, messageDigest: group[0].messageDigest,
        outreachContract: group[0].outreachVersion, campaign: group[0].campaignId, timing: group[0].timingWindow }, counts: counts(group) })) };
  });
  return { version: "blueprint.research-learning-plan.v1", snapshotId: snapshot.snapshotId, asOf: snapshot.asOf, focus, cohorts, scopeCounts: counts(rows),
    confidence: "descriptive_only", causalProof: false,
    hypotheses: [{ statement: "Check whether observed reply patterns persist in comparison cohorts with comparable contact, message and timing evidence.",
      evidenceSnapshotId: snapshot.snapshotId, status: "unconfirmed" }],
    confounders: ["contact_availability", "message_version", "campaign_selection", "task_and_team_fit", "timing_and_observation_window", "delivery_unknown", "small_sample", "authorized_scope_selection"],
    allocation: { replication: 0.4, comparison: 0.4, newExploration: 0.2 },
    stopAfterProspectCount: null,
    rules: ["Nonresponse is not rejection.", "Curiosity is not pilot readiness.", "Small observational samples are not causal proof.", "Cohort comparisons require checking strata and missing evidence."] };
}
