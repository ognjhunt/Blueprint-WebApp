import {
  listCityLaunchSendActions,
  readCityLaunchSendAction,
  upsertCityLaunchSendAction,
  listCityLaunchChannelAccounts,
  upsertCityLaunchChannelAccount,
  type CityLaunchSendActionRecord,
  type CityLaunchChannelAccountRecord,
} from "./cityLaunchLedgers";
import {
  getCityLaunchSenderOperationalState,
  getCityLaunchSenderStatus,
  getEmailTransportStatus,
  sendEmail,
  type CityLaunchSenderStatus,
} from "./email";
import { logger } from "../logger";
import { recordCityLaunchTouch } from "./cityLaunchLedgers";
import { validateRecipientEmailAddress } from "../agents/action-policies";

export type CityLaunchSendExecutionResult = {
  city: string;
  totalEligible: number;
  sent: number;
  skippedApproval: number;
  skippedNoRecipient: number;
  skippedAlreadySent: number;
  failed: number;
  errors: string[];
};

export type CityLaunchOutboundReadiness = {
  city: string;
  status: "ready" | "warning" | "blocked";
  directOutreachActions: {
    total: number;
    recipientBacked: number;
    readyToSend: number;
    approvalNeeded: number;
    sent: number;
  };
  emailTransport: ReturnType<typeof getEmailTransportStatus>;
  sender: CityLaunchSenderStatus;
  blockers: string[];
  warnings: string[];
};

export function hasCityLaunchRecipientBackedEmail(
  entry: Pick<CityLaunchSendActionRecord, "recipientEmail">,
) {
  return validateRecipientEmailAddress(entry.recipientEmail).valid;
}

export function assessCityLaunchOutboundReadiness(input: {
  city: string;
  sendActions: CityLaunchSendActionRecord[];
}): CityLaunchOutboundReadiness {
  const directOutreachActions = input.sendActions.filter((entry) => entry.actionType === "direct_outreach");
  const recipientBacked = directOutreachActions.filter(hasCityLaunchRecipientBackedEmail);
  const invalidRecipientEmails = directOutreachActions.filter((entry) =>
    Boolean(entry.recipientEmail) && !hasCityLaunchRecipientBackedEmail(entry),
  );
  const approvalNeeded = recipientBacked.filter((entry) =>
    entry.status === "ready_to_send" && entry.approvalState === "pending_first_send_approval",
  );
  const blockedDirectOutreach = recipientBacked.filter((entry) =>
    entry.status === "blocked" || entry.approvalState === "blocked",
  );
  const readyToSend = recipientBacked.filter((entry) =>
    entry.status === "ready_to_send"
    && entry.approvalState !== "pending_first_send_approval"
    && entry.approvalState !== "blocked",
  );
  const sent = recipientBacked.filter((entry) => entry.status === "sent");
  const senderOperationalState = getCityLaunchSenderOperationalState();
  const emailTransport = senderOperationalState.transport;
  const sender = senderOperationalState.sender;
  const blockers: string[] = [...senderOperationalState.blockers];
  const warnings: string[] = [...senderOperationalState.warnings];

  if (recipientBacked.length === 0) {
    blockers.push(
      `No recipient-backed direct-outreach send actions were seeded for ${input.city}.`,
    );
  }
  if (invalidRecipientEmails.length > 0) {
    blockers.push(
      `${invalidRecipientEmails.length} direct-outreach action(s) have invalid or placeholder recipient emails and cannot count as recipient-backed.`,
    );
  }
  if (approvalNeeded.length > 0) {
    warnings.push(
      `${approvalNeeded.length} recipient-backed first-send action(s) are waiting for founder approval before dispatch.`,
    );
  }
  if (blockedDirectOutreach.length > 0) {
    warnings.push(
      `${blockedDirectOutreach.length} recipient-backed direct-outreach action(s) are blocked before dispatch.`,
    );
  }

  return {
    city: input.city,
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    directOutreachActions: {
      total: directOutreachActions.length,
      recipientBacked: recipientBacked.length,
      readyToSend: readyToSend.length,
      approvalNeeded: approvalNeeded.length,
      sent: sent.length,
    },
    emailTransport,
    sender,
    blockers,
    warnings,
  };
}

export async function executeCityLaunchSends(input: {
  city: string;
  dryRun?: boolean;
  maxSends?: number;
  sendKeyFilter?: string[];
}): Promise<CityLaunchSendExecutionResult> {
  const { city, dryRun = false, maxSends, sendKeyFilter } = input;
  const errors: string[] = [];
  let sent = 0;
  let skippedApproval = 0;
  let skippedNoRecipient = 0;
  let skippedAlreadySent = 0;
  let failed = 0;
  const sender = getCityLaunchSenderStatus();

  const allSendActions = await listCityLaunchSendActions(city);
  const channelAccounts = await listCityLaunchChannelAccounts(city);
  const channelAccountMap = new Map(channelAccounts.map((ca) => [ca.id, ca]));

  // Filter to eligible sends
  const eligible = allSendActions.filter((action) => {
    if (action.status === "sent") {
      skippedAlreadySent++;
      return false;
    }
    if (action.actionType === "direct_outreach" && !hasCityLaunchRecipientBackedEmail(action)) {
      skippedNoRecipient++;
      return false;
    }
    if (action.status === "blocked") {
      return false;
    }
    if (action.approvalState === "pending_first_send_approval") {
      skippedApproval++;
      return false;
    }
    if (action.approvalState === "blocked") {
      return false;
    }
    if (sendKeyFilter && !sendKeyFilter.includes(action.id)) {
      return false;
    }
    return true;
  });

  const toSend = maxSends ? eligible.slice(0, maxSends) : eligible;

  for (const action of toSend) {
    // Direct outreach requires a recipient email
    if (action.actionType === "direct_outreach") {
      if (!hasCityLaunchRecipientBackedEmail(action)) {
        skippedNoRecipient++;
        continue;
      }
      const recipientEmail = String(action.recipientEmail).trim();

      if (dryRun) {
        logger.info(
          {
            city,
            actionId: action.id,
            lane: action.lane,
            recipient: recipientEmail,
            subject: action.emailSubject,
          },
          "[DRY RUN] Would send city-launch direct outreach",
        );
        sent++;
        continue;
      }

      try {
        const result = await sendEmail({
          to: recipientEmail,
          subject: action.emailSubject || `${city} City Launch — Blueprint`,
          text:
            action.emailBody
            || `Blueprint is opening a bounded city-launch motion in ${city}. Reply to learn more.`,
          fromEmail: sender.fromEmail || undefined,
          fromName: sender.fromName,
          replyTo: sender.replyTo || undefined,
          sendGridCategories: [
            "city-launch",
            "direct-outreach",
            action.lane,
          ],
          sendGridCustomArgs: {
            city_launch_action_id: action.id,
            city_launch_lane: action.lane,
            city_launch_asset_key: action.assetKey,
          },
        });

        if (result.sent) {
          const now = new Date().toISOString();
          await upsertCityLaunchSendAction({
            id: action.id,
            city: action.city,
            launchId: action.launchId,
            lane: action.lane,
            actionType: action.actionType,
            channelAccountId: action.channelAccountId,
            channelLabel: action.channelLabel,
            targetLabel: action.targetLabel,
            assetKey: action.assetKey,
            ownerAgent: action.ownerAgent,
            recipientEmail,
            emailSubject: action.emailSubject,
            emailBody: action.emailBody,
            status: "sent",
            approvalState: action.approvalState,
            responseIngestState: action.responseIngestState,
            issueId: action.issueId,
            notes: action.notes,
            sentAtIso: now,
            firstResponseAtIso: action.firstResponseAtIso,
          });

          // Record the touch
          await recordCityLaunchTouch({
            city: action.city,
            launchId: action.launchId,
            referenceType: "general",
            referenceId: null,
            touchType: "first_touch",
            channel: action.lane,
            status: "sent",
            campaignId: null,
            issueId: action.issueId,
            notes: `Direct outreach sent to ${recipientEmail}`,
            researchProvenance: null,
          });

          sent++;
        } else {
          failed++;
          errors.push(
            `Send failed for ${action.id}: ${result.error || "unknown"}`,
          );
        }
      } catch (error) {
        failed++;
        errors.push(
          `Send error for ${action.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (action.actionType === "community_post") {
      // Community publication is excluded from the automated launch path until a
      // real publication connector exists. Keep the lane visible without
      // pretending that a live external post happened.
      if (dryRun) {
        logger.info(
          {
            city,
            actionId: action.id,
            lane: action.lane,
            targetLabel: action.targetLabel,
          },
          "[DRY RUN] Would prepare city-launch community post content",
        );
        sent++;
        continue;
      }

      const channelAccount = action.channelAccountId
        ? channelAccountMap.get(action.channelAccountId)
        : null;
      if (channelAccount && channelAccount.status === "ready_to_create") {
        await upsertCityLaunchChannelAccount({
          id: channelAccount.id,
          city: channelAccount.city,
          launchId: channelAccount.launchId,
          lane: channelAccount.lane,
          channelClass: channelAccount.channelClass,
          accountLabel: channelAccount.accountLabel,
          ownerAgent: channelAccount.ownerAgent,
          status: "created",
          approvalState: "not_required",
          notes:
            (channelAccount.notes || "")
            + " | Artifact-only lane; external community publication is excluded from the automated launch path until a publication connector exists.",
        });
      }

      await upsertCityLaunchSendAction({
        id: action.id,
        city: action.city,
        launchId: action.launchId,
        lane: action.lane,
        actionType: action.actionType,
        channelAccountId: action.channelAccountId,
        channelLabel: action.channelLabel,
        targetLabel: action.targetLabel,
        assetKey: action.assetKey,
        ownerAgent: action.ownerAgent,
        recipientEmail: action.recipientEmail,
        emailSubject: action.emailSubject,
        emailBody: action.emailBody,
        status: "blocked",
        approvalState: action.approvalState,
        responseIngestState: action.responseIngestState,
        issueId: action.issueId,
        notes:
          (action.notes || "")
          + " | Artifact-only lane; no external post was attempted because automated community publication is not implemented.",
        sentAtIso: action.sentAtIso,
        firstResponseAtIso: action.firstResponseAtIso,
      });
    }
  }

  return {
    city,
    totalEligible: eligible.length,
    sent,
    skippedApproval,
    skippedNoRecipient,
    skippedAlreadySent,
    failed,
    errors,
  };
}

export async function approveCityLaunchSendAction(input: {
  actionId: string;
  approverRole: string;
}): Promise<{ approved: boolean; actionId: string }> {
  const action = await readCityLaunchSendAction(input.actionId);
  if (!action) {
    throw new Error(`Send action ${input.actionId} not found`);
  }
  if (action.approvalState !== "pending_first_send_approval") {
    return { approved: false, actionId: input.actionId };
  }
  if (action.actionType === "direct_outreach" && !hasCityLaunchRecipientBackedEmail(action)) {
    await upsertCityLaunchSendAction({
      id: action.id,
      city: action.city,
      launchId: action.launchId,
      lane: action.lane,
      actionType: action.actionType,
      channelAccountId: action.channelAccountId,
      channelLabel: action.channelLabel,
      targetLabel: action.targetLabel,
      assetKey: action.assetKey,
      ownerAgent: action.ownerAgent,
      recipientEmail: action.recipientEmail,
      emailSubject: action.emailSubject,
      emailBody: action.emailBody,
      status: "blocked",
      approvalState: "blocked",
      responseIngestState: action.responseIngestState,
      issueId: action.issueId,
      notes:
        (action.notes || "")
        + ` | Approval blocked at ${new Date().toISOString()}: direct outreach requires a non-placeholder recipient email.`,
      sentAtIso: action.sentAtIso,
      firstResponseAtIso: action.firstResponseAtIso,
    });
    return { approved: false, actionId: input.actionId };
  }

  await upsertCityLaunchSendAction({
    id: action.id,
    city: action.city,
    launchId: action.launchId,
    lane: action.lane,
    actionType: action.actionType,
    channelAccountId: action.channelAccountId,
    channelLabel: action.channelLabel,
    targetLabel: action.targetLabel,
    assetKey: action.assetKey,
    ownerAgent: action.ownerAgent,
    recipientEmail: action.recipientEmail,
    emailSubject: action.emailSubject,
    emailBody: action.emailBody,
    status: action.status,
    approvalState: "approved",
    responseIngestState: action.responseIngestState,
    issueId: action.issueId,
    notes:
      (action.notes || "")
      + ` | Approved by ${input.approverRole} at ${new Date().toISOString()}`,
    sentAtIso: action.sentAtIso,
    firstResponseAtIso: action.firstResponseAtIso,
  });

  return { approved: true, actionId: input.actionId };
}
