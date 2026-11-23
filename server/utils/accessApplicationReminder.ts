/**
 * The application receipt says the answer comes within three working days (owner, 2026-11-23). When an application
 * has waited that long without a decision, the owner gets one reminder through the existing ops alert route
 * (`sendRateLimitedOpsAlert`, the ops Slack). Once per application: the marker is a create-only doc in its own
 * collection, as `alertOutboxRowsOnce` does it. The reminder names the approvals page only, never the applicant.
 */
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { appBaseUrl } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { ROBOT_TEAM_ACCESS_COLLECTION } from "./robotTeamEarlyAccess";

export const ACCESS_ANSWER_WORKING_DAYS = 3;
const REMINDER_COLLECTION = "opsAccessApplicationReminders";

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

type Doc = { id: string; data: () => Record<string, unknown> | undefined };
type Page = { startAfter: (id: string) => Page; get: () => Promise<{ docs: Doc[] }> };
type Store = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      orderBy: (field: string) => { limit: (n: number) => Page };
    };
    doc: (id: string) => {
      create: (data: Record<string, unknown>) => Promise<unknown>;
      delete: () => Promise<unknown>;
    };
  };
};

/** Every pending application, paged by document id so none past the first page is missed. */
async function pendingApplications(store: Store): Promise<Doc[]> {
  const all: Doc[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "applied").orderBy("__name__").limit(PAGE_SIZE);
    if (after) query = query.startAfter(after);
    const { docs } = await query.get();
    all.push(...docs);
    if (docs.length < PAGE_SIZE) return all;
    after = docs[docs.length - 1].id;
  }
  logger.warn({ pages: MAX_PAGES }, "Pending application scan stopped at its page bound");
  return all;
}

/** The time `days` working days (Monday to Friday, UTC; public holidays are not counted out) after `iso`. */
export function workingDaysAfter(iso: string, days: number): number | null {
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) return null;
  const at = new Date(start);
  for (let counted = 0; counted < days;) {
    at.setUTCDate(at.getUTCDate() + 1);
    const weekday = at.getUTCDay();
    if (weekday !== 0 && weekday !== 6) counted += 1;
  }
  return at.getTime();
}

export async function remindWaitingAccessApplications(options: {
  store?: Store | null;
  now?: () => number;
  alert?: (key: string, message: string) => Promise<unknown>;
} = {}): Promise<{ waiting: number; reminded: number }> {
  const store = options.store === undefined ? (dbAdmin as unknown as Store | null) : options.store;
  if (!store) return { waiting: 0, reminded: 0 };
  const nowMs = (options.now || Date.now)();
  const docs = await pendingApplications(store);
  const waiting = docs.filter((doc) => {
    const due = workingDaysAfter(String(doc.data()?.appliedAtIso ?? ""), ACCESS_ANSWER_WORKING_DAYS);
    return due !== null && due <= nowMs;
  });
  const fresh: string[] = [];
  for (const doc of waiting) {
    try {
      await store.collection(REMINDER_COLLECTION).doc(doc.id).create({
        application_id: doc.id, applied_at_iso: String(doc.data()?.appliedAtIso ?? ""), reminded_at_iso: new Date(nowMs).toISOString() });
      fresh.push(doc.id);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") continue;
      logger.warn({ err: error, id: doc.id }, "Could not record an application reminder marker");
    }
  }
  if (!fresh.length) return { waiting: waiting.length, reminded: 0 };
  const lines = fresh.slice(0, 10).map((id) => `- ${appBaseUrl()}/admin/robot-team-access?application=${id}`);
  const more = fresh.length > 10 ? [`- …and ${fresh.length - 10} more`] : [];
  const text = [`:hourglass: Blueprint: ${fresh.length} deployment company application(s) waited ${ACCESS_ANSWER_WORKING_DAYS} working days `
    + "without an answer. The applicant was told to expect one by now. Approve or not yet:", ...lines, ...more].join("\n");
  const result = await Promise.resolve((options.alert || sendRateLimitedOpsAlert)(`robot_team_access_waiting:${fresh[0]}`, text))
    .catch(() => ({ sent: false }));
  if (!(result as { sent?: unknown } | undefined)?.sent) {
    // Not delivered: release the markers so the next monitor pass tries again.
    await Promise.all(fresh.map((id) => store.collection(REMINDER_COLLECTION).doc(id).delete().catch((error: unknown) => {
      logger.warn({ err: error, id }, "Could not release an undelivered application reminder marker");
    })));
    return { waiting: waiting.length, reminded: 0 };
  }
  return { waiting: waiting.length, reminded: fresh.length };
}
