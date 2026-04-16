import {
  listCityLaunchSendActions,
  readCityLaunchSendAction,
  upsertCityLaunchSendAction,
  listCityLaunchChannelAccounts,
  upsertCityLaunchChannelAccount,
  type CityLaunchSendActionRecord,
  type CityLaunchChannelAccountRecord,
} from "./cityLaunchLedgers";
import { sendEmail } from "./email";
import { getConfiguredEnvValue } from "../config/env";
import { logger } from "../logger";
import { recordCityLaunchTouch } from "./cityLaunchLedgers";

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

function getCityLaunchFromEmail(): string {
  return (
    getConfiguredEnvValue("SENDGRID_FROM_EMAIL")
    || getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_FROM_EMAIL")
    || "launches@tryblueprint.io"
  );
}

function getCityLaunchFromName(): string {
  return (
    getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_FROM_NAME")
    || "Blueprint City Launch"
  );
}

function getCityLaunchReplyTo(): string {
  return (
    getConfiguredEnvValue("BLUEPRINT_CITY_LAUNCH_REPLY_TO")
    || getConfiguredEnvValue("BLUEPRINT_FOUNDER_EMAIL")
    || "ohstnhunt@gmail.com"
  );
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

  const allSendActions = await listCityLaunchSendActions(city);
  const channelAccounts = await listCityLaunchChannelAccounts(city);
  const channelAccountMap = new Map(channelAccounts.map((ca) => [ca.id, ca]));

  // Filter to eligible sends
  const eligible = allSendActions.filter((action) => {
    if (action.status === "sent") {
      skippedAlreadySent++;
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
      if (!action.recipientEmail) {
        skippedNoRecipient++;
        continue;
      }

      if (dryRun) {
        logger.info(
          {
            city,
            actionId: action.id,
            lane: action.lane,
            recipient: action.recipientEmail,
            subject: action.emailSubject,
          },
          "[DRY RUN] Would send city-launch direct outreach",
        );
        sent++;
        continue;
      }

      try {
        const result = await sendEmail({
          to: action.recipientEmail,
          subject: action.emailSubject || `${city} City Launch — Blueprint`,
          text:
            action.emailBody
            || `Blueprint is opening a bounded city-launch motion in ${city}. Reply to learn more.`,
          replyTo: getCityLaunchReplyTo(),
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
            recipientEmail: action.recipientEmail,
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
            notes: `Direct outreach sent to ${action.recipientEmail}`,
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
      // Community posts cannot be fully automated — they require a human to post
      // to the community platform. Generate the post content for copy-paste.
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

      // Mark channel account as created (the account setup itself is manual)
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
          approvalState: channelAccount.approvalState,
          notes:
            (channelAccount.notes || "")
            + " | Community post content generated for operator copy-paste.",
        });
      }

      // Update the send action to note it needs manual posting
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
        approvalState: action.approvalState,
        responseIngestState: action.responseIngestState,
        issueId: action.issueId,
        notes:
          (action.notes || "")
          + " | Community post: requires manual posting to community platform.",
        sentAtIso: action.sentAtIso,
        firstResponseAtIso: action.firstResponseAtIso,
      });

      // Community posts count as "prepared" rather than "sent"
      sent++;
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
