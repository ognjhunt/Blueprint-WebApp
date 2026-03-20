import crypto from "crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const BUYER_ORDER_COLLECTION = "buyerOrders";
const BUYER_ENTITLEMENT_COLLECTION = "marketplaceEntitlements";
const CREATOR_PAYOUT_COLLECTION = "creatorPayouts";
const CREATOR_PAYOUT_DISBURSEMENT_COLLECTION = "creatorPayoutDisbursements";
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
  | "refunded";

export type BuyerOrderPaymentStatus =
  | "checkout_created"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

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
  | "ineligible"
  | "in_transit"
  | "paid"
  | "disbursement_failed";

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
  access_state: "provisioned" | "manual_review_required" | "revoked";
  granted_at: string;
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
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  failed_at: string | null;
  canceled_at: string | null;
  failure_reason: string | null;
  last_webhook_event_id: string | null;
  last_webhook_event_type: string | null;
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
  await db
    .collection(BUYER_ORDER_COLLECTION)
    .doc(order.id)
    .set(
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
      },
      { merge: true },
    );
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

  const existingSnapshot = await db
    .collection(CREATOR_PAYOUT_COLLECTION)
    .doc(params.captureId)
    .get();
  const existing = existingSnapshot.exists
    ? copyCreatorPayout(existingSnapshot.data() as Record<string, unknown>)
    : null;

  const recommendationStatus = asString(params.recommendation.status);
  const basePayoutCents = Math.max(
    0,
    Math.floor(
      asNumber(params.recommendation.recommended_payout_cents) ||
        asNumber(params.recommendation.base_payout_cents),
    ),
  );

  let nextStatus: CreatorPayoutStatus = "pending_qualification";
  if (!READY_QUALIFICATION_STATES.has((params.qualificationState || "").trim())) {
    nextStatus = "pending_qualification";
  } else if (recommendationStatus === "review_required") {
    nextStatus = "review_required";
  } else if (basePayoutCents <= 0) {
    nextStatus = "ineligible";
  } else {
    nextStatus = "approved";
  }

  if (existing && ["in_transit", "paid"].includes(existing.status)) {
    nextStatus = existing.status;
  }

  const approvedAt =
    nextStatus === "approved" || nextStatus === "in_transit" || nextStatus === "paid"
      ? existing?.approved_at || nowIso()
      : existing?.approved_at || null;

  const payload: CreatorPayoutRecord = {
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
    stripe_connect_account_id:
      params.stripeConnectAccountId || existing?.stripe_connect_account_id || null,
    disbursement_id: existing?.disbursement_id || null,
    stripe_payout_id: existing?.stripe_payout_id || null,
    last_webhook_event_id: existing?.last_webhook_event_id || null,
    last_webhook_event_type: existing?.last_webhook_event_type || null,
    failure_reason: existing?.failure_reason || null,
    created_at: existing?.created_at || nowIso(),
    updated_at: nowIso(),
    approved_at: approvedAt,
    paid_at: existing?.paid_at || null,
  };

  await db
    .collection(CREATOR_PAYOUT_COLLECTION)
    .doc(params.captureId)
    .set(payload, { merge: true });

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
      approvedAt,
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

export async function listCreatorPayouts(
  creatorId: string,
): Promise<CreatorPayoutRecord[]> {
  if (!db || !creatorId) {
    return [];
  }

  const snapshot = await db
    .collection(CREATOR_PAYOUT_COLLECTION)
    .where("creator_id", "==", creatorId)
    .get();

  return snapshot.docs
    .map((doc) => copyCreatorPayout(doc.data() as Record<string, unknown>))
    .sort((a, b) => {
      const aTime = new Date(a.paid_at || a.approved_at || a.updated_at).getTime();
      const bTime = new Date(b.paid_at || b.approved_at || b.updated_at).getTime();
      return bTime - aTime;
    });
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

  const entries = (await listCreatorPayouts(params.creatorId)).filter((entry) =>
    ["approved", "disbursement_failed"].includes(entry.status),
  );
  if (entries.length === 0) {
    return null;
  }

  const requestedAmountCents = Math.max(
    0,
    Math.floor(params.requestedAmountCents || 0),
  );

  const selectedEntries: CreatorPayoutRecord[] = [];
  let runningTotal = 0;
  for (const entry of entries) {
    if (entry.approved_amount_cents <= 0) {
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
    id: crypto.randomUUID(),
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
    created_at: createdAt,
    updated_at: createdAt,
    paid_at: null,
    failed_at: null,
    canceled_at: null,
    failure_reason: null,
    last_webhook_event_id: null,
    last_webhook_event_type: null,
  };

  await firestore
    .collection(CREATOR_PAYOUT_DISBURSEMENT_COLLECTION)
    .doc(disbursement.id)
    .set(disbursement, { merge: true });

  await Promise.all(
    selectedEntries.map((entry) =>
      firestore
        .collection(CREATOR_PAYOUT_COLLECTION)
        .doc(entry.id)
        .set(
          {
            status: "in_transit",
            disbursement_id: disbursement.id,
            stripe_connect_account_id: params.stripeConnectAccountId,
            updated_at: createdAt,
            failure_reason: null,
          },
          { merge: true },
        ),
    ),
  );

  return { disbursement, entries: selectedEntries };
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

  await Promise.all(
    disbursement.payout_entry_ids.map((entryId) =>
      firestore
        .collection(CREATOR_PAYOUT_COLLECTION)
        .doc(entryId)
        .set(
          {
            status: "disbursement_failed",
            updated_at: failedAt,
            failure_reason: params.reason,
          },
          { merge: true },
        ),
    ),
  );
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

  await Promise.all(
    disbursement.payout_entry_ids.map(async (entryId) => {
      const payoutSnapshot = await firestore
        .collection(CREATOR_PAYOUT_COLLECTION)
        .doc(entryId)
        .get();
      if (!payoutSnapshot.exists) {
        return;
      }
      const payout = copyCreatorPayout(
        payoutSnapshot.data() as Record<string, unknown>,
      );
      const nextStatus: CreatorPayoutStatus =
        params.status === "paid" ? "paid" : "disbursement_failed";

      await firestore
        .collection(CREATOR_PAYOUT_COLLECTION)
        .doc(entryId)
        .set(
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

      if (params.status === "paid") {
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
    }),
  );

  return disbursement.id;
}
