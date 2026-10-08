import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { enqueueOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import {
  accessRecordId,
  ROBOT_TEAM_ACCESS_COLLECTION,
  type RobotTeamAccessRecord,
} from "./robotTeamEarlyAccess";

const APP_URL = () => (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");

/** Where an approved team books its call, or null to ask them to reply instead. */
function founderCallUrl(): string | null {
  const value = String(process.env.BLUEPRINT_FOUNDER_CALL_URL || "").trim();
  return /^https:\/\/\S+$/.test(value) ? value : null;
}

function firstName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}

export type AccessEmailKind =
  | "robot_team_access_received"
  | "robot_team_access_approved"
  | "robot_team_access_not_yet";

/**
 * The receipt. While only a few site tasks are listed, every team is matched
 * to a site by a person, so the receipt says so and asks for the one thing
 * that speeds a match: the site they would most want to test at.
 */
export function accessReceivedEmail(
  record: Pick<RobotTeamAccessRecord, "name" | "testSite">,
  _options: { thinLibrary?: boolean } = {},
) {
  const body = [
    "Thanks for registering interest in Blueprint's invited beta. Your interest is saved and approval is pending. A person will review it and invite your team when a real site task fits.",
    "",
    record.testSite
      ? `We have noted the site you named (${record.testSite}). Reply here if you want to clarify the task.`
      : "If there is a real site task you would like to explore, you can reply here with the details.",
    "",
    "No account, policy upload, or integration is needed now. Registering interest does not approve access or subscribe you to a newsletter.",
  ];
  return {
    subject: "We have your Blueprint beta interest",
    body: [emailGreeting(firstName(record.name)), "", ...body, "", EMAIL_SIGN_OFF].join("\n"),
  };
}

export function accessApprovedEmail(record: Pick<RobotTeamAccessRecord, "name" | "email" | "source">) {
  const base = APP_URL();
  const invited = record.source === "invite";
  const call = founderCallUrl();
  return {
    subject: "Your Blueprint beta invitation",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      invited
        ? "Following our conversation, your team is invited to the Blueprint beta."
        : "Your team is approved for the invited Blueprint beta.",
      "",
      `Create your account with this email address (${record.email}), or sign in if you already have one:`,
      `${base}/signup/business?buyerType=robot_team`,
      "",
      "Once your email is verified, the job library shows the site jobs open to your team:",
      `${base}/contact/robot-team`,
      "",
      ...(invited ? [] : [
        "Reply with the site or customer you would most want to test at, and we will look for a match.",
        call
          ? `If a call would help, book one here: ${call}`
          : "If a call would help, say so in your reply and we will find a time.",
        "",
      ]),
      "Any evaluation needs a separately agreed task scope. Approval does not guarantee a run, introduction, or deployment.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

/** A polite "not yet": the application stays on file and nothing is closed. */
export function accessNotYetEmail(record: Pick<RobotTeamAccessRecord, "name">) {
  return {
    subject: "Your Blueprint beta interest",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      "Thanks for registering interest. We invite teams manually when a real site task fits, and we can't offer your team access yet.",
      "",
      "We have kept your application on file. If something changes on your side, reply here and a person will read it.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

export async function enqueueAccessEmail(params: {
  kind: AccessEmailKind;
  recordId: string;
  record: RobotTeamAccessRecord;
  thinLibrary?: boolean;
}): Promise<{ enqueued: boolean }> {
  const message = params.kind === "robot_team_access_received"
    ? accessReceivedEmail(params.record, { thinLibrary: params.thinLibrary })
    : params.kind === "robot_team_access_approved"
      ? accessApprovedEmail(params.record)
      : accessNotYetEmail(params.record);
  // One of each per application: a re-application does not send a second
  // receipt, and a decision is announced once.
  const stamp = params.kind === "robot_team_access_received"
    ? params.record.appliedAtIso
    : params.record.decidedAtIso ?? params.record.updatedAtIso;
  return enqueueOutbox({
    idempotencyKey: `${params.kind}:${params.recordId}:${stamp}`,
    requestId: `robot-team-access:${params.recordId}`,
    kind: params.kind,
    to: params.record.email,
    subject: message.subject,
    body: message.body,
    replyTo: "hello@tryblueprint.io",
  });
}

type ListedCard = { title: string; taskFamily?: string; siteType?: string; region?: string };

/** The alert an approved team gets when a site lists a task. Card text only. */
export function newTaskEmail(record: Pick<RobotTeamAccessRecord, "name">, card: ListedCard) {
  const facts = [card.taskFamily, card.siteType, card.region].map((value) => String(value || "").trim()).filter(Boolean);
  return {
    subject: `New site job on Blueprint: ${card.title}`,
    body: [
      emailGreeting(firstName(record.name)),
      "",
      `A site just shared a new job: ${card.title}${facts.length ? ` (${facts.join(", ")})` : ""}.`,
      "",
      "See the card and start an evaluation run from the job library:",
      `${APP_URL()}/contact/robot-team`,
      "",
      "You get one of these each time a site lists a job. Reply to stop them.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

/**
 * Tell every approved team that a site listed a task, so nobody has to watch
 * the library or wait for a person to notice a match. Only the card's own
 * text goes out, which is what the site approved for these teams to see.
 */
export async function enqueueNewTaskAlerts(params: {
  requestId: string;
  card: ListedCard;
  /** When the card went live; one alert per team per time it is switched on. */
  wentLiveIso: string;
}): Promise<{ enqueued: number }> {
  if (!db) return { enqueued: 0 };
  const snapshot = await db.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved").limit(500).get();
  let enqueued = 0;
  for (const doc of snapshot.docs) {
    const record = doc.data() as RobotTeamAccessRecord;
    if (!record?.email) continue;
    const message = newTaskEmail(record, params.card);
    try {
      const result = await enqueueOutbox({
        idempotencyKey: `robot_team_new_task:${params.requestId}:${params.wentLiveIso}:${accessRecordId(record.email)}`,
        requestId: `robot-team-access:${accessRecordId(record.email)}`,
        kind: "robot_team_new_task",
        to: record.email,
        subject: message.subject,
        body: message.body,
        replyTo: "hello@tryblueprint.io",
      });
      if (result.enqueued) enqueued += 1;
    } catch (error) {
      logger.warn({ error, requestId: params.requestId }, "Could not queue a new-task alert");
    }
  }
  return { enqueued };
}
