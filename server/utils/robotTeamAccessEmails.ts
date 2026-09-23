import { enqueueOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import type { RobotTeamAccessRecord } from "./robotTeamEarlyAccess";

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
  options: { thinLibrary?: boolean } = {},
) {
  const body = options.thinLibrary
    ? [
      "Thanks for applying. We are opening Blueprint to a few robot teams at a time and matching each one to a real site by hand, so a person will reply to you here, usually within a business day.",
      "",
      record.testSite
        ? `We will start from the site you named (${record.testSite}). If there is anyone we should talk to there, reply with their name.`
        : "If there is a site or customer you would most want to test at, reply and tell us. It is the fastest way to a match.",
    ]
    : [
      "Thanks for applying. Blueprint is opening to a small group of robot teams first, and a person reads every application.",
      "",
      "If there is a fit, we will email you here with how to create your account. From then on you will see the site tasks open to your team, and we will tell you when a new one fits your robot.",
      "",
      "Nothing else is needed from you now. Reply to this email if you want to add anything.",
    ];
  return {
    subject: "We have your Blueprint early-access application",
    body: [emailGreeting(firstName(record.name)), "", ...body, "", EMAIL_SIGN_OFF].join("\n"),
  };
}

export function accessApprovedEmail(record: Pick<RobotTeamAccessRecord, "name" | "email" | "source">) {
  const base = APP_URL();
  const invited = record.source === "invite";
  const call = founderCallUrl();
  return {
    subject: "You're in: Blueprint early access",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      invited
        ? "Following our conversation, your team has Blueprint early access."
        : "Your team is approved for Blueprint early access.",
      "",
      `Create your account with this email address (${record.email}), or sign in if you already have one:`,
      `${base}/signup/business?buyerType=robot_team`,
      "",
      "Once your email is verified, the task library shows the site tasks open to your team:",
      `${base}/contact/robot-team`,
      "",
      ...(invited ? [] : [
        call
          ? `We match every team to a site by hand at this stage. Book 20 minutes with us so we can find the right one: ${call}`
          : "We match every team to a site by hand at this stage. Reply to this email with a time for a 20-minute call so we can find the right one.",
        "",
      ]),
      "We will also email you when a new site task fits your robot.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

/** A polite "not yet": the application stays on file and nothing is closed. */
export function accessNotYetEmail(record: Pick<RobotTeamAccessRecord, "name">) {
  return {
    subject: "Your Blueprint early-access application",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      "Thanks for applying. We are opening Blueprint to a small number of robot teams at a time, matched to the sites we have today, and we can't offer your team access yet.",
      "",
      "We have kept your application and will email you when a site task fits your robot. If something changes on your side, reply here and a person will read it.",
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
