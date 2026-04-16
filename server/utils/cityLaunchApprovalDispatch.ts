import { resolveCityLaunchProfile } from "./cityLaunchProfiles";
import { buildFounderApprovals } from "./cityLaunchExecutionHarness";
import { readCityLaunchActivation } from "./cityLaunchLedgers";
import type { CityLaunchBudgetPolicy } from "./cityLaunchPolicy";
import { sendEmail } from "./email";
import { dispatchHumanBlocker } from "./human-blocker-dispatch";
import { type HumanBlockerPacket } from "./human-blocker-packet";
import { getConfiguredEnvValue } from "../config/env";

export type CityLaunchApprovalDispatchResult = {
  dispatched: boolean;
  blockerId: string | null;
  approvalCount: number;
  emailSent: boolean;
  slackMirrored: boolean;
  alreadyApproved: boolean;
};

function getFounderEmail(): string {
  return (
    getConfiguredEnvValue("BLUEPRINT_FOUNDER_EMAIL")
    || "ohstnhunt@gmail.com"
  );
}

function getApprovalReplyEmail(): string {
  return (
    getConfiguredEnvValue("BLUEPRINT_APPROVAL_REPLY_EMAIL")
    || getFounderEmail()
  );
}

export async function dispatchCityLaunchFounderApproval(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
}): Promise<CityLaunchApprovalDispatchResult> {
  const { city, budgetPolicy } = input;
  const profile = resolveCityLaunchProfile(city, budgetPolicy.tier);
  const founderEmail = getFounderEmail();
  const replyEmail = getApprovalReplyEmail();

  // Check if already approved
  const existingActivation = await readCityLaunchActivation(city).catch(
    () => null,
  );
  if (existingActivation?.founderApproved) {
    return {
      dispatched: false,
      blockerId: null,
      approvalCount: 0,
      emailSent: false,
      slackMirrored: false,
      alreadyApproved: true,
    };
  }

  // Build approval items
  const approvals = buildFounderApprovals(profile, budgetPolicy);
  const blockerId = `city-launch-approval-${profile.key}-${Date.now()}`;

  // Build the approval email body
  const approvalLines = approvals
    .map((item: string, index: number) => `${index + 1}. ${item}`)
    .join("\n");

  const emailSubject = `[Blueprint Approval Required] ${profile.city} City Launch — ${budgetPolicy.label} ($${budgetPolicy.maxTotalApprovedUsd.toLocaleString()})`;

  const emailText = [
    `${profile.city} City Launch Approval Packet`,
    "",
    `Budget: ${budgetPolicy.label} — up to $${budgetPolicy.maxTotalApprovedUsd.toLocaleString()}`,
    `Operator auto-approve: $${budgetPolicy.operatorAutoApproveUsd.toLocaleString()}`,
    `Paid acquisition: ${budgetPolicy.allowPaidAcquisition ? "allowed" : "not allowed"}`,
    `Referral rewards: ${budgetPolicy.allowReferralRewards ? "allowed" : "not allowed"}`,
    "",
    "Approvals required:",
    approvalLines,
    "",
    "To approve: reply with APPROVE and the item numbers you approve (or ALL).",
    "To reject: reply with REJECT and the item numbers + reasons.",
    "",
    `Blocker ID: ${blockerId}`,
    "",
    "After approval, re-run with --founder-approved to activate.",
  ].join("\n");

  const emailHtml = [
    `<h2>${profile.city} City Launch Approval Packet</h2>`,
    `<p><strong>Budget:</strong> ${budgetPolicy.label} — up to $${budgetPolicy.maxTotalApprovedUsd.toLocaleString()}</p>`,
    `<p><strong>Operator auto-approve:</strong> $${budgetPolicy.operatorAutoApproveUsd.toLocaleString()}</p>`,
    `<p><strong>Paid acquisition:</strong> ${budgetPolicy.allowPaidAcquisition ? "allowed" : "not allowed"}</p>`,
    `<p><strong>Referral rewards:</strong> ${budgetPolicy.allowReferralRewards ? "allowed" : "not allowed"}</p>`,
    "<h3>Approvals required:</h3>",
    "<ol>",
    ...approvals.map((item: string) => `<li>${item}</li>`),
    "</ol>",
    "<hr>",
    `<p>To <strong>approve</strong>: reply with <code>APPROVE</code> and the item numbers (or <code>ALL</code>).</p>`,
    `<p>To <strong>reject</strong>: reply with <code>REJECT</code> and the item numbers + reasons.</p>`,
    `<p><em>Blocker ID: ${blockerId}</em></p>`,
    "<p>After approval, re-run with <code>--founder-approved</code> to activate.</p>",
  ].join("\n");

  // Send via the standard human-blocker dispatch so the reply-resume system can capture the response
  const packet: HumanBlockerPacket = {
    blockerId,
    title: `${profile.city} City Launch Approval`,
    summary: `Approve ${profile.city} as an active city launch with ${budgetPolicy.label} budget ($${budgetPolicy.maxTotalApprovedUsd.toLocaleString()}). ${approvals.length} approval items.`,
    recommendedAnswer: "APPROVE ALL — approve the city activation, bounded spend posture, and gated cohort pilot posture.",
    exactResponseNeeded: "Reply with APPROVE and the item numbers (or ALL) to proceed, or REJECT with item numbers and reasons.",
    whyBlocked: "City launch activation requires explicit founder approval on go/no-go, spend posture, source-policy exceptions, rights/privacy precedent, and non-standard commercial commitments.",
    alternatives: [
      "APPROVE ALL — approve all items and proceed to activation",
      "APPROVE partial — approve specific item numbers only",
      "REJECT — reject specific items with reasons; city stays in planning",
    ],
    risk: `Without approval, ${profile.city} stays in planning and no supply/demand execution lanes activate.`,
    executionOwner: "city-launch-agent",
    immediateNextAction: "After approval, re-run city-launch:run with --founder-approved to activate the execution harness and dispatch Paperclip issues.",
    deadline: "Within 48 hours — execution lanes are waiting on this gate.",
    evidence: approvals,
    nonScope: "This approval does not authorize public city-live claims, precedent-setting rights/privacy exceptions beyond what is listed, or spend beyond the approved envelope.",
  };

  let emailSent = false;
  let slackMirrored = false;

  try {
    const dispatchResult = await dispatchHumanBlocker({
      delivery_mode: "send_now",
      packet,
      blocker_kind: "ops_commercial",
      email_target: founderEmail,
      mirror_to_slack: true,
    });

    emailSent = dispatchResult.email_sent;
    slackMirrored = dispatchResult.slack_sent || false;
  } catch {
    // Fallback: send direct email if blocker dispatch fails
    const result = await sendEmail({
      to: founderEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      replyTo: replyEmail,
      sendGridCategories: ["city-launch", "approval", profile.key],
      sendGridCustomArgs: {
        blocker_id: blockerId,
        city_slug: profile.key,
        approval_type: "city_launch_activation",
      },
    });
    emailSent = result.sent;
  }

  return {
    dispatched: true,
    blockerId,
    approvalCount: approvals.length,
    emailSent,
    slackMirrored,
    alreadyApproved: false,
  };
}
