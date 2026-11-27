/**
 * The owner's outreach log on the research record (outreach playbook, section
 * 2, "Where each contact is tracked", and fix 8).
 *
 * One small object on a `robotTeams` record says who was written to, when,
 * by which channel, with which message version, under which dated go-ahead,
 * what they said, the next step, and whether they must not be contacted.
 * Every change is also kept in the record's `outreachEvents` subcollection.
 *
 * What it is not:
 * - Not a relationship. `robotTeamSeed.ts` says nothing about a researched
 *   company "may be presented to anyone as a relationship"; writing to one does
 *   not change that, so nothing here touches `status` or supply.
 * - Not a gate. Nothing refuses a contact. A missing go-ahead date, or a
 *   contact recorded after "do not contact", is shown to the owner as a flag.
 * - Not public. Registry reads drop it (`readTeamRecord`); only the admin
 *   routes in `admin-robot-teams.ts` read it.
 *
 * "Do not contact" stays set once set: an opt-out is honoured and never
 * removed (FTC CAN-SPAM guide; outreach playbook risk 17).
 */
import crypto from "node:crypto";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  ROBOT_TEAM_OUTREACH_ANSWERS,
  ROBOT_TEAM_OUTREACH_CHANNELS,
  ROBOT_TEAM_OUTREACH_EVENTS_COLLECTION,
  ROBOT_TEAM_OUTREACH_SCHEMA_VERSION,
  ROBOT_TEAMS_COLLECTION,
  type RobotTeamOutreach,
  type RobotTeamRecord,
} from "../types/robot-team-registry";

const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar day, YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
    "Use a real calendar day, YYYY-MM-DD.");

/** Every field is optional: a change names only what it changes. `null` clears a field. */
export const robotTeamOutreachChangeSchema = z.object({
  contactedOn: day.nullable().optional(),
  channel: z.enum(ROBOT_TEAM_OUTREACH_CHANNELS).nullable().optional(),
  messageVersion: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,60}$/, "A short version label, such as company-first.v1. Never the message text.").nullable().optional(),
  goAheadEntryOn: day.nullable().optional(),
  answer: z.enum(ROBOT_TEAM_OUTREACH_ANSWERS).nullable().optional(),
  nextStep: z.string().trim().max(200).nullable().optional(),
  nextStepOn: day.nullable().optional(),
  doNotContact: z.boolean().optional(),
  doNotContactSince: day.optional(),
}).strict();

export type RobotTeamOutreachChange = z.infer<typeof robotTeamOutreachChangeSchema>;

/** What the owner should see beside a row. Flags only; none refuses anything. */
export type RobotTeamOutreachFlag = "no_go_ahead_date" | "no_message_version" | "contacted_after_do_not_contact";

export function outreachFlags(outreach: RobotTeamOutreach | null | undefined): RobotTeamOutreachFlag[] {
  if (!outreach?.contactedOn) return [];
  const flags: RobotTeamOutreachFlag[] = [];
  if (!outreach.goAheadEntryOn) flags.push("no_go_ahead_date");
  if (!outreach.messageVersion) flags.push("no_message_version");
  if (outreach.doNotContact && outreach.doNotContactSince && outreach.contactedOn > outreach.doNotContactSince) {
    flags.push("contacted_after_do_not_contact");
  }
  return flags;
}

/** Applies one change. Returns a problem instead when it would remove an opt-out. */
export function applyOutreachChange(current: RobotTeamOutreach | null | undefined, change: RobotTeamOutreachChange,
  recordedBy: string, atIso: string): { ok: true; outreach: RobotTeamOutreach } | { ok: false; problem: string } {
  const before: RobotTeamOutreach = current ?? {
    schemaVersion: ROBOT_TEAM_OUTREACH_SCHEMA_VERSION, contactedOn: null, channel: null, messageVersion: null,
    goAheadEntryOn: null, answer: null, nextStep: null, nextStepOn: null, doNotContact: false, doNotContactSince: null,
    recordedBy, recordedAtIso: atIso,
  };
  if (before.doNotContact && change.doNotContact === false) {
    return { ok: false, problem: "This company asked not to be contacted, or was marked so. That stays on the record and is never removed." };
  }
  const pick = <K extends keyof RobotTeamOutreachChange>(key: K, fallback: RobotTeamOutreach[K & keyof RobotTeamOutreach]) =>
    (change[key] === undefined ? fallback : change[key]) as RobotTeamOutreach[K & keyof RobotTeamOutreach];
  const answer = pick("answer", before.answer);
  const doNotContact = before.doNotContact || change.doNotContact === true || answer === "asked_to_stop";
  const nextStep = pick("nextStep", before.nextStep);
  return { ok: true, outreach: {
    schemaVersion: ROBOT_TEAM_OUTREACH_SCHEMA_VERSION,
    contactedOn: pick("contactedOn", before.contactedOn),
    channel: pick("channel", before.channel),
    messageVersion: pick("messageVersion", before.messageVersion),
    goAheadEntryOn: pick("goAheadEntryOn", before.goAheadEntryOn),
    answer,
    nextStep: typeof nextStep === "string" && nextStep ? nextStep : null,
    nextStepOn: pick("nextStepOn", before.nextStepOn),
    doNotContact,
    doNotContactSince: doNotContact ? (before.doNotContactSince ?? change.doNotContactSince ?? atIso.slice(0, 10)) : null,
    recordedBy,
    recordedAtIso: atIso,
  } };
}

export type RobotTeamOutreachWrite =
  | { status: "ok"; outreach: RobotTeamOutreach }
  | { status: "not_found" }
  | { status: "invalid"; problem: string }
  | { status: "unavailable" };

/**
 * Write one change and its event in one transaction. Only the `outreach` field
 * is written: the record's `updatedAt` is left alone, because it says when the
 * research was last updated, and outreach is not research.
 */
export async function recordRobotTeamOutreach(params: { teamId: string; change: RobotTeamOutreachChange; recordedBy: string;
  now?: () => string }): Promise<RobotTeamOutreachWrite> {
  if (!db) return { status: "unavailable" };
  const store = db;
  const at = (params.now ?? (() => new Date().toISOString()))();
  const ref = store.collection(ROBOT_TEAMS_COLLECTION).doc(params.teamId);
  return store.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return { status: "not_found" } as const;
    const before = (snapshot.data() as RobotTeamRecord).outreach ?? null;
    const applied = applyOutreachChange(before, params.change, params.recordedBy, at);
    if (!applied.ok) return { status: "invalid", problem: applied.problem } as const;
    tx.set(ref, { outreach: applied.outreach }, { merge: true });
    const eventId = `${at.replace(/[^0-9]/g, "")}_${crypto.randomBytes(6).toString("hex")}`;
    tx.set(ref.collection(ROBOT_TEAM_OUTREACH_EVENTS_COLLECTION).doc(eventId), {
      teamId: params.teamId, change: params.change, before, after: applied.outreach, recordedBy: params.recordedBy, recordedAt: at,
    });
    return { status: "ok", outreach: applied.outreach } as const;
  });
}

/** One row of the owner's outreach list: the record's identity, its log and its flags. Nothing else. */
export interface RobotTeamOutreachRow {
  teamId: string;
  name: string;
  website: string | null;
  status: RobotTeamRecord["status"];
  outreach: RobotTeamOutreach | null;
  flags: RobotTeamOutreachFlag[];
}

export function outreachRow(id: string, record: Partial<RobotTeamRecord>): RobotTeamOutreachRow {
  const outreach = record.outreach ?? null;
  return { teamId: id, name: typeof record.name === "string" ? record.name : id,
    website: typeof record.website === "string" ? record.website : null,
    status: (record.status ?? "prospect") as RobotTeamRecord["status"], outreach, flags: outreachFlags(outreach) };
}

export async function getRobotTeamOutreach(teamId: string): Promise<RobotTeamOutreachRow | null> {
  if (!db) return null;
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).doc(teamId).get();
  return snapshot.exists ? outreachRow(snapshot.id, snapshot.data() as RobotTeamRecord) : null;
}

export async function listRobotTeamOutreach(limit = 500): Promise<RobotTeamOutreachRow[]> {
  if (!db) return [];
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).limit(Math.max(1, Math.min(limit, 1000))).get();
  return snapshot.docs.map((doc) => outreachRow(doc.id, doc.data() as RobotTeamRecord))
    .sort((a, b) => a.name.localeCompare(b.name));
}
