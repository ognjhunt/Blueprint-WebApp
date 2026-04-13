import crypto from "node:crypto";
import fs from "node:fs";
import { google } from "googleapis";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getEmailTransportStatus, sendEmail } from "./email";
import {
  dispatchPostSignupHumanBlocker,
  safelyDispatchHumanBlocker,
} from "./human-blocker-autonomy";
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
  | "blocked_requires_human_review"
  | "skipped"
  | "failed";

export type ActionResult = {
  status: ActionStatus;
  detail: string;
  id?: string | null;
  ledgerId?: string | null;
  idempotencyKey?: string | null;
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

type GoogleServiceAccountLike = {
  client_email?: string;
  private_key?: string;
};

type LedgerStatus =
  | "pending_approval"
  | "auto_approved"
  | "executing"
  | "sent"
  | "failed"
  | "rejected";

type PostSignupLedgerRecord = {
  idempotency_key: string;
  lane: "post_signup";
  action_type: string;
  source_collection: string;
  source_doc_id: string;
  status: LedgerStatus;
  action_payload: Record<string, unknown>;
  action_result?: Record<string, unknown> | null;
  approval_reason?: string | null;
  approved_by?: string | null;
  approved_at?: unknown | null;
  rejected_by?: string | null;
  rejected_reason?: string | null;
  execution_attempts: number;
  last_execution_error?: string | null;
  last_execution_at?: unknown | null;
  sent_at?: unknown | null;
  provider_reference?: string | null;
  created_at?: unknown | null;
  updated_at?: unknown | null;
};

function loadGoogleServiceAccount(): GoogleServiceAccountLike | null {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson) as GoogleServiceAccountLike;
    } catch {
      return null;
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(credentialsPath, "utf8")) as GoogleServiceAccountLike;
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`);

  return `{${entries.join(",")}}`;
}

function createActionIdempotencyKey(
  blueprintId: string,
  actionType: string,
  payload: Record<string, unknown>,
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${blueprintId}|${actionType}|${stableStringify(payload)}`)
    .digest("hex");

  return `post-signup:${blueprintId}:${actionType}:${hash}`;
}

function makeActionResult(
  result: ActionResult,
  metadata?: Partial<Pick<ActionResult, "ledgerId" | "idempotencyKey">>,
): ActionResult {
  return {
    ...result,
    ledgerId: metadata?.ledgerId ?? result.ledgerId ?? null,
    idempotencyKey: metadata?.idempotencyKey ?? result.idempotencyKey ?? null,
  };
}

function blockedForHumanReview(detail: string, idempotencyKey?: string, ledgerId?: string | null): ActionResult {
  return {
    status: "blocked_requires_human_review",
    detail,
    ledgerId: ledgerId ?? null,
    idempotencyKey: idempotencyKey ?? null,
    block_reason_code: "requires_human_review",
    retryable: false,
  };
}

function isRetryableBlockedStatus(status: ActionStatus) {
  return status === "blocked_missing_config" ||
    status === "blocked_missing_schedule" ||
    status === "blocked_missing_contact";
}

async function readActionLedgerByIdempotencyKey(
  idempotencyKey: string,
): Promise<{ id: string; data: PostSignupLedgerRecord } | null> {
  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection("action_ledger")
    .where("idempotency_key", "==", idempotencyKey)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() as PostSignupLedgerRecord };
}

async function createActionLedgerRecord(params: {
  idempotencyKey: string;
  actionType: string;
  sourceCollection: string;
  sourceDocId: string;
  actionPayload: Record<string, unknown>;
  status: LedgerStatus;
  approvalReason?: string | null;
  actionResult?: Record<string, unknown> | null;
}): Promise<string | null> {
  if (!db) {
    return null;
  }

  const ref = db.collection("action_ledger").doc();
  await ref.set({
    idempotency_key: params.idempotencyKey,
    lane: "post_signup",
    action_type: params.actionType,
    source_collection: params.sourceCollection,
    source_doc_id: params.sourceDocId,
    status: params.status,
    action_payload: params.actionPayload,
    action_result: params.actionResult ?? null,
    approval_reason: params.approvalReason ?? null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_reason: null,
    execution_attempts: 0,
    last_execution_error: null,
    last_execution_at: null,
    sent_at: null,
    provider_reference: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return ref.id;
}

async function updateActionLedgerRecord(
  ledgerId: string,
  updates: Partial<PostSignupLedgerRecord>,
) {
  if (!db) {
    return;
  }

  await db.collection("action_ledger").doc(ledgerId).update({
    ...updates,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function summarizeLedgerActionResult(
  status: ActionStatus,
  detail: string,
  extra?: Partial<ActionResult>,
): ActionResult {
  return {
    status,
    detail,
    ...extra,
    retryable:
      extra?.retryable ??
      (status === "failed" || isRetryableBlockedStatus(status)),
  };
}

function getGoogleAuth() {
  const serviceAccount = loadGoogleServiceAccount();
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL?.trim() || serviceAccount?.client_email?.trim() || null;
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    || serviceAccount?.private_key?.replace(/\\n/g, "\n")
    || null;
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

async function runLedgeredPostSignupAction(params: {
  sourceCollection: string;
  sourceDocId: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  requiresHumanReview: boolean;
  humanReviewReason?: string | null;
  run: () => Promise<ActionResult>;
}): Promise<ActionResult> {
  const idempotencyKey = createActionIdempotencyKey(
    params.sourceDocId,
    params.actionType,
    params.actionPayload,
  );

  const existingLedger = await readActionLedgerByIdempotencyKey(idempotencyKey);

  if (existingLedger?.data.status === "sent") {
    const existingDetail =
      typeof existingLedger.data.action_result?.detail === "string"
        ? existingLedger.data.action_result.detail
        : "Post-signup action already executed.";

    return makeActionResult(
      summarizeLedgerActionResult("executed", existingDetail, {
        id: existingLedger.data.provider_reference || existingLedger.id,
        ledgerId: existingLedger.id,
        idempotencyKey,
      }),
      { ledgerId: existingLedger.id, idempotencyKey },
    );
  }

  if (existingLedger?.data.status === "pending_approval") {
    await safelyDispatchHumanBlocker("post_signup.pending_approval", () =>
      dispatchPostSignupHumanBlocker({
        sourceCollection: params.sourceCollection,
        sourceDocId: params.sourceDocId,
        actionType: params.actionType,
        approvalReason: existingLedger.data.approval_reason,
        ledgerId: existingLedger.id,
        idempotencyKey,
      }),
    );
    return blockedForHumanReview(
      "Post-signup direct actions are waiting for human approval.",
      idempotencyKey,
      existingLedger.id,
    );
  }

  if (
    existingLedger?.data.status === "auto_approved" ||
    existingLedger?.data.status === "executing"
  ) {
    return makeActionResult(
      summarizeLedgerActionResult(
        "failed",
        "Post-signup action is already in progress.",
        {
          ledgerId: existingLedger.id,
          idempotencyKey,
          retryable: true,
        },
      ),
      { ledgerId: existingLedger.id, idempotencyKey },
    );
  }

  if (params.requiresHumanReview) {
    const ledgerId =
      existingLedger?.id ??
      (await createActionLedgerRecord({
        idempotencyKey,
        actionType: params.actionType,
        sourceCollection: params.sourceCollection,
        sourceDocId: params.sourceDocId,
        actionPayload: params.actionPayload,
        status: "pending_approval",
        approvalReason:
          params.humanReviewReason || "requires_human_review",
      }));

    if (ledgerId) {
      await updateActionLedgerRecord(ledgerId, {
        status: "pending_approval",
        approval_reason: params.humanReviewReason || "requires_human_review",
      });
    }

    await safelyDispatchHumanBlocker("post_signup.requires_human_review", () =>
      dispatchPostSignupHumanBlocker({
        sourceCollection: params.sourceCollection,
        sourceDocId: params.sourceDocId,
        actionType: params.actionType,
        approvalReason: params.humanReviewReason || "requires_human_review",
        ledgerId: ledgerId || existingLedger?.id || null,
        idempotencyKey,
      }),
    );

    return blockedForHumanReview(
      "Post-signup direct actions require human review before execution.",
      idempotencyKey,
      ledgerId || existingLedger?.id || null,
    );
  }

  if (
    existingLedger?.data.status === "failed" &&
    (existingLedger.data.execution_attempts ?? 0) >= 3
  ) {
    return makeActionResult(
      summarizeLedgerActionResult(
        "failed",
        "Post-signup action reached the retry limit.",
        {
          ledgerId: existingLedger.id,
          idempotencyKey,
          block_reason_code: "max_retries_exceeded",
          retryable: false,
        },
      ),
      { ledgerId: existingLedger.id, idempotencyKey },
    );
  }

  if (!db) {
    const result = await params.run();
    return makeActionResult(result, { idempotencyKey });
  }

  const ledgerId =
    existingLedger?.id ??
    (await createActionLedgerRecord({
      idempotencyKey,
      actionType: params.actionType,
      sourceCollection: params.sourceCollection,
      sourceDocId: params.sourceDocId,
      actionPayload: params.actionPayload,
      status: "auto_approved",
    }));

  try {
    if (ledgerId) {
      await updateActionLedgerRecord(ledgerId, {
        status: "executing",
        execution_attempts: (existingLedger?.data.execution_attempts ?? 0) + 1,
        last_execution_error: null,
        last_execution_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const result = await params.run();

    if (ledgerId) {
      if (result.status === "executed") {
        await updateActionLedgerRecord(ledgerId, {
          status: "sent",
          action_result: {
            status: result.status,
            detail: result.detail,
            id: result.id ?? null,
          },
          provider_reference: result.id ?? null,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (result.status === "skipped") {
        await updateActionLedgerRecord(ledgerId, {
          status: "failed",
          action_result: {
            status: result.status,
            detail: result.detail,
          },
          last_execution_error: result.detail,
        });
      } else {
        await updateActionLedgerRecord(ledgerId, {
          status: "failed",
          action_result: {
            status: result.status,
            detail: result.detail,
            block_reason_code: result.block_reason_code ?? null,
          },
          last_execution_error: result.detail,
        });
      }
    }

    return makeActionResult(result, {
      ledgerId,
      idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ledgerId) {
      await updateActionLedgerRecord(ledgerId, {
        status: "failed",
        last_execution_error: message,
        execution_attempts: (existingLedger?.data.execution_attempts ?? 0) + 1,
        action_result: {
          status: "failed",
          detail: message,
        },
      });
    }

    return makeActionResult(
      summarizeLedgerActionResult("failed", message, {
        ledgerId,
        idempotencyKey,
        retryable: true,
      }),
      { ledgerId, idempotencyKey },
    );
  }
}

async function sendLedgeredConfirmationEmail(params: {
  sourceCollection: string;
  sourceDocId: string;
  to: string;
  subject: string;
  body: string;
  requiresHumanReview: boolean;
}): Promise<ActionResult> {
  return runLedgeredPostSignupAction({
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionType: "send_email",
    actionPayload: {
      to: params.to,
      subject: params.subject,
      body: params.body,
      purpose: "post_signup_confirmation",
    },
    requiresHumanReview: params.requiresHumanReview,
    humanReviewReason: params.requiresHumanReview ? "post_signup_requires_human_review" : null,
    run: async () => {
      if (!params.to) {
        return summarizeLedgerActionResult(
          "blocked_missing_contact",
          "No contact email is available for post-signup confirmation.",
          { retryable: true },
        );
      }

      const emailStatus = getEmailTransportStatus();
      if (!emailStatus.configured) {
        return summarizeLedgerActionResult(
          "blocked_missing_config",
          "SMTP is not configured for post-signup email delivery.",
          { retryable: true },
        );
      }

      const emailResult = await sendEmail({
        to: params.to,
        subject: params.subject,
        text: params.body,
      });

      return emailResult.sent
        ? summarizeLedgerActionResult("executed", `Sent confirmation email to ${params.to}.`, {
            id: null,
          })
        : summarizeLedgerActionResult("failed", "SMTP send failed for the post-signup confirmation email.");
    },
  });
}

async function sendLedgeredSlackNotification(params: {
  sourceCollection: string;
  sourceDocId: string;
  message: string;
  requiresHumanReview: boolean;
}): Promise<ActionResult> {
  return runLedgeredPostSignupAction({
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionType: "send_slack",
    actionPayload: {
      message: params.message,
      purpose: "post_signup_confirmation",
    },
    requiresHumanReview: params.requiresHumanReview,
    humanReviewReason: params.requiresHumanReview ? "post_signup_requires_human_review" : null,
    run: async () => {
      const slackResult = await sendSlackMessage(params.message);
      return slackResult.sent
        ? summarizeLedgerActionResult("executed", "Posted Slack notification for the post-signup workflow.")
        : summarizeLedgerActionResult(
            "blocked_missing_config",
            "Slack webhook is not configured for post-signup notifications.",
            { retryable: true },
          );
    },
  });
}

async function createLedgeredCalendarEvent(params: {
  sourceCollection: string;
  sourceDocId: string;
  title: string;
  description: string;
  address: string;
  mappingDate?: string | null;
  mappingTime?: string | null;
  contactEmail?: string | null;
  requiresHumanReview: boolean;
}): Promise<ActionResult> {
  return runLedgeredPostSignupAction({
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionType: "create_calendar_event",
    actionPayload: {
      title: params.title,
      description: params.description,
      address: params.address,
      mappingDate: params.mappingDate ?? null,
      mappingTime: params.mappingTime ?? null,
      contactEmail: params.contactEmail ?? null,
      purpose: "post_signup_mapping",
    },
    requiresHumanReview: params.requiresHumanReview,
    humanReviewReason: params.requiresHumanReview ? "post_signup_requires_human_review" : null,
    run: async () => {
      const result = await createCalendarEvent({
        title: params.title,
        description: params.description,
        address: params.address,
        mappingDate: params.mappingDate,
        mappingTime: params.mappingTime,
        contactEmail: params.contactEmail,
      });

      return summarizeLedgerActionResult(result.status, result.detail, {
        id: result.id,
        retryable: isRetryableBlockedStatus(result.status),
      });
    },
  });
}

async function updateLedgeredSheetRow(params: {
  sourceCollection: string;
  sourceDocId: string;
  row: Extract<SheetLookupResult, { found: true }>;
  fields: Record<string, string>;
  requiresHumanReview: boolean;
}): Promise<ActionResult> {
  return runLedgeredPostSignupAction({
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionType: "update_sheet",
    actionPayload: {
      rowIndex: params.row.rowIndex,
      headers: params.row.headers,
      fields: params.fields,
      purpose: "post_signup_sheet_update",
    },
    requiresHumanReview: params.requiresHumanReview,
    humanReviewReason: params.requiresHumanReview ? "post_signup_requires_human_review" : null,
    run: async () => {
      const result = await updateSheetRow(params.row, params.fields);
      return summarizeLedgerActionResult(result.status, result.detail, {
        id: result.id,
        retryable: isRetryableBlockedStatus(result.status),
      });
    },
  });
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
  const isBlocked = result.status.startsWith("blocked_");
  const retryable =
    result.retryable ??
    (isBlocked ? isRetryableBlockedStatus(result.status) : false);

  return {
    ...result,
    block_reason_code: isBlocked ? result.status : null,
    retryable,
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
  const requiresHumanReview = Boolean(scheduling.requires_human_review);
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
      await createLedgeredCalendarEvent({
        sourceCollection: "blueprints",
        sourceDocId: input.blueprintId,
        title: actionPlan.calendar_title,
        description: actionPlan.calendar_description,
        address: input.address,
        mappingDate: input.mappingDate || context.booking?.date || null,
        mappingTime: input.mappingTime || context.booking?.time || null,
        contactEmail: context.resolvedContact.email,
        requiresHumanReview,
      }),
    );
  } else {
    actionResults.calendar = withActionMetadata({
      status: "skipped",
      detail: "Calendar event creation was not requested by the action plan.",
    });
  }

  if (actionPlan.send_confirmation_email) {
    actionResults.email = withActionMetadata(
      await sendLedgeredConfirmationEmail({
        sourceCollection: "blueprints",
        sourceDocId: input.blueprintId,
        to: context.resolvedContact.email || "",
        subject: scheduling.confirmations.email.subject,
        body: scheduling.confirmations.email.body,
        requiresHumanReview,
      }),
    );
  } else {
    actionResults.email = withActionMetadata({
      status: "skipped",
      detail: "Confirmation email sending was not requested by the action plan.",
    });
  }

  if (actionPlan.send_slack_notification) {
    actionResults.slack = withActionMetadata(
      await sendLedgeredSlackNotification({
        sourceCollection: "blueprints",
        sourceDocId: input.blueprintId,
        message: scheduling.confirmations.slack,
        requiresHumanReview,
      }),
    );
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
        await updateLedgeredSheetRow({
          sourceCollection: "blueprints",
          sourceDocId: input.blueprintId,
          row: context.sheetRow,
          fields: {
            "Have they picked a date+time for mapping?":
              input.mappingDate || context.booking?.date ? "Yes" : "No",
            "Contact Name": context.resolvedContact.name || "",
            "Contact Phone Number": context.resolvedContact.phone || "",
            "Post Signup Workflow Status": actionPlan.sheet_status_note,
          },
          requiresHumanReview,
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
    requiresHumanReview:
      requiresHumanReview || status !== "completed" || blockingReasonCodes.length > 0,
  };
}
