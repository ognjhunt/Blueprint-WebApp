import { google } from "googleapis";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getEmailTransportStatus, sendEmail } from "./email";
import { sendSlackMessage } from "./slack";
import type {
  PostSignupSchedulingOutput,
  PostSignupSchedulingTaskInput,
} from "../agents/tasks/post-signup-scheduling";

type ActionStatus =
  | "executed"
  | "blocked_missing_config"
  | "blocked_missing_schedule"
  | "blocked_missing_contact"
  | "skipped"
  | "failed";

export type ActionResult = {
  status: ActionStatus;
  detail: string;
  id?: string | null;
  block_reason_code?: string | null;
  retryable?: boolean;
};

type BookingRecord = {
  date?: string;
  time?: string;
  demoScheduleDate?: string;
  demoScheduleTime?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
};

type BlueprintRecord = {
  businessName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type SheetLookupResult =
  | {
      found: true;
      rowIndex: number;
      row: Record<string, string>;
      headers: string[];
      values: string[];
    }
  | {
      found: false;
      reason: ActionStatus;
      detail: string;
    };

export type ResolvedPostSignupContext = {
  booking: BookingRecord | null;
  blueprint: BlueprintRecord | null;
  sheetRow: SheetLookupResult | null;
  resolvedContact: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    return null;
  }
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
    ],
  });
}

async function loadBookingByBlueprintId(blueprintId: string) {
  if (!db) {
    return null;
  }
  const snapshot = await db
    .collection("bookings")
    .where("blueprintId", "==", blueprintId)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0].data() as BookingRecord;
}

async function loadBlueprint(blueprintId: string) {
  if (!db) {
    return null;
  }
  const snapshot = await db.collection("blueprints").doc(blueprintId).get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data() as BlueprintRecord;
}

async function lookupSheetRow(input: {
  companyUrl?: string;
  contactEmail?: string;
}): Promise<SheetLookupResult> {
  const spreadsheetId =
    process.env.POST_SIGNUP_SPREADSHEET_ID?.trim() ||
    process.env.SPREADSHEET_ID?.trim();
  const sheetName = process.env.POST_SIGNUP_SHEET_NAME?.trim() || "Inbound (Website)";
  const auth = getGoogleAuth();

  if (!spreadsheetId || !auth) {
    return {
      found: false,
      reason: "blocked_missing_config",
      detail: "Google Sheets is not configured for post-signup workflows.",
    };
  }

  const sheets = google.sheets({ version: "v4", auth });
  const range = `${sheetName}!A1:Z1000`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = response.data.values || [];
  if (rows.length < 2) {
    return {
      found: false,
      reason: "skipped",
      detail: "No rows are available in the configured post-signup sheet.",
    };
  }

  const headers = rows[0].map((value) => String(value || "").trim());
  const websiteIndex = headers.findIndex((header) => header.toLowerCase() === "website");
  const emailIndex = headers.findIndex((header) => header.toLowerCase() === "email");

  const normalizedWebsite = String(input.companyUrl || "").trim().toLowerCase();
  const normalizedEmail = String(input.contactEmail || "").trim().toLowerCase();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index].map((value) => String(value || ""));
    const rowWebsite =
      websiteIndex >= 0 ? String(values[websiteIndex] || "").trim().toLowerCase() : "";
    const rowEmail =
      emailIndex >= 0 ? String(values[emailIndex] || "").trim().toLowerCase() : "";
    if (
      (normalizedWebsite && rowWebsite && rowWebsite === normalizedWebsite) ||
      (normalizedEmail && rowEmail && rowEmail === normalizedEmail)
    ) {
      const row: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        row[header] = String(values[headerIndex] || "");
      });
      return {
        found: true,
        rowIndex: index + 1,
        row,
        headers,
        values,
      };
    }
  }

  return {
    found: false,
    reason: "skipped",
    detail: "No matching Google Sheets row was found for this signup.",
  };
}

async function updateSheetRow(
  row: Extract<SheetLookupResult, { found: true }>,
  fields: Record<string, string>,
) {
  const spreadsheetId =
    process.env.POST_SIGNUP_SPREADSHEET_ID?.trim() ||
    process.env.SPREADSHEET_ID?.trim();
  const sheetName = process.env.POST_SIGNUP_SHEET_NAME?.trim() || "Inbound (Website)";
  const auth = getGoogleAuth();
  if (!spreadsheetId || !auth) {
    return {
      status: "blocked_missing_config" as const,
      detail: "Google Sheets is not configured for post-signup workflows.",
    };
  }

  const nextValues = [...row.values];
  row.headers.forEach((header, index) => {
    if (fields[header] !== undefined) {
      nextValues[index] = fields[header];
    }
  });

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${row.rowIndex}:Z${row.rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [nextValues],
    },
  });

  return {
    status: "executed" as const,
    detail: `Updated Google Sheets row ${row.rowIndex}.`,
    id: String(row.rowIndex),
  };
}

function parseLocalDateTime(date?: string | null, time?: string | null) {
  if (!date || !time) {
    return null;
  }
  const candidate = new Date(`${date}T${time}`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  return candidate;
}

async function createCalendarEvent(params: {
  title: string;
  description: string;
  address: string;
  mappingDate?: string | null;
  mappingTime?: string | null;
  contactEmail?: string | null;
}) {
  const auth = getGoogleAuth();
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  if (!auth || !calendarId) {
    return {
      status: "blocked_missing_config" as const,
      detail: "Google Calendar is not configured for post-signup workflows.",
    };
  }
  const start = parseLocalDateTime(params.mappingDate, params.mappingTime);
  if (!start) {
    return {
      status: "blocked_missing_schedule" as const,
      detail: "No mapping schedule is available for calendar event creation.",
    };
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.title,
      description: params.description,
      location: params.address,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: params.contactEmail ? [{ email: params.contactEmail }] : undefined,
    },
  });

  return {
    status: "executed" as const,
    detail: "Created Google Calendar event for the mapped signup.",
    id: response.data.id || null,
  };
}

export async function resolvePostSignupExecutionContext(
  input: PostSignupSchedulingTaskInput,
): Promise<ResolvedPostSignupContext> {
  const [booking, blueprint, sheetRow] = await Promise.all([
    loadBookingByBlueprintId(input.blueprintId),
    loadBlueprint(input.blueprintId),
    lookupSheetRow({
      companyUrl: input.companyUrl,
      contactEmail: input.contactEmail,
    }),
  ]);

  const sheetContactName =
    sheetRow && sheetRow.found ? sheetRow.row["Name"]?.trim() || null : null;
  const sheetContactEmail =
    sheetRow && sheetRow.found ? sheetRow.row["Email"]?.trim() || null : null;

  return {
    booking,
    blueprint,
    sheetRow,
    resolvedContact: {
      name:
        input.contactName ||
        booking?.contactName ||
        sheetContactName ||
        blueprint?.name ||
        blueprint?.businessName ||
        null,
      email:
        input.contactEmail ||
        booking?.email ||
        sheetContactEmail ||
        blueprint?.email ||
        null,
      phone: input.contactPhone || booking?.contactPhone || blueprint?.phone || null,
    },
  };
}

function deriveWorkflowStatus(results: Record<string, ActionResult>) {
  const statuses = Object.values(results).map((result) => result.status);
  const hasFailed = statuses.includes("failed");
  const hasBlocked = statuses.some((status) => status.startsWith("blocked_"));
  if (hasFailed) {
    return "failed";
  }
  if (hasBlocked) {
    return "blocked";
  }
  return "completed";
}

function withActionMetadata(result: ActionResult): ActionResult {
  if (result.status.startsWith("blocked_")) {
    return {
      ...result,
      block_reason_code: result.status,
      retryable: true,
    };
  }

  return {
    ...result,
    block_reason_code: null,
    retryable: false,
  };
}

function collectBlockingReasonCodes(results: Record<string, ActionResult>) {
  return Object.values(results)
    .map((result) => result.block_reason_code)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export async function executePostSignupDirectActions(params: {
  input: PostSignupSchedulingTaskInput;
  scheduling: PostSignupSchedulingOutput;
  context: ResolvedPostSignupContext;
}) {
  const { input, scheduling, context } = params;
  const actionPlan = scheduling.action_plan;
  const actionResults: Record<string, ActionResult> = {};

  actionResults.resolve_contact = withActionMetadata({
    status: actionPlan.resolve_contact
      ? context.resolvedContact.email || context.resolvedContact.name
        ? "executed"
        : "blocked_missing_contact"
      : "skipped",
    detail: context.resolvedContact.email || context.resolvedContact.name
      ? `Resolved contact ${context.resolvedContact.name || "Unknown"}${
          context.resolvedContact.email ? ` <${context.resolvedContact.email}>` : ""
        }.`
      : "No contact could be resolved from payload, Firestore, or Google Sheets.",
  });

  if (actionPlan.create_calendar_event) {
    actionResults.calendar = withActionMetadata(
      await createCalendarEvent({
        title: actionPlan.calendar_title,
        description: actionPlan.calendar_description,
        address: input.address,
        mappingDate: input.mappingDate || context.booking?.date || null,
        mappingTime: input.mappingTime || context.booking?.time || null,
        contactEmail: context.resolvedContact.email,
      }),
    );
  } else {
    actionResults.calendar = withActionMetadata({
      status: "skipped",
      detail: "Calendar event creation was not requested by the action plan.",
    });
  }

  if (actionPlan.send_confirmation_email) {
    const emailStatus = getEmailTransportStatus();
    if (!emailStatus.configured) {
      actionResults.email = withActionMetadata({
        status: "blocked_missing_config",
        detail: "SMTP is not configured for direct email delivery.",
      });
    } else if (!context.resolvedContact.email) {
      actionResults.email = withActionMetadata({
        status: "blocked_missing_contact",
        detail: "No contact email is available for post-signup confirmation.",
      });
    } else {
      const emailResult = await sendEmail({
        to: context.resolvedContact.email,
        subject: scheduling.confirmations.email.subject,
        text: scheduling.confirmations.email.body,
      });
      actionResults.email = withActionMetadata(emailResult.sent
        ? {
            status: "executed",
            detail: `Sent confirmation email to ${context.resolvedContact.email}.`,
          }
        : {
            status: "failed",
            detail: "SMTP send failed for the post-signup confirmation email.",
          });
    }
  } else {
    actionResults.email = withActionMetadata({
      status: "skipped",
      detail: "Confirmation email sending was not requested by the action plan.",
    });
  }

  if (actionPlan.send_slack_notification) {
    const slackResult = await sendSlackMessage(scheduling.confirmations.slack);
    actionResults.slack = withActionMetadata(slackResult.sent
      ? {
          status: "executed",
          detail: "Posted Slack notification for the post-signup workflow.",
        }
      : {
          status: "blocked_missing_config",
          detail: "Slack webhook is not configured for post-signup notifications.",
        });
  } else {
    actionResults.slack = withActionMetadata({
      status: "skipped",
      detail: "Slack notification sending was not requested by the action plan.",
    });
  }

  if (actionPlan.update_google_sheet) {
    if (!context.sheetRow || !context.sheetRow.found) {
      actionResults.google_sheet = withActionMetadata({
        status: context.sheetRow?.reason || "skipped",
        detail: context.sheetRow?.detail || "No matching Google Sheets row was found to update.",
      });
    } else {
      actionResults.google_sheet = withActionMetadata(
        await updateSheetRow(context.sheetRow, {
          "Have they picked a date+time for mapping?":
            input.mappingDate || context.booking?.date ? "Yes" : "No",
          "Contact Name": context.resolvedContact.name || "",
          "Contact Phone Number": context.resolvedContact.phone || "",
          "Post Signup Workflow Status": actionPlan.sheet_status_note,
        }),
      );
    }
  } else {
    actionResults.google_sheet = withActionMetadata({
      status: "skipped",
      detail: "Google Sheets update was not requested by the action plan.",
    });
  }

  const status = deriveWorkflowStatus(actionResults);
  const blockingReasonCodes = collectBlockingReasonCodes(actionResults);

  return {
    status,
    actionResults,
    blockingReasonCodes,
    retryable: status === "blocked" && blockingReasonCodes.length > 0,
  };
}
