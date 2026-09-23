import { enqueueOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import type { RobotTeamAccessRecord } from "./robotTeamEarlyAccess";

const APP_URL = () => (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");

function firstName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}

export function accessReceivedEmail(record: Pick<RobotTeamAccessRecord, "name">) {
  return {
    subject: "We have your Blueprint early-access application",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      "Thanks for applying. Blueprint is opening to a small group of robot teams first, and a person reads every application.",
      "",
      "If there is a fit, we will email you here with how to create your account. From then on you will see the site tasks open to your team, and we will tell you when a new one fits your robot.",
      "",
      "Nothing else is needed from you now. Reply to this email if you want to add anything.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

export function accessApprovedEmail(record: Pick<RobotTeamAccessRecord, "name" | "email">) {
  const base = APP_URL();
  return {
    subject: "You're in: Blueprint early access",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      "Your team is approved for Blueprint early access.",
      "",
      `Create your account with this email address (${record.email}), or sign in if you already have one:`,
      `${base}/signup/business?buyerType=robot_team`,
      "",
      "Once your email is verified, the task library shows the site tasks open to your team:",
      `${base}/contact/robot-team`,
      "",
      "We are matching teams to sites by hand at this stage, so we will also email you when a site task fits your robot.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

export async function enqueueAccessEmail(params: {
  kind: "robot_team_access_received" | "robot_team_access_approved";
  recordId: string;
  record: RobotTeamAccessRecord;
}): Promise<{ enqueued: boolean }> {
  const message = params.kind === "robot_team_access_received"
    ? accessReceivedEmail(params.record)
    : accessApprovedEmail(params.record);
  // One of each per application: a re-application does not send a second
  // receipt, and an approval is announced once.
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
