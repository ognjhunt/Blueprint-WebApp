// @vitest-environment node
import fs from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.hoisted(() => vi.fn());
const sendSlackMessage = vi.hoisted(() => vi.fn());
const calendarInsert = vi.hoisted(() => vi.fn());
const sheetsGet = vi.hoisted(() => vi.fn());
const sheetsUpdate = vi.hoisted(() => vi.fn());
const dispatchPostSignupHumanBlocker = vi.hoisted(() => vi.fn());
const safelyDispatchHumanBlocker = vi.hoisted(() =>
  vi.fn(async (_label: string, dispatcher: () => Promise<unknown>) => dispatcher()),
);
const dbState = vi.hoisted(() => {
  const stores: Record<string, Map<string, Record<string, unknown>>> = {
    action_ledger: new Map(),
    bookings: new Map(),
    blueprints: new Map(),
  };
  let docCounter = 0;

  const mergeRecord = (
    collectionName: string,
    id: string,
    data: Record<string, unknown>,
    merge: boolean,
  ) => {
    const current = stores[collectionName].get(id) ?? { id };
    stores[collectionName].set(id, merge ? { ...current, ...data, id } : { ...data, id });
  };

  const makeDocRef = (collectionName: string, id: string) => ({
    id,
    set: vi.fn(async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      mergeRecord(collectionName, id, data, Boolean(options?.merge));
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      if (!stores[collectionName].has(id)) {
        throw new Error(`Missing doc ${collectionName}/${id}`);
      }
      mergeRecord(collectionName, id, data, true);
    }),
    get: vi.fn(async () => {
      const data = stores[collectionName].get(id);
      return {
        exists: Boolean(data),
        data: () => data ?? null,
      };
    }),
    collection: vi.fn(() => ({
      add: vi.fn(),
    })),
  });

  const makeQuery = (
    collectionName: string,
    filters: Array<{ field: string; op: string; value: unknown }> = [],
    limitCount: number | null = null,
  ) => ({
    where(field: string, op: string, value: unknown) {
      return makeQuery(collectionName, [...filters, { field, op, value }], limitCount);
    },
    limit(count: number) {
      return makeQuery(collectionName, filters, count);
    },
    async get() {
      const docs = Array.from(stores[collectionName].entries())
        .filter(([, record]) =>
          filters.every((filter) => {
            if (filter.op !== "==") {
              return false;
            }
            return record[filter.field] === filter.value;
          }),
        )
        .slice(0, limitCount ?? undefined)
        .map(([id, data]) => ({
          id,
          data: () => data,
          ref: makeDocRef(collectionName, id),
        }));

      return {
        empty: docs.length === 0,
        docs,
        size: docs.length,
      };
    },
  });

  const collection = vi.fn((name: string) => ({
    doc: (id?: string) => {
      const docId = id ?? `${name}-${++docCounter}`;
      if (!stores[name]) {
        stores[name] = new Map();
      }
      return makeDocRef(name, docId);
    },
    where: (field: string, op: string, value: unknown) =>
      makeQuery(name, [{ field, op, value }]),
  }));

  return {
    stores,
    collection,
    clear() {
      for (const store of Object.values(stores)) {
        store.clear();
      }
      docCounter = 0;
    },
  };
});

vi.mock("../utils/email", () => ({
  sendEmail,
  getEmailTransportStatus: () => ({ configured: true, enabled: true }),
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage,
}));

vi.mock("../utils/human-blocker-autonomy", () => ({
  dispatchPostSignupHumanBlocker,
  safelyDispatchHumanBlocker,
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: class GoogleAuth {},
    },
    calendar: () => ({
      events: {
        insert: calendarInsert,
      },
    }),
    sheets: () => ({
      spreadsheets: {
        values: {
          get: sheetsGet,
          update: sheetsUpdate,
        },
      },
    }),
  },
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection: dbState.collection,
  },
  storageAdmin: null,
  authAdmin: null,
}));

afterEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLIENT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_CALENDAR_ID;
  delete process.env.POST_SIGNUP_SPREADSHEET_ID;
  sendEmail.mockReset();
  sendSlackMessage.mockReset();
  calendarInsert.mockReset();
  sheetsGet.mockReset();
  sheetsUpdate.mockReset();
  dispatchPostSignupHumanBlocker.mockReset();
  safelyDispatchHumanBlocker.mockClear();
  dbState.clear();
  vi.resetModules();
});

describe("post signup direct actions", () => {
  it("executes email, slack, calendar, and sheet updates when configured", async () => {
    process.env.GOOGLE_CLIENT_EMAIL = "svc@example.com";
    process.env.GOOGLE_PRIVATE_KEY = "test-key";
    process.env.GOOGLE_CALENDAR_ID = "calendar@example.com";
    process.env.POST_SIGNUP_SPREADSHEET_ID = "sheet-id";
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    calendarInsert.mockResolvedValue({ data: { id: "evt_123" } });
    sheetsGet.mockResolvedValue({
      data: {
        values: [
          ["Name", "Email", "Website", "Post Signup Workflow Status"],
          ["Ada", "ada@example.com", "https://example.com", ""],
        ],
      },
    });
    sheetsUpdate.mockResolvedValue({});

    const { executePostSignupDirectActions } = await import("../utils/post-signup-actions");
    const result = await executePostSignupDirectActions({
      input: {
        blueprintId: "bp-1",
        companyName: "Analytical Engines",
        address: "100 Main St",
        companyUrl: "https://example.com",
        contactEmail: "ada@example.com",
        mappingDate: "2026-03-22",
        mappingTime: "10:00",
      },
      scheduling: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        confidence: 0.92,
        requires_human_review: false,
        next_action: "Send confirmation and calendar invite",
        schedule_summary: "Mapping booked and ready for outreach.",
        contact_lookup_plan: ["Resolve booking contact"],
        confirmations: {
          email: { subject: "Confirmed", body: "See you soon." },
          slack: "New signup confirmed",
        },
        action_plan: {
          resolve_contact: true,
          create_calendar_event: true,
          send_confirmation_email: true,
          send_slack_notification: true,
          update_google_sheet: true,
          calendar_title: "Blueprint mapping",
          calendar_description: "Mapping visit",
          sheet_status_note: "Post-signup actions completed",
        },
      },
      context: {
        booking: { date: "2026-03-22", time: "10:00" },
        blueprint: { businessName: "Analytical Engines" },
        sheetRow: {
          found: true,
          rowIndex: 2,
          row: {
            Name: "Ada",
            Email: "ada@example.com",
            Website: "https://example.com",
            "Post Signup Workflow Status": "",
          },
          headers: ["Name", "Email", "Website", "Post Signup Workflow Status"],
          values: ["Ada", "ada@example.com", "https://example.com", ""],
        },
        resolvedContact: {
          name: "Ada",
          email: "ada@example.com",
          phone: null,
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.actionResults.calendar.status).toBe("executed");
    expect(result.actionResults.email.status).toBe("executed");
    expect(result.actionResults.slack.status).toBe("executed");
    expect(result.actionResults.google_sheet.status).toBe("executed");
    expect(dbState.stores.action_ledger.size).toBe(4);
    expect(Array.from(dbState.stores.action_ledger.values()).every((doc) => doc.status === "sent")).toBe(true);
  });

  it("writes pending approval ledger entries and skips sends when human review is required", async () => {
    process.env.GOOGLE_CLIENT_EMAIL = "svc@example.com";
    process.env.GOOGLE_PRIVATE_KEY = "test-key";
    process.env.GOOGLE_CALENDAR_ID = "calendar@example.com";
    process.env.POST_SIGNUP_SPREADSHEET_ID = "sheet-id";
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    calendarInsert.mockResolvedValue({ data: { id: "evt_123" } });
    sheetsGet.mockResolvedValue({
      data: {
        values: [
          ["Name", "Email", "Website", "Post Signup Workflow Status"],
          ["Ada", "ada@example.com", "https://example.com", ""],
        ],
      },
    });
    sheetsUpdate.mockResolvedValue({});

    const { executePostSignupDirectActions } = await import("../utils/post-signup-actions");
    const result = await executePostSignupDirectActions({
      input: {
        blueprintId: "bp-review",
        companyName: "Analytical Engines",
        address: "100 Main St",
        companyUrl: "https://example.com",
        contactEmail: "ada@example.com",
        mappingDate: "2026-03-22",
        mappingTime: "10:00",
      },
      scheduling: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        confidence: 0.92,
        requires_human_review: true,
        next_action: "Needs review",
        schedule_summary: "Pending human approval.",
        contact_lookup_plan: ["Resolve booking contact"],
        confirmations: {
          email: { subject: "Confirmed", body: "See you soon." },
          slack: "New signup confirmed",
        },
        action_plan: {
          resolve_contact: true,
          create_calendar_event: true,
          send_confirmation_email: true,
          send_slack_notification: true,
          update_google_sheet: true,
          calendar_title: "Blueprint mapping",
          calendar_description: "Mapping visit",
          sheet_status_note: "Post-signup actions completed",
        },
      },
      context: {
        booking: { date: "2026-03-22", time: "10:00" },
        blueprint: { businessName: "Analytical Engines" },
        sheetRow: {
          found: true,
          rowIndex: 2,
          row: {
            Name: "Ada",
            Email: "ada@example.com",
            Website: "https://example.com",
            "Post Signup Workflow Status": "",
          },
          headers: ["Name", "Email", "Website", "Post Signup Workflow Status"],
          values: ["Ada", "ada@example.com", "https://example.com", ""],
        },
        resolvedContact: {
          name: "Ada",
          email: "ada@example.com",
          phone: null,
        },
      },
    });

    expect(result.status).toBe("blocked");
    expect(result.actionResults.email.status).toBe("blocked_requires_human_review");
    expect(result.actionResults.calendar.status).toBe("blocked_requires_human_review");
    expect(result.actionResults.slack.status).toBe("blocked_requires_human_review");
    expect(result.actionResults.google_sheet.status).toBe("blocked_requires_human_review");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSlackMessage).not.toHaveBeenCalled();
    expect(calendarInsert).not.toHaveBeenCalled();
    expect(sheetsUpdate).not.toHaveBeenCalled();
    expect(dbState.stores.action_ledger.size).toBe(4);
    expect(Array.from(dbState.stores.action_ledger.values()).every((doc) => doc.status === "pending_approval")).toBe(true);
    expect(dispatchPostSignupHumanBlocker).toHaveBeenCalledTimes(4);
    expect(dispatchPostSignupHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCollection: "blueprints",
        sourceDocId: "bp-review",
        approvalReason: "post_signup_requires_human_review",
      }),
    );
  });

  it("reuses the same action ledger on replay instead of sending twice", async () => {
    process.env.GOOGLE_CLIENT_EMAIL = "svc@example.com";
    process.env.GOOGLE_PRIVATE_KEY = "test-key";
    process.env.GOOGLE_CALENDAR_ID = "calendar@example.com";
    process.env.POST_SIGNUP_SPREADSHEET_ID = "sheet-id";
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    calendarInsert.mockResolvedValue({ data: { id: "evt_123" } });
    sheetsGet.mockResolvedValue({
      data: {
        values: [
          ["Name", "Email", "Website", "Post Signup Workflow Status"],
          ["Ada", "ada@example.com", "https://example.com", ""],
        ],
      },
    });
    sheetsUpdate.mockResolvedValue({});

    const { executePostSignupDirectActions } = await import("../utils/post-signup-actions");
    const baseParams = {
      input: {
        blueprintId: "bp-4",
        companyName: "Analytical Engines",
        address: "100 Main St",
        companyUrl: "https://example.com",
        contactEmail: "ada@example.com",
        mappingDate: "2026-03-22",
        mappingTime: "10:00",
      },
      scheduling: {
        automation_status: "completed" as const,
        block_reason_code: null,
        retryable: false,
        confidence: 0.92,
        requires_human_review: false,
        next_action: "Send confirmation and calendar invite",
        schedule_summary: "Mapping booked and ready for outreach.",
        contact_lookup_plan: ["Resolve booking contact"],
        confirmations: {
          email: { subject: "Confirmed", body: "See you soon." },
          slack: "New signup confirmed",
        },
        action_plan: {
          resolve_contact: true,
          create_calendar_event: true,
          send_confirmation_email: true,
          send_slack_notification: true,
          update_google_sheet: true,
          calendar_title: "Blueprint mapping",
          calendar_description: "Mapping visit",
          sheet_status_note: "Post-signup actions completed",
        },
      },
      context: {
        booking: { date: "2026-03-22", time: "10:00" },
        blueprint: { businessName: "Analytical Engines" },
        sheetRow: {
          found: true,
          rowIndex: 2,
          row: {
            Name: "Ada",
            Email: "ada@example.com",
            Website: "https://example.com",
            "Post Signup Workflow Status": "",
          },
          headers: ["Name", "Email", "Website", "Post Signup Workflow Status"],
          values: ["Ada", "ada@example.com", "https://example.com", ""],
        },
        resolvedContact: {
          name: "Ada",
          email: "ada@example.com",
          phone: null,
        },
      },
    };

    const firstResult = await executePostSignupDirectActions(baseParams);
    const secondResult = await executePostSignupDirectActions(baseParams);

    expect(firstResult.status).toBe("completed");
    expect(secondResult.status).toBe("completed");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    expect(calendarInsert).toHaveBeenCalledTimes(1);
    expect(sheetsUpdate).toHaveBeenCalledTimes(1);
    expect(dbState.stores.action_ledger.size).toBe(4);
  });

  it("returns blocked when schedule or config is missing", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: false });

    const { executePostSignupDirectActions } = await import("../utils/post-signup-actions");
    const result = await executePostSignupDirectActions({
      input: {
        blueprintId: "bp-2",
        companyName: "Analytical Engines",
        address: "100 Main St",
      },
      scheduling: {
        automation_status: "blocked",
        block_reason_code: "missing_schedule_context",
        retryable: true,
        confidence: 0.75,
        requires_human_review: false,
        next_action: "Collect scheduling info",
        schedule_summary: "No mapping slot found.",
        contact_lookup_plan: ["Resolve booking contact"],
        confirmations: {
          email: { subject: "Need details", body: "Please send your preferred time." },
          slack: "Missing mapping schedule",
        },
        action_plan: {
          resolve_contact: true,
          create_calendar_event: true,
          send_confirmation_email: true,
          send_slack_notification: true,
          update_google_sheet: true,
          calendar_title: "Blueprint mapping",
          calendar_description: "Mapping visit",
          sheet_status_note: "Missing schedule",
        },
      },
      context: {
        booking: null,
        blueprint: null,
        sheetRow: {
          found: false,
          reason: "blocked_missing_config",
          detail: "Google Sheets is not configured for post-signup workflows.",
        },
        resolvedContact: {
          name: null,
          email: null,
          phone: null,
        },
      },
    });

    expect(result.status).toBe("blocked");
    expect(result.blockingReasonCodes).toContain("blocked_missing_config");
    expect(result.actionResults.calendar.status).toBe("blocked_missing_config");
    expect(result.actionResults.google_sheet.status).toBe("blocked_missing_config");
  });

  it("reuses GOOGLE_APPLICATION_CREDENTIALS for post-signup Google auth", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-post-signup-creds-"));
    const credsPath = path.join(tmpDir, "service-account.json");
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    fs.writeFileSync(
      credsPath,
      JSON.stringify({
        type: "service_account",
        project_id: "blueprint-8c1ca",
        client_email: "svc@example.com",
        private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
        token_uri: "https://oauth2.googleapis.com/token",
      }),
      "utf8",
    );

    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
    process.env.GOOGLE_CALENDAR_ID = "calendar@example.com";
    process.env.POST_SIGNUP_SPREADSHEET_ID = "sheet-id";
    sendEmail.mockResolvedValue({ sent: true });
    sendSlackMessage.mockResolvedValue({ sent: true });
    calendarInsert.mockResolvedValue({ data: { id: "evt_file_creds" } });
    sheetsGet.mockResolvedValue({
      data: {
        values: [
          ["Name", "Email", "Website", "Post Signup Workflow Status"],
          ["Ada", "ada@example.com", "https://example.com", ""],
        ],
      },
    });
    sheetsUpdate.mockResolvedValue({});

    const { executePostSignupDirectActions } = await import("../utils/post-signup-actions");
    const result = await executePostSignupDirectActions({
      input: {
        blueprintId: "bp-3",
        companyName: "Analytical Engines",
        address: "100 Main St",
        companyUrl: "https://example.com",
        contactEmail: "ada@example.com",
        mappingDate: "2026-03-22",
        mappingTime: "10:00",
      },
      scheduling: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        confidence: 0.92,
        requires_human_review: false,
        next_action: "Send confirmation and calendar invite",
        schedule_summary: "Mapping booked and ready for outreach.",
        contact_lookup_plan: ["Resolve booking contact"],
        confirmations: {
          email: { subject: "Confirmed", body: "See you soon." },
          slack: "New signup confirmed",
        },
        action_plan: {
          resolve_contact: true,
          create_calendar_event: true,
          send_confirmation_email: true,
          send_slack_notification: true,
          update_google_sheet: true,
          calendar_title: "Blueprint mapping",
          calendar_description: "Mapping visit",
          sheet_status_note: "Post-signup actions completed",
        },
      },
      context: {
        booking: { date: "2026-03-22", time: "10:00" },
        blueprint: { businessName: "Analytical Engines" },
        sheetRow: {
          found: true,
          rowIndex: 2,
          row: {
            Name: "Ada",
            Email: "ada@example.com",
            Website: "https://example.com",
            "Post Signup Workflow Status": "",
          },
          headers: ["Name", "Email", "Website", "Post Signup Workflow Status"],
          values: ["Ada", "ada@example.com", "https://example.com", ""],
        },
        resolvedContact: {
          name: "Ada",
          email: "ada@example.com",
          phone: null,
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.actionResults.calendar.status).toBe("executed");
    expect(result.actionResults.google_sheet.status).toBe("executed");
  });
});
