// @vitest-environment node
import crypto from "crypto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  decryptFieldValue,
  encryptFieldValue,
  encryptInboundRequestForStorage,
  isEncryptedField,
} from "../utils/field-encryption";
import type { InboundRequest } from "../types/inbound-request";

describe("field encryption", () => {
  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_MASTER_KEY = crypto
      .randomBytes(32)
      .toString("base64");
    delete process.env.FIELD_ENCRYPTION_KMS_KEY_NAME;
  });

  it("encrypts and decrypts individual fields", async () => {
    const encrypted = await encryptFieldValue("sensitive@example.com");
    expect(isEncryptedField(encrypted)).toBe(true);
    expect(encrypted.ciphertext).not.toContain("sensitive@example.com");

    const decrypted = await decryptFieldValue(encrypted);
    expect(decrypted).toBe("sensitive@example.com");
  });

  it("stores inbound request contact fields as ciphertext", async () => {
    const inboundRequest: InboundRequest = {
      requestId: "req-123",
      createdAt: null as unknown as FirebaseFirestore.Timestamp,
      status: "new",
      priority: "low",
      owner: { uid: null, email: null },
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        roleTitle: "Engineer",
        company: "Analytical Engine Co",
      },
      request: {
        budgetBucket: "$50K-$300K",
        helpWith: ["custom-capture"],
        details: "Need detailed capture specs.",
      },
      context: {
        sourcePageUrl: "https://example.com",
        referrer: null,
        utm: {},
        userAgent: "vitest",
        timezoneOffset: 0,
        locale: "en-US",
        ipHash: "hash",
      },
      enrichment: {
        companyDomain: "example.com",
        companySize: null,
        geo: null,
        notes: null,
      },
      events: {
        confirmationEmailSentAt: null,
        slackNotifiedAt: null,
        crmSyncedAt: null,
      },
      debug: {
        schemaVersion: 1,
      },
    };

    const encrypted = await encryptInboundRequestForStorage(inboundRequest);

    expect(isEncryptedField(encrypted.contact.email)).toBe(true);
    expect(isEncryptedField(encrypted.contact.firstName)).toBe(true);
    expect(isEncryptedField(encrypted.contact.lastName)).toBe(true);
    expect(isEncryptedField(encrypted.contact.company)).toBe(true);
    expect(isEncryptedField(encrypted.request.details ?? "")).toBe(true);
  });
});
