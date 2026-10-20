/**
 * How a site's job runs today: how many times a day it is done, on how many
 * days a week, and whether people work near it.
 *
 * The site answers in one small optional form on its job page. The answers
 * turn its own measured time per cycle into the hours the job takes, and tell
 * robot fit how a robot has to work around people. They are kept here, apart
 * from the digest-bound brief, so answering never reopens a confirmed brief.
 * Server-only (Firestore's default deny).
 */
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { MAX_TIMES_PER_DAY, PEOPLE_NEARBY, type SiteOperations } from "../../client/src/data/siteReadiness";

export const SITE_TASK_OPERATIONS_COLLECTION = "siteTaskOperations";

export const operationsSaveSchema = z.object({
  timesPerDay: z.number().int().min(1).max(MAX_TIMES_PER_DAY).nullable(),
  daysPerWeek: z.number().int().min(1).max(7).nullable(),
  peopleNearby: z.enum(PEOPLE_NEARBY).nullable(),
}).strict();

export type OperationsSaveInput = z.infer<typeof operationsSaveSchema>;

const EMPTY: SiteOperations = { timesPerDay: null, daysPerWeek: null, peopleNearby: null, updatedAtIso: null };

function store() {
  if (!db) throw new Error("site_task_operations_store_unavailable");
  return db.collection(SITE_TASK_OPERATIONS_COLLECTION);
}

/** A stored record read back strictly: anything out of range reads as unanswered. */
export function operationsFrom(value: unknown): SiteOperations {
  const data = (value ?? {}) as Record<string, unknown>;
  const parsed = operationsSaveSchema.safeParse({
    timesPerDay: data.timesPerDay ?? null,
    daysPerWeek: data.daysPerWeek ?? null,
    peopleNearby: data.peopleNearby ?? null,
  });
  if (!parsed.success) return { ...EMPTY };
  return { ...parsed.data, updatedAtIso: typeof data.updatedAtIso === "string" ? data.updatedAtIso : null };
}

export async function getOperations(requestId: string): Promise<SiteOperations> {
  const snapshot = await store().doc(requestId).get();
  return snapshot.exists ? operationsFrom(snapshot.data()) : { ...EMPTY };
}

/** Replace the answers. The owner's link is the only writer. */
export async function saveOperations(requestId: string, input: OperationsSaveInput, now: () => Date = () => new Date()) {
  const updatedAtIso = now().toISOString();
  await store().doc(requestId).set({ requestId, ...input, updatedAtIso, savedByScope: "owner" });
  return { ...input, updatedAtIso } satisfies SiteOperations;
}
