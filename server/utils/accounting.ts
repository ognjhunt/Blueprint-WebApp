import crypto from "crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { entitlementTermForOrderItem } from "./entitlementExpiry";
import { stripeLedgerJournalTxWriter } from "./stripeLedgerJournal";

const BUYER_ORDER_COLLECTION = "buyerOrders";
const BUYER_ENTITLEMENT_COLLECTION = "marketplaceEntitlements";
const CREATOR_PAYOUT_COLLECTION = "creatorPayouts";
const CREATOR_PAYOUT_DISBURSEMENT_COLLECTION = "creatorPayoutDisbursements";
const CREATOR_EARNINGS_AGGREGATE_COLLECTION = "creatorEarningsAggregates";
const STRIPE_WEBHOOK_EVENT_COLLECTION = "stripeWebhookEvents";
const STRIPE_CHECKOUT_LINK_COLLECTION = "stripeCheckoutSessions";
const STRIPE_PAYMENT_INTENT_LINK_COLLECTION = "stripePaymentIntents";
const STRIPE_PAYOUT_LINK_COLLECTION = "stripePayouts";
const CREATOR_CAPTURE_COLLECTION = "creatorCaptures";
const CAPTURE_SUBMISSION_COLLECTION = "capture_submissions";

const READY_QUALIFICATION_STATES = new Set([
  "qualified_ready",
  "qualified_risky",
]);

const PROVISIONABLE_DELIVERY_MODES = new Set([
  "download",
  "download_link",
  "direct_download",
  "api_access",
  "hosted_session",
  "hosted_runtime",
  "file_transfer",
]);

export type BuyerOrderStatus =
  | "checkout_created"
  | "payment_pending"
  | "paid"
  | "fulfilled"
  | "payment_failed"
  | "expired"
  | "refunded"
  | "disputed";

export type BuyerOrderPaymentStatus =
  | "checkout_created"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "disputed";

export type BuyerOrderFulfillmentStatus =
  | "awaiting_payment"
  | "queued"
  | "provisioned"
  | "manual_review_required"
  | "revoked";

export type CreatorPayoutStatus =
  | "pending_qualification"
  | "review_required"
  | "approved"
  | "held_for_dispute"
  | "ineligible"
  | "in_transit"
  | "paid"
  | "disbursement_failed";

export type CreatorPayoutFundingStatus =
  | "not_required"
  | "verified"
  | "missing_verified_payout_funding_policy"
  | "unsupported_payout_funding_policy"
  | "missing_buyer_revenue_linkage"
  | "insufficient_buyer_revenue"
  | "missing_bounty_budget"
  | "insufficient_bounty_budget";

export type CreatorPayoutDisbursementStatus =
  | "initiated"
  | "in_transit"
  | "paid"
  | "failed"
  | "canceled";

export type BuyerOrderRecord = {
  id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  source: "marketplace_checkout";
  status: BuyerOrderStatus;
  payment_status: BuyerOrderPaymentStatus;
  fulfillment_status: BuyerOrderFulfillmentStatus;
  currency: string;
  item: {
    sku: string;
    title: string;
    description: string;
    item_type: string;
    quantity: number;
    license_tier: string;
    exclusivity: string;
    addons: string[];
    inventory_source: string;
    live_inventory_record_id: string | null;
    delivery_mode: string | null;
    fulfillment_status: string | null;
    rights_status: string | null;
  };
  pricing: {
    unit_amount_cents: number;
    total_amount_cents: number;
  };
  checkout: {
    success_url: string;
    cancel_url: string;
  };
  stripe: {
    checkout_session_id: string | null;
    checkout_session_url: string | null;
    payment_intent_id: string | null;
    customer_id: string | null;
    charge_id: string | null;
    livemode: boolean;
  };
  entitlement_id: string | null;
  last_webhook_event_id: string | null;
  last_webhook_event_type: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
};

export type MarketplaceEntitlementRecord = {
  id: string;
  order_id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  sku: string;
  title: string;
  item_type: string;
  license_tier: string;
  exclusivity: string;
  addons: string[];
  delivery_mode: string | null;
  access_state: "provisioned" | "manual_review_required" | "revoked" | "expired";
  granted_at: string;
  expires_at: string | null;
  license_term_hours: number | null;
  license_term_unit: "hour" | null;
  updated_at: string;
};

export type CreatorPayoutRecord = {
  id: string;
  creator_id: string;
  capture_id: string;
  scene_id: string | null;
  capture_job_id: string | null;
  buyer_request_id: string | null;
  site_submission_id: string | null;
  qualification_state: string | null;
  opportunity_state: string | null;
  status: CreatorPayoutStatus;
  recommended_status: string | null;
  base_payout_cents: number;
  approved_amount_cents: number;
  recommendation: Record<string, unknown>;
  recommendation_uri: string | null;
  payout_funding_policy: Record<string, unknown> | null;
  funding_status: CreatorPayoutFundingStatus;
  funding_blockers: string[];
  payout_funding_reconciliation: Record<string, unknown> | null;
  stripe_connect_account_id: string | null;
  disbursement_id: string | null;
  stripe_payout_id: string | null;
  last_webhook_event_id: string | null;
  last_webhook_event_type: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  paid_at: string | null;
};

export type CreatorPayoutDisbursementRecord = {
  id: string;
  creator_id: string;
  stripe_connect_account_id: string;
  payout_entry_ids: string[];
  requested_amount_cents: number;
  disbursed_amount_cents: number;
  status: CreatorPayoutDisbursementStatus;
  stripe_payout_id: string | null;
  stripe_transfer_id: string | null;
  treasury_status:
    | "awaiting_platform_funds"
    | "funded"
    | "insufficient_platform_balance"
    | "transfer_failed";
  funded_at: string | null;
  treasury_failure_reason: string | null;
  platform_available_balance_cents: number | null;
  funding_reconciliation_report: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  failed_at: string | null;
  canceled_at: string | null;
  failure_reason: string | null;
  last_webhook_event_id: string | null;
  last_webhook_event_type: string | null;
};

export type CreatorEarningsStatusTotals = Partial<
  Record<CreatorPayoutStatus, { count: number; approved_amount_cents: number }>
>;

/**
 * Running lifetime totals per payout status for one creator, maintained
 * transactionally with every creatorPayouts write and lazily backfilled from a
 * one-time history scan. Earnings/ledger reads use this instead of scanning
 * the creator's full payout history per request.
 */
export type CreatorEarningsAggregateRecord = {
  creator_id: string;
  schema: "blueprint/creator-earnings-aggregate/v1";
  status_totals: CreatorEarningsStatusTotals;
  entry_count: number;
  backfilled_at: string;
  updated_at: string;
};

type BuyerOrderDraftInput = {
  buyerUserId: string | null;
  buyerEmail: string | null;
  sku: string;
  title: string;
  description: string;
  itemType: string;
  quantity: number;
  licenseTier: string;
  exclusivity: string;
  addons: string[];
  inventorySource: string;
  liveInventoryRecordId: string | null;
  deliveryMode: string | null;
  inventoryFulfillmentStatus: string | null;
  rightsStatus: string | null;
  unitAmountCents: number;
  totalAmountCents: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function asFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  const record = toRecord(value);
  return Object.keys(record).length > 0 ? record : null;
}

function firstStringField(
  record: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    const value = asString(record[field]);
    if (value) {
      return value;
    }
  }
  return null;
}

function firstNumberField(
  record: Record<string, unknown>,
  fields: string[],
): number | null {
  for (const field of fields) {
    const value = asFiniteNumberOrNull(record[field]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function captureIdFromRecord(value: unknown): string | null {
  const record = toRecord(value);
  for (const field of ["capture_id", "captureId", "capture"]) {
    const direct = asString(record[field]);
    if (direct) {
      return direct;
    }
  }

  for (const field of ["pipeline", "item", "metadata", "fulfillment", "site", "package"]) {
    const nested = toRecord(record[field]);
    const nestedCaptureId =
      asString(nested.capture_id) ||
      asString(nested.captureId) ||
      asString(nested.capture);
    if (nestedCaptureId) {
      return nestedCaptureId;
    }
  }

  return null;
}

function copyBuyerOrder(
  value: Record<string, unknown> | BuyerOrderRecord | undefined,
): BuyerOrderRecord {
  const data = value || {};
  const item = toRecord(data.item);
  const pricing = toRecord(data.pricing);
  const checkout = toRecord(data.checkout);
  const stripe = toRecord(data.stripe);

  return {
    id: asString(data.id) || crypto.randomUUID(),
    buyer_user_id: asString(data.buyer_user_id),
    buyer_email: asString(data.buyer_email),
    source: "marketplace_checkout",
    status: (asString(data.status) as BuyerOrderStatus) || "checkout_created",
    payment_status:
      (asString(data.payment_status) as BuyerOrderPaymentStatus) ||
      "checkout_created",
    fulfillment_status:
      (asString(data.fulfillment_status) as BuyerOrderFulfillmentStatus) ||
      "awaiting_payment",
    currency: asString(data.currency) || "usd",
    item: {
      sku: asString(item.sku) || "",
      title: asString(item.title) || "",
      description: asString(item.description) || "",
      item_type: asString(item.item_type) || "",
      quantity: Math.max(1, Math.floor(asNumber(item.quantity) || 1)),
      license_tier: asString(item.license_tier) || "commercial",
      exclusivity: asString(item.exclusivity) || "non-exclusive",
      addons: asStringArray(item.addons),
      inventory_source: asString(item.inventory_source) || "static",
      live_inventory_record_id: asString(item.live_inventory_record_id),
      delivery_mode: asString(item.delivery_mode),
      fulfillment_status: asString(item.fulfillment_status),
      rights_status: asString(item.rights_status),
    },
    pricing: {
      unit_amount_cents: Math.max(0, Math.floor(asNumber(pricing.unit_amount_cents))),
      total_amount_cents: Math.max(0, Math.floor(asNumber(pricing.total_amount_cents))),
    },
    checkout: {
      success_url: asString(checkout.success_url) || "",
      cancel_url: asString(checkout.cancel_url) || "",
    },
    stripe: {
      checkout_session_id: asString(stripe.checkout_session_id),
      checkout_session_url: asString(stripe.checkout_session_url),
      payment_intent_id: asString(stripe.payment_intent_id),
      customer_id: asString(stripe.customer_id),
      charge_id: asString(stripe.charge_id),
      livemode: stripe.livemode === true,
    },
    entitlement_id: asString(data.entitlement_id),
    last_webhook_event_id: asString(data.last_webhook_event_id),
    last_webhook_event_type: asString(data.last_webhook_event_type),
    created_at: asString(data.created_at) || nowIso(),
    updated_at: asString(data.updated_at) || nowIso(),
    paid_at: asString(data.paid_at),
    fulfilled_at: asString(data.fulfilled_at),
    expired_at: asString(data.expired_at),
    refunded_at: asString(data.refunded_at),
    failure_reason: asString(data.failure_reason),
  };
}

function copyCreatorPayout(
  value: Record<string, unknown> | CreatorPayoutRecord | undefined,
): CreatorPayoutRecord {
  const data = value || {};

  return {
    id: asString(data.id) || crypto.randomUUID(),
    creator_id: asString(data.creator_id) || "",
    capture_id: asString(data.capture_id) || asString(data.id) || "",
    scene_id: asString(data.scene_id),
    capture_job_id: asString(data.capture_job_id),
    buyer_request_id: asString(data.buyer_request_id),
    site_submission_id: asString(data.site_submission_id),
    qualification_state: asString(data.qualification_state),
    opportunity_state: asString(data.opportunity_state),
    status: (asString(data.status) as CreatorPayoutStatus) || "pending_qualification",
    recommended_status: asString(data.recommended_status),
    base_payout_cents: Math.max(0, Math.floor(asNumber(data.base_payout_cents))),
    approved_amount_cents: Math.max(
      0,
      Math.floor(asNumber(data.approved_amount_cents)),
    ),
    recommendation: toRecord(data.recommendation),
    recommendation_uri: asString(data.recommendation_uri),
    payout_funding_policy: toNullableRecord(data.payout_funding_policy),
    funding_status:
      (asString(data.funding_status) as CreatorPayoutFundingStatus) ||
      "missing_verified_payout_funding_policy",
    funding_blockers: asStringArray(data.funding_blockers),
    payout_funding_reconciliation: toNullableRecord(
      data.payout_funding_reconciliation,
    ),
    stripe_connect_account_id: asString(data.stripe_connect_account_id),
    disbursement_id: asString(data.disbursement_id),
    stripe_payout_id: asString(data.stripe_payout_id),
    last_webhook_event_id: asString(data.last_webhook_event_id),
    last_webhook_event_type: asString(data.last_webhook_event_type),
    failure_reason: asString(data.failure_reason),
    created_at: asString(data.created_at) || nowIso(),
    updated_at: asString(data.updated_at) || nowIso(),
    approved_at: asString(data.approved_at),
    paid_at: asString(data.paid_at),
  };
}

function copyCreatorPayoutDisbursement(
  value: Record<string, unknown> | CreatorPayoutDisbursementRecord | undefined,
): CreatorPayoutDisbursementRecord {
  const data = value || {};

  return {
    id: asString(data.id) || crypto.randomUUID(),
    creator_id: asString(data.creator_id) || "",
    stripe_connect_account_id: asString(data.stripe_connect_account_id) || "",
    payout_entry_ids: asStringArray(data.payout_entry_ids),
    requested_amount_cents: Math.max(
      0,
      Math.floor(asNumber(data.requested_amount_cents)),
    ),
    disbursed_amount_cents: Math.max(
      0,
      Math.floor(asNumber(data.disbursed_amount_cents)),
    ),
    status:
      (asString(data.status) as CreatorPayoutDisbursementStatus) || "initiated",
    stripe_payout_id: asString(data.stripe_payout_id),
    stripe_transfer_id: asString(data.stripe_transfer_id),
    treasury_status:
      (asString(data.treasury_status) as CreatorPayoutDisbursementRecord["treasury_status"]) ||
      "awaiting_platform_funds",
    funded_at: asString(data.funded_at),
    treasury_failure_reason: asString(data.treasury_failure_reason),
    platform_available_balance_cents:
      data.platform_available_balance_cents == null
        ? null
        : Math.max(0, Math.floor(asNumber(data.platform_available_balance_cents))),
    funding_reconciliation_report: toNullableRecord(
      data.funding_reconciliation_report,
    ),
    created_at: asString(data.created_at) || nowIso(),
    updated_at: asString(data.updated_at) || nowIso(),
    paid_at: asString(data.paid_at),
    failed_at: asString(data.failed_at),
    canceled_at: asString(data.canceled_at),
    failure_reason: asString(data.failure_reason),
    last_webhook_event_id: asString(data.last_webhook_event_id),
    last_webhook_event_type: asString(data.last_webhook_event_type),
  };
}

function isAlreadyExistsError(error: unknown): boolean {
  const code = (error as { code?: string | number })?.code;
  if (code === 6 || code === "already-exists") {
    return true;
  }
  const message = String((error as Error)?.message || "").toLowerCase();
  return message.includes("already exists");
}

function determineEntitlementAccessState(
  order: BuyerOrderRecord,
): MarketplaceEntitlementRecord["access_state"] {
  const deliveryMode = (order.item.delivery_mode || "").trim().toLowerCase();
  const fulfillmentStatus = (order.item.fulfillment_status || "")
    .trim()
    .toLowerCase();

  if (
    PROVISIONABLE_DELIVERY_MODES.has(deliveryMode) ||
    ["ready", "instant", "auto_ready", "provisioned"].includes(fulfillmentStatus)
  ) {
    return "provisioned";
  }

  return "manual_review_required";
}

async function updateCreatorCaptureProjection(params: {
  captureId: string;
  creatorId: string;
  status: string;
  estimatedPayoutCents: number;
}) {
  if (!db) {
    return;
  }

  await db
    .collection(CREATOR_CAPTURE_COLLECTION)
    .doc(params.captureId)
    .set(
      {
        id: params.captureId,
        creator_id: params.creatorId,
        status: params.status,
        estimated_payout_cents: params.estimatedPayoutCents,
        earnings: {
          base_payout_cents: params.estimatedPayoutCents,
          total_payout_cents: params.estimatedPayoutCents,
        },
        updated_at: nowIso(),
      },
      { merge: true },
    );
}

async function updateCaptureSubmissionProjection(params: {
  captureId: string;
  creatorId: string;
  status: string;
  payoutCents: number;
  approvedAt?: string | null;
  paidAt?: string | null;
}) {
  if (!db) {
    return;
  }

  const payload: Record<string, unknown> = {
    creator_id: params.creatorId,
    status: params.status,
    payout_cents: params.payoutCents,
    updated_at: params.paidAt || params.approvedAt || nowIso(),
  };

  if (params.approvedAt) {
    payload.approved_at = params.approvedAt;
  }
  if (params.paidAt) {
    payload.paid_at = params.paidAt;
  }

  await db
    .collection(CAPTURE_SUBMISSION_COLLECTION)
    .doc(params.captureId)
    .set(payload, { merge: true });
}

export async function createBuyerOrderDraft(
  input: BuyerOrderDraftInput,
): Promise<BuyerOrderRecord | null> {
  if (!db) {
    return null;
  }

  const createdAt = nowIso();
  const order: BuyerOrderRecord = {
    id: crypto.randomUUID(),
    buyer_user_id: input.buyerUserId,
    buyer_email: input.buyerEmail,
    source: "marketplace_checkout",
    status: "checkout_created",
    payment_status: "checkout_created",
    fulfillment_status: "awaiting_payment",
    currency: (input.currency || "usd").toLowerCase(),
    item: {
      sku: input.sku,
      title: input.title,
      description: input.description,
      item_type: input.itemType,
      quantity: Math.max(1, Math.floor(input.quantity)),
      license_tier: input.licenseTier,
      exclusivity: input.exclusivity,
      addons: input.addons,
      inventory_source: input.inventorySource,
      live_inventory_record_id: input.liveInventoryRecordId,
      delivery_mode: input.deliveryMode,
      fulfillment_status: input.inventoryFulfillmentStatus,
      rights_status: input.rightsStatus,
    },
    pricing: {
      unit_amount_cents: Math.max(0, Math.floor(input.unitAmountCents)),
      total_amount_cents: Math.max(0, Math.floor(input.totalAmountCents)),
    },
    checkout: {
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    stripe: {
      checkout_session_id: null,
      checkout_session_url: null,
      payment_intent_id: null,
      customer_id: null,
      charge_id: null,
      livemode: false,
    },
    entitlement_id: null,
    last_webhook_event_id: null,
    last_webhook_event_type: null,
    created_at: createdAt,
    updated_at: createdAt,
    paid_at: null,
    fulfilled_at: null,
    expired_at: null,
    refunded_at: null,
    failure_reason: null,
  };

  await db.collection(BUYER_ORDER_COLLECTION).doc(order.id).set(order, { merge: true });
  return order;
}

export async function attachStripeCheckoutSessionToBuyerOrder(params: {
  orderId: string;
  checkoutSessionId: string;
  checkoutSessionUrl: string | null;
  livemode: boolean;
}) {
  if (!db) {
    return;
  }

  const updatedAt = nowIso();
  await db
    .collection(BUYER_ORDER_COLLECTION)
    .doc(params.orderId)
    .set(
      {
        stripe: {
          checkout_session_id: params.checkoutSessionId,
          checkout_session_url: params.checkoutSessionUrl,
          livemode: params.livemode,
        },
        updated_at: updatedAt,
      },
      { merge: true },
    );
  await db
    .collection(STRIPE_CHECKOUT_LINK_COLLECTION)
    .doc(params.checkoutSessionId)
    .set(
      {
        order_id: params.orderId,
        updated_at: updatedAt,
      },
      { merge: true },
    );
}

export async function markBuyerOrderCheckoutFailure(params: {
  orderId: string;
  reason: string;
}) {
  if (!db) {
    return;
  }

  await db
    .collection(BUYER_ORDER_COLLECTION)
    .doc(params.orderId)
    .set(
      {
        status: "payment_failed",
        payment_status: "failed",
        failure_reason: params.reason,
        updated_at: nowIso(),
      },
      { merge: true },
    );
}

export async function fetchBuyerOrder(orderId: string): Promise<BuyerOrderRecord | null> {
  if (!db || !orderId) {
    return null;
  }

  const snapshot = await db.collection(BUYER_ORDER_COLLECTION).doc(orderId).get();
  if (!snapshot.exists) {
    return null;
  }

  return copyBuyerOrder(snapshot.data() as Record<string, unknown>);
}

export async function findBuyerOrderByCheckoutSessionId(
  checkoutSessionId: string,
): Promise<BuyerOrderRecord | null> {
  if (!db || !checkoutSessionId) {
    return null;
  }

  const link = await db
    .collection(STRIPE_CHECKOUT_LINK_COLLECTION)
    .doc(checkoutSessionId)
    .get();
  const orderId = asString(link.data()?.order_id);

  return orderId ? fetchBuyerOrder(orderId) : null;
}

export async function findBuyerOrderByPaymentIntentId(
  paymentIntentId: string,
): Promise<BuyerOrderRecord | null> {
  if (!db || !paymentIntentId) {
    return null;
  }

  const link = await db
    .collection(STRIPE_PAYMENT_INTENT_LINK_COLLECTION)
    .doc(paymentIntentId)
    .get();
  const orderId = asString(link.data()?.order_id);

  return orderId ? fetchBuyerOrder(orderId) : null;
}

export async function markBuyerOrderPaidFromCheckout(params: {
  orderId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  livemode: boolean;
  eventId: string;
  eventType: string;
}) {
  if (!db) {
    return null;
  }

  const order = await fetchBuyerOrder(params.orderId);
  if (!order) {
    return null;
  }

  const paidAt = order.paid_at || nowIso();
  const firestore = db;
  // The paid status flip and its append-only journal entry commit atomically
  // (SCALE2-01): reconciliation can trust that a `checkout_completed` journal
  // row exists iff the order was marked paid.
  await firestore.runTransaction(async (tx) => {
    const orderRef = firestore.collection(BUYER_ORDER_COLLECTION).doc(order.id);
    const journal = stripeLedgerJournalTxWriter(firestore, tx, {
      entryType: "checkout_completed",
      discriminator: params.eventId,
      amountCents: order.pricing.total_amount_cents,
      currency: order.currency,
      direction: "buyer_revenue_in",
      orderId: order.id,
      stripeEventId: params.eventId,
      stripeEventType: params.eventType,
      occurredAt: paidAt,
      details: {
        checkout_session_id: params.checkoutSessionId,
        payment_intent_id: params.paymentIntentId,
        livemode: params.livemode,
      },
    });
    await journal.read();
    tx.set(
      orderRef,
      {
        status: "paid",
        payment_status: "paid",
        fulfillment_status: "queued",
        paid_at: paidAt,
        updated_at: paidAt,
        last_webhook_event_id: params.eventId,
        last_webhook_event_type: params.eventType,
        stripe: {
          checkout_session_id: params.checkoutSessionId,
          payment_intent_id: params.paymentIntentId,
          customer_id: params.customerId,
          livemode: params.livemode,
        },
      },
      { merge: true },
    );
    journal.append();
  });

  if (params.paymentIntentId) {
    await db
      .collection(STRIPE_PAYMENT_INTENT_LINK_COLLECTION)
      .doc(params.paymentIntentId)
      .set(
        {
          order_id: order.id,
          updated_at: paidAt,
        },
        { merge: true },
      );
  }

  const refreshed = await fetchBuyerOrder(order.id);
  if (!refreshed) {
    return null;
  }

  const entitlementId = refreshed.entitlement_id || refreshed.id;
  const accessState = determineEntitlementAccessState(refreshed);
  const fulfilledAt = accessState === "provisioned" ? paidAt : null;
  const entitlementTerm = entitlementTermForOrderItem({
    itemType: refreshed.item.item_type,
    deliveryMode: refreshed.item.delivery_mode,
    quantity: refreshed.item.quantity,
    grantedAtIso: paidAt,
  });

  const entitlement: MarketplaceEntitlementRecord = {
    id: entitlementId,
    order_id: refreshed.id,
    buyer_user_id: refreshed.buyer_user_id,
    buyer_email: refreshed.buyer_email,
    sku: refreshed.item.sku,
    title: refreshed.item.title,
    item_type: refreshed.item.item_type,
    license_tier: refreshed.item.license_tier,
    exclusivity: refreshed.item.exclusivity,
    addons: refreshed.item.addons,
    delivery_mode: refreshed.item.delivery_mode,
    access_state: accessState,
    granted_at: paidAt,
    expires_at: entitlementTerm.expires_at,
    license_term_hours: entitlementTerm.license_term_hours,
    license_term_unit: entitlementTerm.license_term_unit,
    updated_at: paidAt,
  };

  await db
    .collection(BUYER_ENTITLEMENT_COLLECTION)
    .doc(entitlementId)
    .set(entitlement, { merge: true });
  await db
    .collection(BUYER_ORDER_COLLECTION)
    .doc(refreshed.id)
    .set(
      {
        entitlement_id: entitlementId,
        fulfillment_status:
          accessState === "provisioned"
            ? "provisioned"
            : "manual_review_required",
        status: accessState === "provisioned" ? "fulfilled" : "paid",
        fulfilled_at: fulfilledAt,
        updated_at: paidAt,
      },
      { merge: true },
    );

  return fetchBuyerOrder(refreshed.id);
}

export async function markBuyerOrderPaymentFailure(params: {
  orderId: string;
  eventId: string;
  eventType: string;
  reason: string;
  expired?: boolean;
  refunded?: boolean;
  /** Stripe's cumulative charge.amount_refunded, when the event carries it. */
  refundedAmountCents?: number | null;
  refundCurrency?: string | null;
}) {
  if (!db) {
    return;
  }

  const updatedAt = nowIso();
  const firestore = db;
  const failurePayload = {
    status: params.refunded
      ? "refunded"
      : params.expired
        ? "expired"
        : "payment_failed",
    payment_status: params.refunded
      ? "refunded"
      : params.expired
        ? "expired"
        : "failed",
    refunded_at: params.refunded ? updatedAt : null,
    expired_at: params.expired ? updatedAt : null,
    failure_reason: params.reason,
    updated_at: updatedAt,
    last_webhook_event_id: params.eventId,
    last_webhook_event_type: params.eventType,
  };
  const orderRef = firestore.collection(BUYER_ORDER_COLLECTION).doc(params.orderId);
  if (!params.refunded) {
    await orderRef.set(failurePayload, { merge: true });
    return;
  }
  // Refunds are financial state transitions: the status flip and the journal
  // entry commit atomically (SCALE2-01).
  await firestore.runTransaction(async (tx) => {
    const orderSnapshot = await tx.get(orderRef);
    const orderData = (orderSnapshot.data() || {}) as Record<string, unknown>;
    const pricing = (orderData.pricing || {}) as Record<string, unknown>;
    const orderTotalCents =
      typeof pricing.total_amount_cents === "number"
        ? (pricing.total_amount_cents as number)
        : null;
    // Journal the per-event refund DELTA, not the order total: Stripe's
    // charge.amount_refunded is cumulative, and partial refunds fire one
    // event each. Tracking the previously journaled cumulative on the order
    // makes each event's entry sum correctly in reconciliation. When the
    // event carries no amount, fall back to the order total (full refund).
    const previousRefundedCents =
      typeof orderData.refunded_amount_cents === "number"
        ? (orderData.refunded_amount_cents as number)
        : 0;
    const cumulativeRefundedCents =
      typeof params.refundedAmountCents === "number" &&
      Number.isFinite(params.refundedAmountCents)
        ? Math.max(0, Math.floor(params.refundedAmountCents))
        : null;
    const refundDeltaCents =
      cumulativeRefundedCents !== null
        ? Math.max(0, cumulativeRefundedCents - previousRefundedCents)
        : orderTotalCents;
    const journal = stripeLedgerJournalTxWriter(firestore, tx, {
      entryType: "order_refunded",
      discriminator: params.eventId,
      amountCents: refundDeltaCents,
      currency:
        params.refundCurrency ||
        (typeof orderData.currency === "string" ? orderData.currency : null),
      direction: "buyer_revenue_in",
      orderId: params.orderId,
      stripeEventId: params.eventId,
      stripeEventType: params.eventType,
      occurredAt: updatedAt,
      details: {
        reason: params.reason,
        cumulative_refunded_cents: cumulativeRefundedCents,
        previously_journaled_refunded_cents: previousRefundedCents,
        amount_source:
          cumulativeRefundedCents !== null ? "stripe_charge_amount_refunded" : "order_total_fallback",
      },
    });
    await journal.read();
    tx.set(
      orderRef,
      {
        ...failurePayload,
        refunded_amount_cents:
          cumulativeRefundedCents !== null
            ? cumulativeRefundedCents
            : Math.max(previousRefundedCents, orderTotalCents ?? 0),
      },
      { merge: true },
    );
    journal.append();
  });
}

async function fetchCollectionRecord(
  collectionName: string,
  id: string | null,
): Promise<Record<string, unknown> | null> {
  if (!db || !id) {
    return null;
  }
  const snapshot = await db.collection(collectionName).doc(id).get();
  if (!snapshot.exists) {
    return null;
  }
  return {
    id: snapshot.id || id,
    ...((snapshot.data() || {}) as Record<string, unknown>),
  };
}

async function resolveBuyerOrderCaptureIds(
  order: BuyerOrderRecord,
  entitlement: Record<string, unknown> | null,
): Promise<string[]> {
  const captureIds = new Set<string>();
  const entitlementCaptureId = captureIdFromRecord(entitlement || {});
  if (entitlementCaptureId) {
    captureIds.add(entitlementCaptureId);
  }

  for (const candidateId of [
    order.item.live_inventory_record_id,
    order.item.sku,
    order.entitlement_id,
  ]) {
    if (!candidateId) {
      continue;
    }
    for (const collectionName of [
      "publishedMarketplaceInventory",
      "marketplace_items",
      BUYER_ENTITLEMENT_COLLECTION,
    ]) {
      const record = await fetchCollectionRecord(collectionName, candidateId);
      const captureId = captureIdFromRecord(record);
      if (captureId) {
        captureIds.add(captureId);
      }
    }
  }

  return Array.from(captureIds);
}

export async function markBuyerOrderDisputedFromCharge(params: {
  paymentIntentId: string | null;
  chargeId: string | null;
  disputeId: string;
  disputeStatus: string | null;
  disputeReason: string | null;
  amountCents: number | null;
  currency: string | null;
  evidenceDueBy: number | null;
  eventId: string;
  eventType: string;
}): Promise<{
  orderId: string | null;
  heldPayoutIds: string[];
  unresolvedPayoutIds: string[];
}> {
  if (!db || !params.paymentIntentId || !params.disputeId) {
    return { orderId: null, heldPayoutIds: [], unresolvedPayoutIds: [] };
  }

  const order = await findBuyerOrderByPaymentIntentId(params.paymentIntentId);
  if (!order) {
    return { orderId: null, heldPayoutIds: [], unresolvedPayoutIds: [] };
  }

  const updatedAt = nowIso();
  const disputeRecord = {
    id: params.disputeId,
    stripe_dispute_id: params.disputeId,
    status: params.disputeStatus,
    reason: params.disputeReason,
    amount_cents: params.amountCents,
    currency: params.currency,
    evidence_due_by: params.evidenceDueBy,
    charge_id: params.chargeId,
    payment_intent_id: params.paymentIntentId,
    last_webhook_event_id: params.eventId,
    last_webhook_event_type: params.eventType,
    updated_at: updatedAt,
    requires_finance_review: true,
  };

  const firestore = db;
  // Dispute open/close transitions journal atomically with the order flip
  // (SCALE2-01). charge.dispute.created opens; charge.dispute.closed resolves.
  const disputeEntryType =
    params.eventType === "charge.dispute.closed" ? "dispute_resolved" : "dispute_opened";
  await firestore.runTransaction(async (tx) => {
    const orderRef = firestore.collection(BUYER_ORDER_COLLECTION).doc(order.id);
    const journal = stripeLedgerJournalTxWriter(firestore, tx, {
      entryType: disputeEntryType,
      discriminator: params.eventId,
      amountCents: params.amountCents,
      currency: params.currency,
      direction: "neutral",
      orderId: order.id,
      stripeEventId: params.eventId,
      stripeEventType: params.eventType,
      occurredAt: updatedAt,
      details: {
        dispute_id: params.disputeId,
        dispute_status: params.disputeStatus,
        dispute_reason: params.disputeReason,
        payment_intent_id: params.paymentIntentId,
        charge_id: params.chargeId,
      },
    });
    await journal.read();
    tx.set(
      orderRef,
      {
        status: "disputed",
        payment_status: "disputed",
        fulfillment_status: "manual_review_required",
        failure_reason: "Stripe reported a buyer payment dispute.",
        disputed_at: updatedAt,
        payment_dispute: disputeRecord,
        stripe: {
          charge_id: params.chargeId,
          payment_intent_id: params.paymentIntentId,
          livemode: order.stripe.livemode,
        },
        updated_at: updatedAt,
        last_webhook_event_id: params.eventId,
        last_webhook_event_type: params.eventType,
      },
      { merge: true },
    );
    journal.append();
  });

  const entitlementId = order.entitlement_id || order.id;
  const entitlementSnapshot = await db
    .collection(BUYER_ENTITLEMENT_COLLECTION)
    .doc(entitlementId)
    .get();
  const entitlement = entitlementSnapshot.exists
    ? {
        id: entitlementSnapshot.id || entitlementId,
        ...((entitlementSnapshot.data() || {}) as Record<string, unknown>),
      }
    : null;

  if (entitlement) {
    await db
      .collection(BUYER_ENTITLEMENT_COLLECTION)
      .doc(entitlementId)
      .set(
        {
          access_state: "revoked",
          payment_dispute: disputeRecord,
          revoked_at: updatedAt,
          revocation_reason: "buyer_payment_dispute",
          updated_at: updatedAt,
        },
        { merge: true },
      );
  }

  const captureIds = await resolveBuyerOrderCaptureIds(order, entitlement);
  const heldPayoutIds: string[] = [];
  const unresolvedPayoutIds: string[] = [];
  const holdableStatuses = new Set<CreatorPayoutStatus>([
    "pending_qualification",
    "review_required",
    "approved",
    "disbursement_failed",
    "held_for_dispute",
  ]);

  for (const captureId of captureIds) {
    const payoutRef = firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(captureId);
    const result = await firestore.runTransaction<
      { outcome: "missing" } | { outcome: "held" | "unresolved"; payoutId: string }
    >(async (tx) => {
      const payoutSnapshot = await tx.get(payoutRef);
      if (!payoutSnapshot.exists) {
        return { outcome: "missing" };
      }
      const payout = copyCreatorPayout(payoutSnapshot.data() as Record<string, unknown>);
      const aggregateRef = earningsAggregateRef(firestore, payout.creator_id);
      const aggregateSnapshot = await tx.get(aggregateRef);
      if (!holdableStatuses.has(payout.status)) {
        return { outcome: "unresolved", payoutId: payout.id };
      }

      tx.set(
        firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(payout.id),
        {
          status: "held_for_dispute",
          failure_reason: "Buyer payment dispute opened before payout settlement.",
          dispute_hold: {
            ...disputeRecord,
            order_id: order.id,
            capture_id: payout.capture_id,
          },
          updated_at: updatedAt,
          last_webhook_event_id: params.eventId,
          last_webhook_event_type: params.eventType,
        },
        { merge: true },
      );
      updateEarningsAggregateInTx({
        tx,
        ref: aggregateRef,
        snapshot: aggregateSnapshot,
        creatorId: payout.creator_id,
        changes: [
          {
            previous: payoutAggregateSlice(payout),
            next: {
              status: "held_for_dispute",
              approvedAmountCents: payout.approved_amount_cents,
            },
          },
        ],
      });
      return { outcome: "held", payoutId: payout.id };
    });

    if (result.outcome === "held") {
      heldPayoutIds.push(result.payoutId);
    } else if (result.outcome === "unresolved") {
      unresolvedPayoutIds.push(result.payoutId);
    }
  }

  await db
    .collection(BUYER_ORDER_COLLECTION)
    .doc(order.id)
    .set(
      {
        payment_dispute: {
          ...disputeRecord,
          resolved_capture_ids: captureIds,
          held_payout_ids: heldPayoutIds,
          unresolved_payout_ids: unresolvedPayoutIds,
        },
      },
      { merge: true },
    );

  return {
    orderId: order.id,
    heldPayoutIds,
    unresolvedPayoutIds,
  };
}

const STRIPE_WEBHOOK_EVENT_RETENTION_DAYS_DEFAULT = 180;

// Dedupe records only (Stripe retries span days, not months); the payout
// ledger collections are permanent. expires_at feeds the Firestore TTL policy
// enabled by scripts/apply_firestore_ttl_policies.sh.
function stripeWebhookEventExpiresAt(): Date {
  const raw = Number(process.env.BLUEPRINT_STRIPE_WEBHOOK_EVENT_RETENTION_DAYS);
  const days =
    Number.isFinite(raw) && raw > 0 ? raw : STRIPE_WEBHOOK_EVENT_RETENTION_DAYS_DEFAULT;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function beginStripeWebhookEvent(
  eventId: string,
  payload: Record<string, unknown>,
): Promise<"new" | "duplicate" | "retry"> {
  if (!db || !eventId) {
    return "duplicate";
  }

  const ref = db.collection(STRIPE_WEBHOOK_EVENT_COLLECTION).doc(eventId);
  try {
    await ref.create({
      ...payload,
      status: "processing",
      created_at: nowIso(),
      updated_at: nowIso(),
      expires_at: stripeWebhookEventExpiresAt(),
    });
    return "new";
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }

  const snapshot = await ref.get();
  const status = asString(snapshot.data()?.status);
  if (status === "processed") {
    return "duplicate";
  }

  await ref.set(
    {
      ...payload,
      status: "processing",
      updated_at: nowIso(),
    },
    { merge: true },
  );
  return "retry";
}

export async function completeStripeWebhookEvent(params: {
  eventId: string;
  orderId?: string | null;
  disbursementId?: string | null;
  eventType: string;
}) {
  if (!db) {
    return;
  }

  await db
    .collection(STRIPE_WEBHOOK_EVENT_COLLECTION)
    .doc(params.eventId)
    .set(
      {
        status: "processed",
        order_id: params.orderId || null,
        disbursement_id: params.disbursementId || null,
        event_type: params.eventType,
        processed_at: nowIso(),
        updated_at: nowIso(),
      },
      { merge: true },
    );
}

export async function failStripeWebhookEvent(params: {
  eventId: string;
  eventType: string;
  reason: string;
}) {
  if (!db) {
    return;
  }

  await db
    .collection(STRIPE_WEBHOOK_EVENT_COLLECTION)
    .doc(params.eventId)
    .set(
      {
        status: "failed",
        event_type: params.eventType,
        failure_reason: params.reason,
        updated_at: nowIso(),
      },
      { merge: true },
    );
}

export async function resolveCreatorIdForCapture(
  captureId: string,
): Promise<string | null> {
  if (!db || !captureId) {
    return null;
  }

  const submission = await db
    .collection(CAPTURE_SUBMISSION_COLLECTION)
    .doc(captureId)
    .get();
  const submissionCreatorId = asString(submission.data()?.creator_id);
  if (submissionCreatorId) {
    return submissionCreatorId;
  }

  const capture = await db.collection(CREATOR_CAPTURE_COLLECTION).doc(captureId).get();
  return asString(capture.data()?.creator_id);
}

type PayoutFundingEvaluation = {
  policy: Record<string, unknown> | null;
  status: CreatorPayoutFundingStatus;
  blockers: string[];
  reconciliation: Record<string, unknown> | null;
};

function verifiedPayoutFundingPolicy(
  recommendation: Record<string, unknown>,
  approvedAmountCents: number,
): PayoutFundingEvaluation {
  const policy =
    toNullableRecord(recommendation.payout_funding_policy) ||
    toNullableRecord(recommendation.funding_policy);
  if (!policy) {
    return {
      policy: null,
      status: "missing_verified_payout_funding_policy",
      blockers: [
        "Qualified creator payouts require a buyer_revenue_linked or preapproved_bounty_budget funding policy before approval.",
      ],
      reconciliation: null,
    };
  }

  const mode = asString(policy.mode);
  if (mode === "buyer_revenue_linked") {
    const buyerOrderId = firstStringField(policy, [
      "buyer_order_id",
      "order_id",
      "buyerOrderId",
    ]);
    const realizedBuyerRevenueCents = firstNumberField(policy, [
      "realized_buyer_revenue_cents",
      "buyer_revenue_cents",
      "paid_buyer_revenue_cents",
      "settled_buyer_revenue_cents",
    ]);
    const blockers: string[] = [];
    if (!buyerOrderId) {
      blockers.push("buyer_order_id is required for buyer_revenue_linked payouts.");
    }
    if (realizedBuyerRevenueCents === null) {
      blockers.push(
        "realized_buyer_revenue_cents is required for buyer_revenue_linked payouts.",
      );
    }
    if (blockers.length > 0 || realizedBuyerRevenueCents === null) {
      return {
        policy,
        status: "missing_buyer_revenue_linkage",
        blockers,
        reconciliation: null,
      };
    }
    const normalizedRevenueCents = Math.max(
      0,
      Math.floor(realizedBuyerRevenueCents),
    );
    if (normalizedRevenueCents < approvedAmountCents) {
      return {
        policy,
        status: "insufficient_buyer_revenue",
        blockers: [
          `realized_buyer_revenue_cents (${normalizedRevenueCents}) is below approved_amount_cents (${approvedAmountCents}).`,
        ],
        reconciliation: null,
      };
    }
    return {
      policy,
      status: "verified",
      blockers: [],
      reconciliation: {
        schema: "blueprint/creator-payout-funding-reconciliation/v1",
        mode,
        buyer_order_id: buyerOrderId,
        approved_payout_cents: approvedAmountCents,
        realized_buyer_revenue_cents: normalizedRevenueCents,
        buyer_revenue_margin_cents:
          normalizedRevenueCents - approvedAmountCents,
        generated_at: nowIso(),
      },
    };
  }

  if (mode === "preapproved_bounty_budget") {
    const budgetId = firstStringField(policy, [
      "budget_id",
      "bounty_budget_id",
      "bountyBudgetId",
    ]);
    const approvedBy = firstStringField(policy, [
      "approved_by",
      "finance_owner",
      "owner",
    ]);
    const remainingBudgetCents = firstNumberField(policy, [
      "remaining_budget_cents",
      "budget_remaining_cents",
      "available_budget_cents",
    ]);
    const blockers: string[] = [];
    if (!budgetId) {
      blockers.push("budget_id is required for preapproved_bounty_budget payouts.");
    }
    if (!approvedBy) {
      blockers.push(
        "approved_by is required for preapproved_bounty_budget payouts.",
      );
    }
    if (remainingBudgetCents === null) {
      blockers.push(
        "remaining_budget_cents is required for preapproved_bounty_budget payouts.",
      );
    }
    if (blockers.length > 0 || remainingBudgetCents === null) {
      return {
        policy,
        status: "missing_bounty_budget",
        blockers,
        reconciliation: null,
      };
    }
    const normalizedBudgetCents = Math.max(0, Math.floor(remainingBudgetCents));
    if (normalizedBudgetCents < approvedAmountCents) {
      return {
        policy,
        status: "insufficient_bounty_budget",
        blockers: [
          `remaining_budget_cents (${normalizedBudgetCents}) is below approved_amount_cents (${approvedAmountCents}).`,
        ],
        reconciliation: null,
      };
    }
    return {
      policy,
      status: "verified",
      blockers: [],
      reconciliation: {
        schema: "blueprint/creator-payout-funding-reconciliation/v1",
        mode,
        budget_id: budgetId,
        approved_by: approvedBy,
        approved_payout_cents: approvedAmountCents,
        remaining_budget_cents: normalizedBudgetCents,
        budget_remaining_after_payout_cents:
          normalizedBudgetCents - approvedAmountCents,
        generated_at: nowIso(),
      },
    };
  }

  return {
    policy,
    status: "unsupported_payout_funding_policy",
    blockers: [
      "payout_funding_policy.mode must be buyer_revenue_linked or preapproved_bounty_budget.",
    ],
    reconciliation: null,
  };
}

function notRequiredPayoutFunding(): PayoutFundingEvaluation {
  return {
    policy: null,
    status: "not_required",
    blockers: [],
    reconciliation: null,
  };
}

function payoutFundingEligibleForDisbursement(entry: CreatorPayoutRecord): boolean {
  if (entry.approved_amount_cents <= 0) {
    return false;
  }
  return entry.funding_status === "verified" && Boolean(entry.payout_funding_reconciliation);
}

function buildPayoutDisbursementFundingReport(
  entries: CreatorPayoutRecord[],
  disbursedAmountCents: number,
): Record<string, unknown> {
  const entryReports = entries.map((entry) => {
    const reconciliation = toRecord(entry.payout_funding_reconciliation);
    return {
      payout_entry_id: entry.id,
      capture_id: entry.capture_id,
      mode: asString(reconciliation.mode),
      approved_payout_cents: entry.approved_amount_cents,
      buyer_order_id: asString(reconciliation.buyer_order_id),
      realized_buyer_revenue_cents: firstNumberField(reconciliation, [
        "realized_buyer_revenue_cents",
      ]),
      buyer_revenue_margin_cents: firstNumberField(reconciliation, [
        "buyer_revenue_margin_cents",
      ]),
      bounty_budget_id: asString(reconciliation.budget_id),
      remaining_budget_cents: firstNumberField(reconciliation, [
        "remaining_budget_cents",
      ]),
    };
  });
  const buyerRevenueCents = entryReports.reduce((total, report) => {
    return total + Math.max(0, Math.floor(report.realized_buyer_revenue_cents || 0));
  }, 0);
  const buyerRevenueLinkedPayoutCents = entryReports.reduce((total, report) => {
    return report.mode === "buyer_revenue_linked"
      ? total + Math.max(0, Math.floor(report.approved_payout_cents || 0))
      : total;
  }, 0);
  const fundingModes = Array.from(
    new Set(entryReports.map((report) => report.mode).filter(Boolean)),
  );

  return {
    schema: "blueprint/creator-payout-disbursement-funding-report/v1",
    payout_entry_ids: entries.map((entry) => entry.id),
    disbursed_amount_cents: disbursedAmountCents,
    realized_buyer_revenue_cents: buyerRevenueCents,
    buyer_revenue_linked_payout_cents: buyerRevenueLinkedPayoutCents,
    buyer_revenue_margin_cents:
      buyerRevenueCents - buyerRevenueLinkedPayoutCents,
    funding_modes: fundingModes,
    entry_reports: entryReports,
    generated_at: nowIso(),
  };
}

type PayoutAggregateSlice = {
  status: CreatorPayoutStatus;
  approvedAmountCents: number;
};

function payoutAggregateSlice(entry: CreatorPayoutRecord): PayoutAggregateSlice {
  return {
    status: entry.status,
    approvedAmountCents: entry.approved_amount_cents,
  };
}

function emptyCreatorEarningsAggregate(
  creatorId: string,
): CreatorEarningsAggregateRecord {
  const timestamp = nowIso();
  return {
    creator_id: creatorId,
    schema: "blueprint/creator-earnings-aggregate/v1",
    status_totals: {},
    entry_count: 0,
    backfilled_at: timestamp,
    updated_at: timestamp,
  };
}

function copyCreatorEarningsAggregate(
  creatorId: string,
  value: Record<string, unknown> | undefined,
): CreatorEarningsAggregateRecord {
  const data = value || {};
  const statusTotals: CreatorEarningsStatusTotals = {};
  for (const [status, bucket] of Object.entries(toRecord(data.status_totals))) {
    const record = toRecord(bucket);
    statusTotals[status as CreatorPayoutStatus] = {
      count: Math.max(0, Math.floor(asNumber(record.count))),
      approved_amount_cents: Math.max(
        0,
        Math.floor(asNumber(record.approved_amount_cents)),
      ),
    };
  }
  return {
    creator_id: asString(data.creator_id) || creatorId,
    schema: "blueprint/creator-earnings-aggregate/v1",
    status_totals: statusTotals,
    entry_count: Math.max(0, Math.floor(asNumber(data.entry_count))),
    backfilled_at: asString(data.backfilled_at) || nowIso(),
    updated_at: asString(data.updated_at) || nowIso(),
  };
}

function applyEarningsAggregateChange(
  aggregate: CreatorEarningsAggregateRecord,
  previous: PayoutAggregateSlice | null,
  next: PayoutAggregateSlice | null,
): CreatorEarningsAggregateRecord {
  const statusTotals: CreatorEarningsStatusTotals = { ...aggregate.status_totals };
  const adjust = (slice: PayoutAggregateSlice, direction: 1 | -1) => {
    const bucket = statusTotals[slice.status] || {
      count: 0,
      approved_amount_cents: 0,
    };
    statusTotals[slice.status] = {
      count: Math.max(0, bucket.count + direction),
      approved_amount_cents: Math.max(
        0,
        bucket.approved_amount_cents +
          direction * Math.max(0, Math.floor(slice.approvedAmountCents)),
      ),
    };
  };
  if (previous) {
    adjust(previous, -1);
  }
  if (next) {
    adjust(next, 1);
  }
  return {
    ...aggregate,
    status_totals: statusTotals,
    entry_count: Math.max(
      0,
      aggregate.entry_count - (previous ? 1 : 0) + (next ? 1 : 0),
    ),
    updated_at: nowIso(),
  };
}

export function buildCreatorEarningsAggregateFromEntries(
  creatorId: string,
  entries: CreatorPayoutRecord[],
): CreatorEarningsAggregateRecord {
  return entries.reduce(
    (aggregate, entry) =>
      applyEarningsAggregateChange(aggregate, null, payoutAggregateSlice(entry)),
    emptyCreatorEarningsAggregate(creatorId),
  );
}

function earningsAggregateRef(
  firestore: NonNullable<typeof db>,
  creatorId: string,
) {
  return firestore
    .collection(CREATOR_EARNINGS_AGGREGATE_COLLECTION)
    .doc(creatorId);
}

function updateEarningsAggregateInTx(params: {
  tx: FirebaseFirestore.Transaction;
  ref: FirebaseFirestore.DocumentReference;
  snapshot: FirebaseFirestore.DocumentSnapshot;
  creatorId: string;
  changes: Array<{
    previous: PayoutAggregateSlice | null;
    next: PayoutAggregateSlice | null;
  }>;
}) {
  // The aggregate is only maintained once the lazy backfill materialized it;
  // until then the backfill scan will observe these writes directly.
  if (!params.snapshot.exists || params.changes.length === 0) {
    return;
  }
  let aggregate = copyCreatorEarningsAggregate(
    params.creatorId,
    params.snapshot.data() as Record<string, unknown> | undefined,
  );
  for (const change of params.changes) {
    aggregate = applyEarningsAggregateChange(
      aggregate,
      change.previous,
      change.next,
    );
  }
  params.tx.set(params.ref, aggregate);
}

export async function readCreatorEarningsAggregate(
  creatorId: string,
): Promise<CreatorEarningsAggregateRecord> {
  if (!db || !creatorId) {
    return emptyCreatorEarningsAggregate(creatorId);
  }
  const firestore = db;
  const ref = earningsAggregateRef(firestore, creatorId);

  const snapshot = await ref.get();
  if (snapshot.exists) {
    return copyCreatorEarningsAggregate(
      creatorId,
      snapshot.data() as Record<string, unknown> | undefined,
    );
  }

  // Lazy backfill: one full history scan inside a transaction; from then on
  // every payout write maintains the aggregate incrementally.
  return firestore.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      return copyCreatorEarningsAggregate(
        creatorId,
        existing.data() as Record<string, unknown> | undefined,
      );
    }
    const payoutSnapshot = await tx.get(
      firestore
        .collection(CREATOR_PAYOUT_COLLECTION)
        .where("creator_id", "==", creatorId),
    );
    const aggregate = buildCreatorEarningsAggregateFromEntries(
      creatorId,
      payoutSnapshot.docs.map((doc) =>
        copyCreatorPayout(doc.data() as Record<string, unknown>),
      ),
    );
    tx.set(ref, aggregate);
    return aggregate;
  });
}

export function summarizeCreatorEarnings(
  aggregate: CreatorEarningsAggregateRecord,
): {
  totalEarnedCents: number;
  pendingPayoutCents: number;
  scansCompleted: number;
} {
  const bucket = (status: CreatorPayoutStatus) =>
    aggregate.status_totals[status] || { count: 0, approved_amount_cents: 0 };
  const pendingStatuses: CreatorPayoutStatus[] = [
    "approved",
    "in_transit",
    "review_required",
  ];
  const completedStatuses: CreatorPayoutStatus[] = [
    "approved",
    "in_transit",
    "paid",
  ];
  return {
    totalEarnedCents: bucket("paid").approved_amount_cents,
    pendingPayoutCents: pendingStatuses.reduce(
      (sum, status) => sum + bucket(status).approved_amount_cents,
      0,
    ),
    scansCompleted: completedStatuses.reduce(
      (sum, status) => sum + bucket(status).count,
      0,
    ),
  };
}

export async function upsertCreatorPayoutFromPipeline(params: {
  captureId: string;
  sceneId: string | null;
  captureJobId: string | null;
  buyerRequestId: string | null;
  siteSubmissionId: string | null;
  qualificationState: string | null;
  opportunityState: string | null;
  recommendation: Record<string, unknown>;
  recommendationUri: string | null;
  stripeConnectAccountId: string | null;
}): Promise<CreatorPayoutRecord | null> {
  if (!db || !params.captureId) {
    return null;
  }

  const creatorId = await resolveCreatorIdForCapture(params.captureId);
  if (!creatorId) {
    return null;
  }

  const firestore = db;
  const recommendationStatus = asString(params.recommendation.status);
  const basePayoutCents = Math.max(
    0,
    Math.floor(
      asNumber(params.recommendation.recommended_payout_cents) ||
        asNumber(params.recommendation.base_payout_cents),
    ),
  );
  const isQualifiedReady = READY_QUALIFICATION_STATES.has(
    (params.qualificationState || "").trim(),
  );
  const requiresFundingCheck =
    isQualifiedReady && recommendationStatus !== "review_required" && basePayoutCents > 0;
  const funding = requiresFundingCheck
    ? verifiedPayoutFundingPolicy(params.recommendation, basePayoutCents)
    : notRequiredPayoutFunding();

  const payoutRef = firestore
    .collection(CREATOR_PAYOUT_COLLECTION)
    .doc(params.captureId);
  const aggregateRef = earningsAggregateRef(firestore, creatorId);

  // The payout entry and the creator earnings aggregate move together in one
  // transaction so the aggregate can never drift from the ledger.
  const payload = await firestore.runTransaction<CreatorPayoutRecord>(async (tx) => {
    const approvalJournal = stripeLedgerJournalTxWriter(firestore, tx, {
      entryType: "payout_approved",
      discriminator: params.captureId,
      amountCents: basePayoutCents,
      currency: "usd",
      direction: "creator_payout_out",
      creatorId,
      payoutEntryIds: [params.captureId],
      occurredAt: null,
      details: {
        capture_id: params.captureId,
        qualification_state: params.qualificationState,
      },
    });
    const [existingSnapshot, aggregateSnapshot] = await Promise.all([
      tx.get(payoutRef),
      tx.get(aggregateRef),
      approvalJournal.read(),
    ]);
    const existing = existingSnapshot.exists
      ? copyCreatorPayout(existingSnapshot.data() as Record<string, unknown>)
      : null;

    let nextStatus: CreatorPayoutStatus = "pending_qualification";
    if (!isQualifiedReady) {
      nextStatus = "pending_qualification";
    } else if (recommendationStatus === "review_required") {
      nextStatus = "review_required";
    } else if (basePayoutCents <= 0) {
      nextStatus = "ineligible";
    } else if (funding.status !== "verified") {
      nextStatus = "review_required";
    } else {
      nextStatus = "approved";
    }

    const preservesSettledStatus = Boolean(
      existing && ["in_transit", "paid"].includes(existing.status),
    );
    if (preservesSettledStatus) {
      nextStatus = existing!.status;
    }
    const payloadFunding = preservesSettledStatus
      ? {
          policy: existing!.payout_funding_policy,
          status: existing!.funding_status,
          blockers: existing!.funding_blockers,
          reconciliation: existing!.payout_funding_reconciliation,
        }
      : funding;

    const approvedAt =
      nextStatus === "approved" || nextStatus === "in_transit" || nextStatus === "paid"
        ? existing?.approved_at || nowIso()
        : existing?.approved_at || null;

    const nextPayload: CreatorPayoutRecord = {
      id: params.captureId,
      creator_id: creatorId,
      capture_id: params.captureId,
      scene_id: params.sceneId,
      capture_job_id: params.captureJobId,
      buyer_request_id: params.buyerRequestId,
      site_submission_id: params.siteSubmissionId,
      qualification_state: params.qualificationState,
      opportunity_state: params.opportunityState,
      status: nextStatus,
      recommended_status: recommendationStatus,
      base_payout_cents: Math.max(
        0,
        Math.floor(asNumber(params.recommendation.base_payout_cents)),
      ),
      approved_amount_cents: basePayoutCents,
      recommendation: params.recommendation,
      recommendation_uri: params.recommendationUri,
      payout_funding_policy: payloadFunding.policy,
      funding_status: payloadFunding.status,
      funding_blockers: payloadFunding.blockers,
      payout_funding_reconciliation: payloadFunding.reconciliation,
      stripe_connect_account_id:
        params.stripeConnectAccountId || existing?.stripe_connect_account_id || null,
      disbursement_id: existing?.disbursement_id || null,
      stripe_payout_id: existing?.stripe_payout_id || null,
      last_webhook_event_id: existing?.last_webhook_event_id || null,
      last_webhook_event_type: existing?.last_webhook_event_type || null,
      failure_reason:
        payloadFunding.blockers[0] ||
        (nextStatus === "approved" ? null : existing?.failure_reason || null),
      created_at: existing?.created_at || nowIso(),
      updated_at: nowIso(),
      approved_at: approvedAt,
      paid_at: existing?.paid_at || null,
    };

    tx.set(payoutRef, nextPayload, { merge: true });
    updateEarningsAggregateInTx({
      tx,
      ref: aggregateRef,
      snapshot: aggregateSnapshot,
      creatorId,
      changes: [
        {
          previous: existing ? payoutAggregateSlice(existing) : null,
          next: payoutAggregateSlice(nextPayload),
        },
      ],
    });
    // Journal the first transition into `approved` (SCALE2-01) atomically
    // with the payout write. The deterministic entry id makes re-upserts
    // no-ops, so re-qualification churn cannot double-journal an approval.
    if (nextStatus === "approved" && existing?.status !== "approved") {
      approvalJournal.append();
    }
    return nextPayload;
  });

  const nextStatus = payload.status;

  if (nextStatus === "approved") {
    await updateCreatorCaptureProjection({
      captureId: params.captureId,
      creatorId,
      status: "approved",
      estimatedPayoutCents: basePayoutCents,
    });
    await updateCaptureSubmissionProjection({
      captureId: params.captureId,
      creatorId,
      status: "approved",
      payoutCents: basePayoutCents,
      approvedAt: payload.approved_at,
    });
  } else if (["pending_qualification", "review_required"].includes(nextStatus)) {
    await updateCreatorCaptureProjection({
      captureId: params.captureId,
      creatorId,
      status: "under_review",
      estimatedPayoutCents: basePayoutCents,
    });
    await updateCaptureSubmissionProjection({
      captureId: params.captureId,
      creatorId,
      status: "under_review",
      payoutCents: basePayoutCents,
    });
  }

  return payload;
}

function sortCreatorPayoutsByRecency(entries: CreatorPayoutRecord[]) {
  return entries.sort((a, b) => {
    const aTime = new Date(a.paid_at || a.approved_at || a.updated_at).getTime();
    const bTime = new Date(b.paid_at || b.approved_at || b.updated_at).getTime();
    return bTime - aTime;
  });
}

export async function listCreatorPayouts(
  creatorId: string,
  options?: { limit?: number },
): Promise<CreatorPayoutRecord[]> {
  if (!db || !creatorId) {
    return [];
  }

  let query: FirebaseFirestore.Query = db
    .collection(CREATOR_PAYOUT_COLLECTION)
    .where("creator_id", "==", creatorId);
  const limit = Math.trunc(options?.limit ?? 0);
  if (limit > 0) {
    // Bounded recency window (creator_id + updated_at composite index) so the
    // read stops scaling with creator tenure. Every payout write refreshes
    // updated_at, so the newest entries always land in the window.
    query = query.orderBy("updated_at", "desc").limit(limit);
  }
  const snapshot = await query.get();

  return sortCreatorPayoutsByRecency(
    snapshot.docs.map((doc) => copyCreatorPayout(doc.data() as Record<string, unknown>)),
  );
}

const PAYABLE_PAYOUT_STATUSES: CreatorPayoutStatus[] = [
  "approved",
  "disbursement_failed",
];

async function listPayableCreatorPayouts(
  creatorId: string,
): Promise<CreatorPayoutRecord[]> {
  if (!db || !creatorId) {
    return [];
  }

  const snapshot = await db
    .collection(CREATOR_PAYOUT_COLLECTION)
    .where("creator_id", "==", creatorId)
    .where("status", "in", PAYABLE_PAYOUT_STATUSES)
    .get();

  return sortCreatorPayoutsByRecency(
    snapshot.docs.map((doc) => copyCreatorPayout(doc.data() as Record<string, unknown>)),
  );
}

export function mapCreatorPayoutStatusForLedger(
  status: CreatorPayoutStatus,
): "pending" | "in_transit" | "paid" | "failed" {
  if (status === "paid") {
    return "paid";
  }
  if (status === "in_transit") {
    return "in_transit";
  }
  if (status === "disbursement_failed" || status === "ineligible") {
    return "failed";
  }
  return "pending";
}

export async function beginCreatorPayoutDisbursement(params: {
  creatorId: string;
  stripeConnectAccountId: string;
  requestedAmountCents?: number;
}): Promise<{
  disbursement: CreatorPayoutDisbursementRecord;
  entries: CreatorPayoutRecord[];
} | null> {
  if (!db || !params.creatorId || !params.stripeConnectAccountId) {
    return null;
  }
  const firestore = db;

  const existingDisbursementSnapshot = await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .where("creator_id", "==", params.creatorId)
    .where("status", "==", "failed")
    .get();
  const retryableDisbursement = existingDisbursementSnapshot.docs
    .map((doc) => copyCreatorPayoutDisbursement(doc.data() as Record<string, unknown>))
    .filter((entry) => {
      return (
        entry.stripe_connect_account_id === params.stripeConnectAccountId &&
        entry.treasury_status === "funded" &&
        entry.status === "failed" &&
        !entry.paid_at
      );
    })
    .sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })[0];
  if (retryableDisbursement) {
    const existingEntries = await Promise.all(
      retryableDisbursement.payout_entry_ids.map(async (entryId) => {
        const snapshot = await firestore
          .collection(CREATOR_PAYOUT_COLLECTION)
          .doc(entryId)
          .get();
        return snapshot.exists
          ? copyCreatorPayout(snapshot.data() as Record<string, unknown>)
          : null;
      }),
    );
    return {
      disbursement: retryableDisbursement,
      entries: existingEntries.filter(
        (entry): entry is CreatorPayoutRecord => Boolean(entry),
      ),
    };
  }

  // Gather candidate entry ids outside the transaction (a Firestore transaction
  // cannot run the collection query itself). Every entry's status is then
  // re-read *inside* the transaction and re-checked before any write, so the
  // read-then-write double-pay race (WEB-01) cannot open a window between
  // selection and the in_transit flip. The candidate query is bounded to
  // payable statuses instead of scanning the creator's full payout history.
  const candidateEntryIds = (await listPayableCreatorPayouts(params.creatorId))
    .filter((entry) => payoutFundingEligibleForDisbursement(entry))
    .map((entry) => entry.id);
  if (candidateEntryIds.length === 0) {
    return null;
  }

  const requestedAmountCents = Math.max(
    0,
    Math.floor(params.requestedAmountCents || 0),
  );

  // Statuses that mean an entry is already claimed by another disbursement and
  // must never be swept into a new one.
  const TERMINAL_OR_IN_FLIGHT_STATUSES = new Set<CreatorPayoutStatus>([
    "in_transit",
    "paid",
  ]);
  const ELIGIBLE_STATUSES = new Set<CreatorPayoutStatus>([
    "approved",
    "disbursement_failed",
  ]);

  const disbursementRef = firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(crypto.randomUUID());

  const result = await firestore.runTransaction<{
    disbursement: CreatorPayoutDisbursementRecord;
    entries: CreatorPayoutRecord[];
  } | null>(async (tx) => {
    // Re-read each candidate atomically. Firestore serializes transactions that
    // touch the same documents, so a concurrent disbursement that already
    // flipped an entry to in_transit will be observed here and skipped.
    const refs = candidateEntryIds.map((entryId) =>
      firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(entryId),
    );
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const aggregateRef = earningsAggregateRef(firestore, params.creatorId);
    const aggregateSnapshot = await tx.get(aggregateRef);
    const initiationJournal = stripeLedgerJournalTxWriter(firestore, tx, {
      entryType: "disbursement_initiated",
      discriminator: disbursementRef.id,
      amountCents: null,
      currency: "usd",
      direction: "creator_payout_out",
      creatorId: params.creatorId,
      disbursementId: disbursementRef.id,
    });
    await initiationJournal.read();

    const selectedEntries: CreatorPayoutRecord[] = [];
    let runningTotal = 0;
    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        continue;
      }
      const entry = copyCreatorPayout(snapshot.data() as Record<string, unknown>);
      if (
        TERMINAL_OR_IN_FLIGHT_STATUSES.has(entry.status) ||
        !ELIGIBLE_STATUSES.has(entry.status)
      ) {
        continue;
      }
      if (!payoutFundingEligibleForDisbursement(entry)) {
        continue;
      }
      if (
        requestedAmountCents > 0 &&
        runningTotal + entry.approved_amount_cents > requestedAmountCents &&
        selectedEntries.length > 0
      ) {
        break;
      }
      selectedEntries.push(entry);
      runningTotal += entry.approved_amount_cents;
      if (requestedAmountCents > 0 && runningTotal >= requestedAmountCents) {
        break;
      }
    }

    if (selectedEntries.length === 0 || runningTotal <= 0) {
      return null;
    }

    const createdAt = nowIso();
    const disbursement: CreatorPayoutDisbursementRecord = {
      id: disbursementRef.id,
      creator_id: params.creatorId,
      stripe_connect_account_id: params.stripeConnectAccountId,
      payout_entry_ids: selectedEntries.map((entry) => entry.id),
      requested_amount_cents: requestedAmountCents || runningTotal,
      disbursed_amount_cents: runningTotal,
      status: "initiated",
      stripe_payout_id: null,
      stripe_transfer_id: null,
      treasury_status: "awaiting_platform_funds",
      funded_at: null,
      treasury_failure_reason: null,
      platform_available_balance_cents: null,
      funding_reconciliation_report: buildPayoutDisbursementFundingReport(
        selectedEntries,
        runningTotal,
      ),
      created_at: createdAt,
      updated_at: createdAt,
      paid_at: null,
      failed_at: null,
      canceled_at: null,
      failure_reason: null,
      last_webhook_event_id: null,
      last_webhook_event_type: null,
    };

    tx.set(disbursementRef, disbursement, { merge: true });
    initiationJournal.append({
      amountCents: runningTotal,
      payoutEntryIds: selectedEntries.map((entry) => entry.id),
      occurredAt: createdAt,
      details: {
        stripe_connect_account_id: params.stripeConnectAccountId,
        requested_amount_cents: requestedAmountCents || runningTotal,
      },
    });

    for (const entry of selectedEntries) {
      tx.set(
        firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(entry.id),
        {
          status: "in_transit",
          disbursement_id: disbursement.id,
          stripe_connect_account_id: params.stripeConnectAccountId,
          updated_at: createdAt,
          failure_reason: null,
        },
        { merge: true },
      );
    }

    updateEarningsAggregateInTx({
      tx,
      ref: aggregateRef,
      snapshot: aggregateSnapshot,
      creatorId: params.creatorId,
      changes: selectedEntries.map((entry) => ({
        previous: payoutAggregateSlice(entry),
        next: {
          status: "in_transit" as CreatorPayoutStatus,
          approvedAmountCents: entry.approved_amount_cents,
        },
      })),
    });

    return { disbursement, entries: selectedEntries };
  });

  return result;
}

export async function finalizeCreatorPayoutDisbursement(params: {
  disbursementId: string;
  stripePayoutId: string;
}) {
  if (!db) {
    return;
  }
  const firestore = db;

  const updatedAt = nowIso();
  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(params.disbursementId)
    .set(
      {
        status: "in_transit",
        stripe_payout_id: params.stripePayoutId,
        updated_at: updatedAt,
      },
      { merge: true },
    );
  await firestore
    .collection(STRIPE_PAYOUT_LINK_COLLECTION)
    .doc(params.stripePayoutId)
    .set(
      {
        disbursement_id: params.disbursementId,
        updated_at: updatedAt,
      },
      { merge: true },
    );
}

export async function markCreatorPayoutDisbursementFunded(params: {
  disbursementId: string;
  stripeTransferId: string;
  platformAvailableBalanceCents: number;
}) {
  if (!db) {
    return;
  }
  const firestore = db;
  const updatedAt = nowIso();

  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(params.disbursementId)
    .set(
      {
        stripe_transfer_id: params.stripeTransferId,
        treasury_status: "funded",
        funded_at: updatedAt,
        treasury_failure_reason: null,
        platform_available_balance_cents: params.platformAvailableBalanceCents,
        updated_at: updatedAt,
      },
      { merge: true },
    );
}

export async function markCreatorPayoutDisbursementFundingFailure(params: {
  disbursementId: string;
  status: "insufficient_platform_balance" | "transfer_failed";
  reason: string;
  platformAvailableBalanceCents?: number | null;
}) {
  if (!db) {
    return;
  }
  const firestore = db;
  const updatedAt = nowIso();

  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(params.disbursementId)
    .set(
      {
        status: "failed",
        treasury_status: params.status,
        treasury_failure_reason: params.reason,
        platform_available_balance_cents:
          params.platformAvailableBalanceCents ?? null,
        failed_at: updatedAt,
        updated_at: updatedAt,
      },
      { merge: true },
    );
}

export async function failCreatorPayoutDisbursement(params: {
  disbursementId: string;
  reason: string;
}) {
  if (!db) {
    return;
  }
  const firestore = db;

  const snapshot = await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(params.disbursementId)
    .get();
  if (!snapshot.exists) {
    return;
  }
  const disbursement = copyCreatorPayoutDisbursement(
    snapshot.data() as Record<string, unknown>,
  );
  const failedAt = nowIso();

  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(params.disbursementId)
    .set(
      {
        status: "failed",
        failure_reason: params.reason,
        failed_at: failedAt,
        updated_at: failedAt,
      },
      { merge: true },
    );

  await firestore.runTransaction(async (tx) => {
    const entryRefs = disbursement.payout_entry_ids.map((entryId) =>
      firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(entryId),
    );
    const entrySnapshots = await Promise.all(entryRefs.map((ref) => tx.get(ref)));
    const aggregateRef = earningsAggregateRef(firestore, disbursement.creator_id);
    const aggregateSnapshot = await tx.get(aggregateRef);

    const changes: Array<{
      previous: PayoutAggregateSlice | null;
      next: PayoutAggregateSlice | null;
    }> = [];
    entrySnapshots.forEach((snapshot, index) => {
      tx.set(
        entryRefs[index],
        {
          status: "disbursement_failed",
          updated_at: failedAt,
          failure_reason: params.reason,
        },
        { merge: true },
      );
      if (snapshot.exists) {
        const entry = copyCreatorPayout(snapshot.data() as Record<string, unknown>);
        changes.push({
          previous: payoutAggregateSlice(entry),
          next: {
            status: "disbursement_failed",
            approvedAmountCents: entry.approved_amount_cents,
          },
        });
      }
    });

    updateEarningsAggregateInTx({
      tx,
      ref: aggregateRef,
      snapshot: aggregateSnapshot,
      creatorId: disbursement.creator_id,
      changes,
    });
  });
}

export async function findCreatorPayoutDisbursementByStripePayoutId(
  stripePayoutId: string,
): Promise<CreatorPayoutDisbursementRecord | null> {
  if (!db || !stripePayoutId) {
    return null;
  }
  const firestore = db;

  const link = await firestore
    .collection(STRIPE_PAYOUT_LINK_COLLECTION)
    .doc(stripePayoutId)
    .get();
  const disbursementId = asString(link.data()?.disbursement_id);
  if (!disbursementId) {
    return null;
  }

  const snapshot = await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(disbursementId)
    .get();
  if (!snapshot.exists) {
    return null;
  }

  return copyCreatorPayoutDisbursement(snapshot.data() as Record<string, unknown>);
}

export async function applyCreatorPayoutWebhook(params: {
  stripePayoutId: string;
  eventId: string;
  eventType: string;
  status: "paid" | "failed" | "canceled";
  failureReason?: string | null;
}) {
  if (!db) {
    return null;
  }
  const firestore = db;

  const disbursement = await findCreatorPayoutDisbursementByStripePayoutId(
    params.stripePayoutId,
  );
  if (!disbursement) {
    return null;
  }

  const updatedAt = nowIso();
  const nextDisbursementStatus: CreatorPayoutDisbursementStatus =
    params.status === "paid"
      ? "paid"
      : params.status === "canceled"
        ? "canceled"
        : "failed";

  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(disbursement.id)
    .set(
      {
        status: nextDisbursementStatus,
        paid_at: params.status === "paid" ? updatedAt : null,
        failed_at: params.status === "failed" ? updatedAt : null,
        canceled_at: params.status === "canceled" ? updatedAt : null,
        failure_reason: params.failureReason || null,
        last_webhook_event_id: params.eventId,
        last_webhook_event_type: params.eventType,
        updated_at: updatedAt,
      },
      { merge: true },
    );

  const settledPayouts = await firestore.runTransaction<CreatorPayoutRecord[]>(
    async (tx) => {
      const entryRefs = disbursement.payout_entry_ids.map((entryId) =>
        firestore.collection(CREATOR_PAYOUT_COLLECTION).doc(entryId),
      );
      const entrySnapshots = await Promise.all(entryRefs.map((ref) => tx.get(ref)));
      const aggregateRef = earningsAggregateRef(firestore, disbursement.creator_id);
      const aggregateSnapshot = await tx.get(aggregateRef);
      const settlementJournal = stripeLedgerJournalTxWriter(firestore, tx, {
        entryType: params.status === "paid" ? "disbursement_settled" : "disbursement_failed",
        discriminator: params.eventId,
        amountCents: disbursement.disbursed_amount_cents,
        currency: "usd",
        direction: "creator_payout_out",
        creatorId: disbursement.creator_id,
        disbursementId: disbursement.id,
        payoutEntryIds: disbursement.payout_entry_ids,
        stripeEventId: params.eventId,
        stripeEventType: params.eventType,
        occurredAt: updatedAt,
        details: {
          stripe_payout_id: params.stripePayoutId,
          settlement_status: params.status,
          failure_reason: params.failureReason || null,
        },
      });
      await settlementJournal.read();

      const updated: CreatorPayoutRecord[] = [];
      const changes: Array<{
        previous: PayoutAggregateSlice | null;
        next: PayoutAggregateSlice | null;
      }> = [];
      entrySnapshots.forEach((payoutSnapshot, index) => {
        if (!payoutSnapshot.exists) {
          return;
        }
        const payout = copyCreatorPayout(
          payoutSnapshot.data() as Record<string, unknown>,
        );
        const nextStatus: CreatorPayoutStatus =
          params.status === "paid" ? "paid" : "disbursement_failed";

        tx.set(
          entryRefs[index],
          {
            status: nextStatus,
            paid_at: params.status === "paid" ? updatedAt : null,
            last_webhook_event_id: params.eventId,
            last_webhook_event_type: params.eventType,
            stripe_payout_id: params.stripePayoutId,
            updated_at: updatedAt,
            failure_reason: params.status === "paid" ? null : params.failureReason || null,
          },
          { merge: true },
        );
        changes.push({
          previous: payoutAggregateSlice(payout),
          next: {
            status: nextStatus,
            approvedAmountCents: payout.approved_amount_cents,
          },
        });
        updated.push(payout);
      });

      updateEarningsAggregateInTx({
        tx,
        ref: aggregateRef,
        snapshot: aggregateSnapshot,
        creatorId: disbursement.creator_id,
        changes,
      });
      settlementJournal.append();

      return updated;
    },
  );

  if (params.status === "paid") {
    for (const payout of settledPayouts) {
      await updateCreatorCaptureProjection({
        captureId: payout.capture_id,
        creatorId: payout.creator_id,
        status: "paid",
        estimatedPayoutCents: payout.approved_amount_cents,
      });
      await updateCaptureSubmissionProjection({
        captureId: payout.capture_id,
        creatorId: payout.creator_id,
        status: "paid",
        payoutCents: payout.approved_amount_cents,
        approvedAt: payout.approved_at,
        paidAt: updatedAt,
      });
    }
  }

  return disbursement.id;
}
