// @vitest-environment node
import crypto from "crypto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  decryptInboundRequestForAdmin,
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
      site_submission_id: "req-123",
      createdAt: null as unknown as FirebaseFirestore.Timestamp,
      status: "submitted",
      qualification_state: "submitted",
      opportunity_state: "not_applicable",
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
        requestedLanes: ["qualification"],
        helpWith: ["custom-capture"],
        details: "Need detailed capture specs.",
        buyerType: "site_operator",
        siteName: "Analytical Engine Co - Durham",
        siteLocation: "Durham, NC",
        taskStatement: "Qualify a picking workflow for a mobile manipulator.",
        targetSiteType: "Warehouse picking aisle",
        proofPathPreference: "exact_site_required",
        existingStackReviewWorkflow: "Hosted review before simulator ingestion.",
        humanGateTopics: "Raise rights and delivery scope early.",
        workflowContext: "Pick from shelving and place into outbound totes.",
        operatingConstraints: "Overnight only.",
        privacySecurityConstraints: "Blur packaging labels.",
        knownBlockers: "Narrow aisle at station 4.",
        targetRobotTeam: "Optional robot team",
        captureRights: "Capture permitted after NDA review.",
        derivedScenePermission: "Derived scenes can be shared with the robot team.",
        datasetLicensingPermission: "Dataset exports require commercial review.",
        payoutEligibility: "Commercial terms still need approval.",
        displayCaptureMetadata: {
          targetName: "Analytical Engine Co - Durham",
          addressLabel: "Durham, NC",
          requestId: "req-123",
          captureJobId: "capture-job-123",
          captureBrief: "Capture the aisle handoff for display-guided review.",
          privacyReminder: "Capture only approved areas.",
          allowedAdvisoryHints: ["hold_steady", "scan_corners"],
        },
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
    expect(isEncryptedField(encrypted.request.displayCaptureMetadata?.targetName ?? "")).toBe(true);
    expect(isEncryptedField(encrypted.request.displayCaptureMetadata?.addressLabel ?? "")).toBe(true);
    expect(isEncryptedField(encrypted.request.displayCaptureMetadata?.captureBrief ?? "")).toBe(true);
    expect(encrypted.request.displayCaptureMetadata?.requestId).toBe("req-123");
    expect(encrypted.request.displayCaptureMetadata?.captureJobId).toBe("capture-job-123");

    const decrypted = await decryptInboundRequestForAdmin(encrypted as any);
    expect(decrypted.request.targetSiteType).toBe("Warehouse picking aisle");
    expect(decrypted.request.proofPathPreference).toBe("exact_site_required");
    expect(decrypted.request.existingStackReviewWorkflow).toBe(
      "Hosted review before simulator ingestion.",
    );
    expect(decrypted.request.humanGateTopics).toBe(
      "Raise rights and delivery scope early.",
    );
    expect(decrypted.request.captureRights).toBe("Capture permitted after NDA review.");
    expect(decrypted.request.derivedScenePermission).toBe(
      "Derived scenes can be shared with the robot team.",
    );
    expect(decrypted.request.datasetLicensingPermission).toBe(
      "Dataset exports require commercial review.",
    );
    expect(decrypted.request.payoutEligibility).toBe(
      "Commercial terms still need approval.",
    );
    expect(decrypted.request.displayCaptureMetadata).toMatchObject({
      targetName: "Analytical Engine Co - Durham",
      addressLabel: "Durham, NC",
      requestId: "req-123",
      captureJobId: "capture-job-123",
      captureBrief: "Capture the aisle handoff for display-guided review.",
      privacyReminder: "Capture only approved areas.",
      allowedAdvisoryHints: ["hold_steady", "scan_corners"],
    });
  });
});
