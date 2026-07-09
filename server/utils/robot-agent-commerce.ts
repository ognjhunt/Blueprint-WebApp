import crypto from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { SiteWorldCard } from "../../client/src/data/siteWorlds";
import {
  effectiveEntitlementAccessState,
  entitlementTermForOrderItem,
} from "./entitlementExpiry";

export type AgentCommerceProduct = "site_world_package" | "hosted_session_rental";
export type AgentCommerceMode = "dry_run";

export type AgentCommerceBuyer = {
  uid?: string | null;
  email?: string | null;
};

export type AgentCommerceQuoteInput = {
  siteWorldId: string;
  product?: string | null;
  sessionHours?: number | string | null;
};

export type AgentDryRunCheckoutInput = AgentCommerceQuoteInput & {
  mode?: string | null;
  buyer?: AgentCommerceBuyer | null;
};

export type AgentCommerceQuote = {
  quoteId: string;
  mode: AgentCommerceMode;
  product: AgentCommerceProduct;
  siteWorldId: string;
  sku: string;
  title: string;
  description: string;
  quantity: number;
  quantityLabel: string;
  unitAmountCents: number;
  totalAmountCents: number;
  currency: "usd";
  entitlementType: "package_access" | "hosted_session";
  truthLabels: string[];
};

export type AgentDryRunOrderRecord = {
  id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  source: "agent_dry_run_checkout";
  dry_run: true;
  status: "fulfilled";
  payment_status: "dry_run_paid";
  fulfillment_status: "provisioned";
  currency: "usd";
  item: {
    sku: string;
    title: string;
    description: string;
    item_type: AgentCommerceProduct;
    quantity: number;
    license_tier: "agent_dry_run";
    exclusivity: "non-exclusive";
    addons: string[];
    inventory_source: "agent_dry_run";
    live_inventory_record_id: null;
    delivery_mode: "download_link" | "hosted_session";
    fulfillment_status: "provisioned";
    rights_status: "request_scoped";
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
    checkout_session_id: null;
    checkout_session_url: null;
    payment_intent_id: null;
    customer_id: null;
    charge_id: null;
    livemode: false;
  };
  entitlement_id: string;
  created_at: string;
  updated_at: string;
  paid_at: string;
  fulfilled_at: string;
};

export type AgentDryRunMarketplaceEntitlement = {
  id: string;
  order_id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  sku: string;
  title: string;
  item_type: AgentCommerceProduct;
  license_tier: "agent_dry_run";
  exclusivity: "non-exclusive";
  addons: string[];
  delivery_mode: "download_link" | "hosted_session";
  access_state: "provisioned";
  granted_at: string;
  expires_at: string | null;
  license_term_hours: number | null;
  license_term_unit: "hour" | null;
  updated_at: string;
  dry_run: true;
  site_world_id: string;
  product: AgentCommerceProduct;
};

export type AgentEntitlementProof = {
  id: string;
  order_id?: string | null;
  buyer_user_id?: string | null;
  buyer_email?: string | null;
  sku: string;
  title?: string | null;
  item_type?: string | null;
  delivery_mode?: string | null;
  access_state: string;
  dry_run?: boolean;
  source: "agent_dry_run" | "firestore";
};

const dryRunOrders = new Map<string, AgentDryRunOrderRecord>();
const dryRunEntitlements = new Map<string, AgentDryRunMarketplaceEntitlement>();

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeSku(value: unknown) {
  return normalizeId(value).toLowerCase();
}

export function normalizeAgentCommerceProduct(value?: string | null): AgentCommerceProduct {
  const normalized = normalizeId(value).replace(/-/g, "_");
  if (normalized === "site_world_package" || normalized === "package" || normalized === "site_package") {
    return "site_world_package";
  }
  return "hosted_session_rental";
}

export function buildAgentCommerceSku(siteWorldId: string, product: AgentCommerceProduct) {
  const id = normalizeId(siteWorldId) || "unknown-site-world";
  return product === "site_world_package"
    ? `site-world-package-${id}`
    : `hosted-session-${id}`;
}

export function buildHostedSessionEntitlementSkuCandidates(values: Array<string | null | undefined>) {
  const candidates = new Set<string>();
  values
    .map((value) => normalizeId(value))
    .filter(Boolean)
    .forEach((value) => {
      candidates.add(buildAgentCommerceSku(value, "hosted_session_rental"));
      candidates.add(buildAgentCommerceSku(value, "site_world_package"));
    });
  return Array.from(candidates).map(normalizeSku);
}

function parseDollarAmountCents(value: unknown): number | null {
  const text = normalizeId(value);
  const match = text.match(/\$([\d,]+(?:\.\d{1,2})?)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function quoteDefaults(product: AgentCommerceProduct) {
  return product === "site_world_package"
    ? {
        unitAmountCents: 240000,
        quantity: 1,
        quantityLabel: "1 site-world package",
        title: "Site-world package access",
        description: "Dry-run quote for capture-backed package access after request review.",
      }
    : {
        unitAmountCents: 1800,
        quantity: 1,
        quantityLabel: "1 hosted-session hour",
        title: "Hosted-session rental",
        description: "Dry-run quote for hosted-session rental after entitlement proof.",
      };
}

export function buildAgentCommerceQuote(input: AgentCommerceQuoteInput, siteWorld?: SiteWorldCard | null): AgentCommerceQuote {
  const siteWorldId = normalizeId(input.siteWorldId);
  if (!siteWorldId) {
    throw new Error("siteWorldId is required");
  }
  const product = normalizeAgentCommerceProduct(input.product);
  const defaults = quoteDefaults(product);
  const packageMatch = siteWorld?.packages?.find((item) =>
    product === "site_world_package"
      ? /site package/i.test(item.name)
      : /hosted/i.test(item.name),
  );
  const parsedAmount = parseDollarAmountCents(packageMatch?.priceLabel);
  const rawHours = Number(input.sessionHours || 1);
  const quantity =
    product === "hosted_session_rental"
      ? Math.max(1, Math.ceil(Number.isFinite(rawHours) ? rawHours : 1))
      : 1;
  const unitAmountCents = parsedAmount ?? defaults.unitAmountCents;
  const title = siteWorld
    ? `${siteWorld.siteName} ${product === "site_world_package" ? "site package" : "hosted session"}`
    : defaults.title;
  const description = packageMatch?.summary || defaults.description;
  const sku = buildAgentCommerceSku(siteWorldId, product);

  return {
    quoteId: `dry-quote-${crypto.createHash("sha1").update(`${sku}:${quantity}`).digest("hex").slice(0, 12)}`,
    mode: "dry_run",
    product,
    siteWorldId,
    sku,
    title,
    description,
    quantity,
    quantityLabel:
      product === "hosted_session_rental"
        ? `${quantity} hosted-session hour${quantity === 1 ? "" : "s"}`
        : defaults.quantityLabel,
    unitAmountCents,
    totalAmountCents: unitAmountCents * quantity,
    currency: "usd",
    entitlementType: product === "hosted_session_rental" ? "hosted_session" : "package_access",
    truthLabels: ["dry_run_order", "request_gated", "protected_robot_team"],
  };
}

export function createAgentDryRunCheckout(input: AgentDryRunCheckoutInput, siteWorld?: SiteWorldCard | null) {
  if (normalizeId(input.mode || "dry_run") !== "dry_run") {
    throw new Error("Only mode=dry_run is supported by the agent checkout route.");
  }
  const quote = buildAgentCommerceQuote(input, siteWorld);
  const now = new Date().toISOString();
  const orderId = `dry-order-${crypto.randomUUID()}`;
  const entitlementId = `dry-entitlement-${crypto.randomUUID()}`;
  const buyer = input.buyer || {};
  const deliveryMode = quote.product === "hosted_session_rental" ? "hosted_session" : "download_link";
  const entitlementTerm = entitlementTermForOrderItem({
    itemType: quote.product,
    deliveryMode,
    quantity: quote.quantity,
    grantedAtIso: now,
  });
  const order: AgentDryRunOrderRecord = {
    id: orderId,
    buyer_user_id: normalizeId(buyer.uid) || "agent-dry-run-buyer",
    buyer_email: normalizeId(buyer.email) || null,
    source: "agent_dry_run_checkout",
    dry_run: true,
    status: "fulfilled",
    payment_status: "dry_run_paid",
    fulfillment_status: "provisioned",
    currency: "usd",
    item: {
      sku: quote.sku,
      title: quote.title,
      description: quote.description,
      item_type: quote.product,
      quantity: quote.quantity,
      license_tier: "agent_dry_run",
      exclusivity: "non-exclusive",
      addons: [],
      inventory_source: "agent_dry_run",
      live_inventory_record_id: null,
      delivery_mode: deliveryMode,
      fulfillment_status: "provisioned",
      rights_status: "request_scoped",
    },
    pricing: {
      unit_amount_cents: quote.unitAmountCents,
      total_amount_cents: quote.totalAmountCents,
    },
    checkout: {
      success_url: `/agents?dry_run_order=${encodeURIComponent(orderId)}`,
      cancel_url: "/agents?dry_run_checkout=cancel",
    },
    stripe: {
      checkout_session_id: null,
      checkout_session_url: null,
      payment_intent_id: null,
      customer_id: null,
      charge_id: null,
      livemode: false,
    },
    entitlement_id: entitlementId,
    created_at: now,
    updated_at: now,
    paid_at: now,
    fulfilled_at: now,
  };
  const entitlement: AgentDryRunMarketplaceEntitlement = {
    id: entitlementId,
    order_id: orderId,
    buyer_user_id: order.buyer_user_id,
    buyer_email: order.buyer_email,
    sku: quote.sku,
    title: quote.title,
    item_type: quote.product,
    license_tier: "agent_dry_run",
    exclusivity: "non-exclusive",
    addons: [],
    delivery_mode: deliveryMode,
    access_state: "provisioned",
    granted_at: now,
    expires_at: entitlementTerm.expires_at,
    license_term_hours: entitlementTerm.license_term_hours,
    license_term_unit: entitlementTerm.license_term_unit,
    updated_at: now,
    dry_run: true,
    site_world_id: quote.siteWorldId,
    product: quote.product,
  };
  dryRunOrders.set(order.id, order);
  dryRunEntitlements.set(entitlement.id, entitlement);

  return {
    quote,
    order,
    receipt: {
      id: `dry-receipt-${order.id}`,
      mode: "dry_run" as const,
      liveStripeTouched: false,
      paymentStatus: "dry_run_paid",
      orderId: order.id,
      entitlementId: entitlement.id,
      truthLabels: ["dry_run_order", "request_gated"],
    },
    entitlement,
  };
}

export function getAgentDryRunOrder(orderId: string) {
  const order = dryRunOrders.get(normalizeId(orderId));
  if (!order) {
    return null;
  }
  return {
    order,
    entitlement: dryRunEntitlements.get(order.entitlement_id) || null,
  };
}

export function getAgentDryRunEntitlement(entitlementId: string) {
  return dryRunEntitlements.get(normalizeId(entitlementId)) || null;
}

export function resetAgentDryRunCommerceForTests() {
  dryRunOrders.clear();
  dryRunEntitlements.clear();
}

function entitlementProofFromDryRun(entitlement: AgentDryRunMarketplaceEntitlement): AgentEntitlementProof {
  return {
    ...entitlement,
    source: "agent_dry_run",
  };
}

function entitlementProofFromFirestore(id: string, data: Record<string, unknown>): AgentEntitlementProof {
  return {
    id,
    order_id: normalizeId(data.order_id) || null,
    buyer_user_id: normalizeId(data.buyer_user_id) || null,
    buyer_email: normalizeId(data.buyer_email) || null,
    sku: normalizeId(data.sku),
    title: normalizeId(data.title) || null,
    item_type: normalizeId(data.item_type) || null,
    delivery_mode: normalizeId(data.delivery_mode) || null,
    access_state: normalizeId(data.access_state),
    source: "firestore",
  };
}

export async function findProvisionedHostedSessionEntitlement(params: {
  buyerUserId: string;
  siteWorldIds: Array<string | null | undefined>;
  entitlementId?: string | null;
}): Promise<AgentEntitlementProof | null> {
  const buyerUserId = normalizeId(params.buyerUserId);
  if (!buyerUserId) {
    return null;
  }
  const requestedEntitlementId = normalizeId(params.entitlementId);
  const skuCandidates = new Set(buildHostedSessionEntitlementSkuCandidates(params.siteWorldIds));

  for (const entitlement of dryRunEntitlements.values()) {
    if (requestedEntitlementId && entitlement.id !== requestedEntitlementId) {
      continue;
    }
    if (normalizeId(entitlement.buyer_user_id) !== buyerUserId) {
      continue;
    }
    if (effectiveEntitlementAccessState(entitlement) !== "provisioned") {
      continue;
    }
    if (!skuCandidates.has(normalizeSku(entitlement.sku))) {
      continue;
    }
    return entitlementProofFromDryRun(entitlement);
  }

  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection("marketplaceEntitlements")
    .where("buyer_user_id", "==", buyerUserId)
    .get();

  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const entitlementId = normalizeId(data.id) || doc.id;
    if (requestedEntitlementId && entitlementId !== requestedEntitlementId) {
      continue;
    }
    if (effectiveEntitlementAccessState(data) !== "provisioned") {
      continue;
    }
    if (!skuCandidates.has(normalizeSku(data.sku))) {
      continue;
    }
    return entitlementProofFromFirestore(entitlementId, { ...data, id: entitlementId });
  }

  return null;
}
