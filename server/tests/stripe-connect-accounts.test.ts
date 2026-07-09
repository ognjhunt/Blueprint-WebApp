// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, StoredDoc>(),
  accountCreate: vi.fn().mockResolvedValue({ id: "acct_creator_123" }),
}));

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function readDoc(collection: string, id: string): StoredDoc | undefined {
  return state.docs.get(docKey(collection, id));
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: Boolean(readDoc(collectionName, id)),
          data: () => readDoc(collectionName, id),
        }),
        set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
          const existing = readDoc(collectionName, id) || {};
          state.docs.set(
            docKey(collectionName, id),
            options?.merge ? { ...existing, ...payload } : payload,
          );
        },
      }),
    }),
  },
}));

vi.mock("../constants/stripe", () => ({
  getStripeConnectAccountId: () => null,
  stripeClient: {
    accounts: {
      create: state.accountCreate,
    },
  },
}));

afterEach(() => {
  state.docs.clear();
  state.accountCreate.mockClear();
  state.accountCreate.mockResolvedValue({ id: "acct_creator_123" });
  vi.resetModules();
});

describe("creator Stripe Connect accounts", () => {
  it("requests transfer and Stripe 1099 tax-reporting capabilities during creator onboarding", async () => {
    state.docs.set(docKey("creatorProfiles", "creator-123"), {
      email: "creator@example.com",
    });

    const { ensureCreatorStripeAccountId } = await import(
      "../utils/stripeConnectAccounts"
    );
    await expect(ensureCreatorStripeAccountId("creator-123")).resolves.toBe(
      "acct_creator_123",
    );

    expect(state.accountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
        country: "US",
        email: "creator@example.com",
        capabilities: {
          transfers: { requested: true },
          tax_reporting_us_1099_misc: { requested: true },
        },
        metadata: expect.objectContaining({
          creator_id: "creator-123",
          tax_reporting_owner: "stripe_1099_product",
          tax_reporting_form_type: "1099-NEC",
        }),
      }),
    );
    expect(readDoc("creatorProfiles", "creator-123")).toMatchObject({
      stripe_connect_account_id: "acct_creator_123",
    });
  });
});
