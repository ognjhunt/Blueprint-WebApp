import { logger } from "../logger";
import {
  adjustDailyCap,
  consumeDailyCaps,
  readDailyCapUsage,
  secondsUntilNextUtcDay,
  type DailyCapDecision,
  type DailyCapOptions,
} from "./durableDailyCaps";

/**
 * The free beta's durable spend and abuse caps.
 *
 * Every anonymous intake, upload and model review costs Blueprint money, and
 * sign-up is open. These caps bound one UTC day of that cost no matter how many
 * times the single instance restarts. They sit behind the existing in-memory
 * limiters, which still absorb bursts before anything reaches Firestore.
 *
 * Defaults are sized from the observed beta, not from hope: the invited cohort
 * is 3–5 sites, the Resend free plan sends 100 emails a day, and a typical
 * walkthrough is about 60 MB (2 GiB is the upload ceiling). Each default is an
 * env var so the founder can raise it in Render without a deploy. A limit of 0
 * closes that path; there is no "unlimited" value on purpose.
 */

type Env = NodeJS.ProcessEnv;

function limitFromEnv(env: Env, key: string, fallback: number): number {
  const raw = String(env[key] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function usdFromEnv(env: Env, key: string, fallback: number): number {
  const raw = String(env[key] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/* ------------------------------------------------------------ intake */

export const INTAKE_CAP_DEFAULTS = {
  /** ~10x the invited cohort's busiest plausible day; keeps link-only ops emails at half the Resend free quota. */
  global: 50,
  /** An office NAT can carry several honest sites; one network cannot open the day's whole quota. */
  perIp: 20,
  /** The 15-minute limiter allows 3; a person rarely starts more than a handful of jobs in a day. */
  perEmail: 5,
} as const;

export function intakeCapLimits(env: Env = process.env) {
  return {
    global: limitFromEnv(env, "BLUEPRINT_INTAKE_DAILY_LIMIT", INTAKE_CAP_DEFAULTS.global),
    perIp: limitFromEnv(env, "BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", INTAKE_CAP_DEFAULTS.perIp),
    perEmail: limitFromEnv(env, "BLUEPRINT_INTAKE_PER_EMAIL_DAILY_LIMIT", INTAKE_CAP_DEFAULTS.perEmail),
  };
}

/**
 * Group the addresses one mailbox receives: lower case, `+tag` removed, and
 * dots removed for Gmail. Over-grouping a rare provider that treats `+`
 * literally costs that person a cap, which is the safe direction here.
 */
export function mailboxSubject(address: string): string {
  const value = address.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0) return value;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  local = local.split("+")[0] || local;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/**
 * One durable admission per intake. The request id is the idempotency key, so
 * a retried or racing submission of the same request is never charged twice.
 */
export function admitIntake(input: { requestId: string; clientIp: string; email: string; failClosed: boolean },
  options: DailyCapOptions = {}): Promise<DailyCapDecision> {
  const limits = intakeCapLimits(options.env ?? process.env);
  return consumeDailyCaps({
    scope: "inbound_intake",
    idempotencyKey: input.requestId,
    failClosed: input.failClosed,
    caps: [
      { name: "intake_global", limit: limits.global },
      { name: "intake_ip", limit: limits.perIp, subject: input.clientIp },
      { name: "intake_email", limit: limits.perEmail, subject: mailboxSubject(input.email) },
    ],
  }, options);
}

const CONTACT = "email hello@tryblueprint.io";

/** Short, human, and specific enough to act on. Never names the limit's value. */
export function intakeRefusal(decision: Exclude<DailyCapDecision, { allowed: true }>) {
  if (decision.reason === "store_unavailable") {
    return { status: 503, code: "intake_capacity_unavailable", retryAfterSeconds: decision.retryAfterSeconds,
      message: `We could not accept new requests just now. Please try again in a minute, or ${CONTACT}.` };
  }
  const message = decision.cap === "intake_ip"
    ? `Too many requests have come from this network today. Please try again tomorrow, or ${CONTACT}.`
    : decision.cap === "intake_email"
      ? `This email address has started several requests today. Please try again tomorrow, or ${CONTACT}.`
      : `We have reached today's limit for new requests. Please try again tomorrow, or ${CONTACT}.`;
  return { status: 429, code: `${decision.cap}_daily_limit`, retryAfterSeconds: decision.retryAfterSeconds, message };
}

/* ------------------------------------------------------------ intake messages to unverified addresses */

export const INTAKE_EMAIL_CAP_DEFAULTS = {
  /** With ≤50 ops notices, keeps one day of intake email under the Resend free plan's 100/day. */
  global: 40,
  /** Enough for an honest site's second job; a third party cannot be flooded. */
  perRecipient: 2,
} as const;

export function intakeEmailCapLimits(env: Env = process.env) {
  return {
    global: limitFromEnv(env, "BLUEPRINT_INTAKE_EMAIL_DAILY_LIMIT", INTAKE_EMAIL_CAP_DEFAULTS.global),
    perRecipient: limitFromEnv(env, "BLUEPRINT_INTAKE_EMAIL_PER_RECIPIENT_DAILY_LIMIT", INTAKE_EMAIL_CAP_DEFAULTS.perRecipient),
  };
}

export type IntakeMessageSuppressionReason = "recipient_daily_limit" | "global_daily_limit" | "cap_store_unavailable";
export type IntakeMessageAdmission = { send: true } | { send: false; reason: IntakeMessageSuppressionReason; day: string };

/**
 * Whether an intake may message an address nobody has verified yet: the
 * first-touch confirmation, or the film-link handoff to a named filmer. One
 * admission per request and kind. Always fail closed: skipping an email is
 * cheap and the submit response still carries the private link.
 */
export async function admitIntakeMessage(input: { requestId: string; recipient: string; kind: "confirmation" | "filmer_handoff" },
  options: DailyCapOptions = {}): Promise<IntakeMessageAdmission> {
  const limits = intakeEmailCapLimits(options.env ?? process.env);
  const recipient = input.recipient.includes("@") ? mailboxSubject(input.recipient) : input.recipient.replace(/[^\d+]/g, "");
  const decision = await consumeDailyCaps({
    scope: `intake_message_${input.kind}`,
    idempotencyKey: input.requestId,
    failClosed: true,
    caps: [
      { name: "intake_message_global", limit: limits.global },
      { name: "intake_message_recipient", limit: limits.perRecipient, subject: recipient },
    ],
  }, options);
  if (decision.allowed) return { send: true };
  const reason: IntakeMessageSuppressionReason = decision.reason === "store_unavailable" ? "cap_store_unavailable"
    : decision.cap === "intake_message_recipient" ? "recipient_daily_limit" : "global_daily_limit";
  return { send: false, reason, day: decision.day };
}

/** The typed record kept on the request when an intake message is not sent. */
export function intakeMessageSuppression(kind: "task_received" | "confirmation" | "filmer_handoff",
  admission: Extract<IntakeMessageAdmission, { send: false }>, now: Date = new Date()) {
  return { schema_version: "intake_message_suppression.v1", kind, reason: admission.reason, day: admission.day,
    recorded_at_iso: now.toISOString() };
}

/* ------------------------------------------------------------ upload admissions */

const MIB = 1024 * 1024;
export const UPLOAD_CAP_DEFAULTS_MB = {
  /** ~340 typical 60 MB walkthroughs or ten 2 GiB uploads; bounds a month of junk to ~600 GB. */
  global: 20_480,
  /** One full 2 GiB upload plus one complete retry. */
  perJob: 4_096,
} as const;

export function uploadCapLimitsBytes(env: Env = process.env) {
  return {
    global: limitFromEnv(env, "BLUEPRINT_UPLOAD_DAILY_MB_LIMIT", UPLOAD_CAP_DEFAULTS_MB.global) * MIB,
    perJob: limitFromEnv(env, "BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT", UPLOAD_CAP_DEFAULTS_MB.perJob) * MIB,
  };
}

/**
 * Charge an upload admission by the bytes it lets into storage, before any of
 * them are accepted. `jobId` is null for uploads that belong to no job (the
 * contact form), which count against the global cap only. An idempotency key
 * (a part index, a bundle plan) keeps a retry of the same bytes from paying
 * twice.
 */
export function admitUploadBytes(input: { jobId: string | null; bytes: number; idempotencyKey?: string | null; failClosed: boolean },
  options: DailyCapOptions = {}): Promise<DailyCapDecision> {
  const limits = uploadCapLimitsBytes(options.env ?? process.env);
  return consumeDailyCaps({
    scope: "upload_bytes",
    idempotencyKey: input.idempotencyKey ?? null,
    failClosed: input.failClosed,
    amount: Math.max(1, Math.ceil(input.bytes)),
    caps: [
      { name: "upload_bytes_global", limit: limits.global },
      ...(input.jobId ? [{ name: "upload_bytes_job", limit: limits.perJob, subject: input.jobId }] : []),
    ],
  }, options);
}

export function uploadRefusal(decision: Exclude<DailyCapDecision, { allowed: true }>) {
  if (decision.reason === "store_unavailable") {
    return { status: 503, retryAfterSeconds: decision.retryAfterSeconds, body: { code: "upload_capacity_unavailable",
      error: "Uploads are unavailable right now. Keep the original file and try again shortly." } };
  }
  return { status: 429, retryAfterSeconds: decision.retryAfterSeconds, body: {
    code: decision.cap === "upload_bytes_job" ? "upload_job_daily_limit" : "upload_daily_limit",
    error: decision.cap === "upload_bytes_job"
      ? "This job has received as much footage as we can take today. Keep the original file and try again tomorrow."
      : "We have reached today's upload limit. Keep the original file and try again tomorrow, or email hello@tryblueprint.io.",
  } };
}

/* ------------------------------------------------------------ model review spend */

export const MODEL_REVIEW_DAILY_CAP = "model_review_spend_micro_usd";
export const MODEL_REVIEW_USD_DEFAULTS = {
  /**
   * Per site assessment: covers the worst-case reservation of three Gemini
   * video probes ($1.82 each at full context) and ten Sol turns ($0.33 each)
   * with no usage reported at all.
   */
  perReview: 10,
  /** Five reviews at that worst case, or many more once usage is reconciled. */
  daily: 50,
} as const;

export function modelReviewPerReviewUsdCap(env: Env = process.env): number {
  return usdFromEnv(env, "BLUEPRINT_SITE_ASSESSMENT_REVIEW_USD_CAP", MODEL_REVIEW_USD_DEFAULTS.perReview);
}

export function modelReviewDailyUsdCap(env: Env = process.env): number {
  return usdFromEnv(env, "BLUEPRINT_SITE_ASSESSMENT_DAILY_USD_CAP", MODEL_REVIEW_USD_DEFAULTS.daily);
}

const toMicroUsd = (usd: number) => Math.ceil(usd * 1e6);

export type ModelReviewSpendReservation = {
  day: string;
  reserved_micro_usd: number;
  daily_cap_usd: number;
};

/**
 * Reserve a model call's worst-case cost against today's durable USD cap,
 * before the call. Throws `site_assessment_daily_cost_cap` when the call would
 * exceed it, and fails closed when the counter cannot be written.
 */
export async function reserveModelReviewSpend(reservedUsd: number, options: DailyCapOptions = {}): Promise<ModelReviewSpendReservation> {
  if (!Number.isFinite(reservedUsd) || reservedUsd <= 0) throw new Error("site_assessment_exposure_invalid");
  const capUsd = modelReviewDailyUsdCap(options.env ?? process.env);
  const amount = toMicroUsd(reservedUsd);
  const decision = await consumeDailyCaps({ scope: "model_review_spend", failClosed: true, amount,
    caps: [{ name: MODEL_REVIEW_DAILY_CAP, limit: toMicroUsd(capUsd) }] }, options);
  if (!decision.allowed) {
    throw new Error(decision.reason === "store_unavailable" ? "site_assessment_cost_unresolved" : "site_assessment_daily_cost_cap");
  }
  return { day: decision.day, reserved_micro_usd: amount, daily_cap_usd: capUsd };
}

/** Give back an unused reservation (the call was never dispatched). Best effort. */
export async function releaseModelReviewSpend(reservation: ModelReviewSpendReservation, options: DailyCapOptions = {}) {
  await adjustDailyCap({ name: MODEL_REVIEW_DAILY_CAP, day: reservation.day, delta: -reservation.reserved_micro_usd }, options);
}

/**
 * Replace the worst-case reservation with the priced usage. Unknown usage
 * keeps the full reservation, which is the conservative reading. Best effort:
 * a failed write leaves the larger reservation in place.
 */
export async function reconcileModelReviewSpend(reservation: ModelReviewSpendReservation, actualUsd: number | null,
  options: DailyCapOptions = {}) {
  if (actualUsd === null || !Number.isFinite(actualUsd) || actualUsd < 0) return;
  const delta = toMicroUsd(actualUsd) - reservation.reserved_micro_usd;
  if (delta === 0) return;
  await adjustDailyCap({ name: MODEL_REVIEW_DAILY_CAP, day: reservation.day, delta }, options);
}

export type ModelReviewHeadroom =
  | { available: true; day: string }
  | { available: false; day: string; reason: "daily_usd_cap_reached" | "spend_counter_unavailable";
      cap_usd: number; reserved_usd: number | null; retry_after_seconds: number };

/**
 * Read-only: is there room today for at least `needUsd` more? Queues call this
 * before claiming work, so a review that cannot be paid for stays pending
 * instead of failing after it has started. Unreadable counts as no room.
 */
export async function modelReviewHeadroom(needUsd: number, options: DailyCapOptions = {}): Promise<ModelReviewHeadroom> {
  const capUsd = modelReviewDailyUsdCap(options.env ?? process.env);
  const now = options.now ? options.now() : new Date();
  const usage = await readDailyCapUsage({ name: MODEL_REVIEW_DAILY_CAP }, { ...options, now: () => now });
  const retryAfter = secondsUntilNextUtcDay(now);
  if (!usage) {
    return { available: false, day: now.toISOString().slice(0, 10), reason: "spend_counter_unavailable", cap_usd: capUsd,
      reserved_usd: null, retry_after_seconds: 60 };
  }
  if (usage.used + toMicroUsd(needUsd) > toMicroUsd(capUsd)) {
    logger.warn({ day: usage.day, reservedUsd: usage.used / 1e6, capUsd }, "Model review daily USD cap leaves no room");
    return { available: false, day: usage.day, reason: "daily_usd_cap_reached", cap_usd: capUsd,
      reserved_usd: usage.used / 1e6, retry_after_seconds: retryAfter };
  }
  return { available: true, day: usage.day };
}
