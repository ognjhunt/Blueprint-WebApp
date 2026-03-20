import type { Request } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  getStripeConnectAccountId,
  stripeClient,
} from "../constants/stripe";
import { creatorIdFromRequest } from "./creatorIdentity";

const CREATOR_PROFILE_COLLECTION = "creatorProfiles";

type StripeAccountResolution = {
  accountId: string | null;
  creatorId: string | null;
  source: "creator" | "platform" | "missing";
};

function trimString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export async function getCreatorStripeAccountId(
  creatorId: string,
): Promise<string | null> {
  if (!creatorId || !db) {
    return null;
  }

  const profile = await db
    .collection(CREATOR_PROFILE_COLLECTION)
    .doc(creatorId)
    .get();
  const data = (profile.data() || {}) as Record<string, unknown>;

  return (
    trimString(data.stripe_connect_account_id) ||
    trimString(data.stripe_account_id)
  );
}

export async function ensureCreatorStripeAccountId(
  creatorId: string,
): Promise<string | null> {
  if (!creatorId || !db || !stripeClient) {
    return null;
  }

  const existingAccountId = await getCreatorStripeAccountId(creatorId);
  if (existingAccountId) {
    return existingAccountId;
  }

  const profileRef = db.collection(CREATOR_PROFILE_COLLECTION).doc(creatorId);
  const profile = await profileRef.get();
  const data = (profile.data() || {}) as Record<string, unknown>;

  const account = await stripeClient.accounts.create({
    type: "express",
    country: "US",
    email: trimString(data.email) || undefined,
    metadata: {
      creator_id: creatorId,
    },
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  });

  await profileRef.set(
    {
      stripe_connect_account_id: account.id,
      stripe_connect_account_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );

  return account.id;
}

export async function resolveStripeAccountForRequest(
  req: Request,
  { createIfMissing = false }: { createIfMissing?: boolean } = {},
): Promise<StripeAccountResolution> {
  const creatorId = creatorIdFromRequest(req);
  if (creatorId) {
    const accountId = createIfMissing
      ? await ensureCreatorStripeAccountId(creatorId)
      : await getCreatorStripeAccountId(creatorId);

    return {
      accountId,
      creatorId,
      source: accountId ? "creator" : "missing",
    };
  }

  const platformAccountId = getStripeConnectAccountId();
  return {
    accountId: platformAccountId,
    creatorId: null,
    source: platformAccountId ? "platform" : "missing",
  };
}
