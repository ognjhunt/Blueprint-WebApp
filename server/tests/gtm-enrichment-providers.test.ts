// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExactSiteGtmPilotLedger } from "../utils/exactSiteHostedReviewGtmPilot";
import {
  buildHumanRecipientEvidenceTemplate,
  createGovernedPublicContactProvider,
  runGtmEnrichmentWaterfall,
  validateHumanRecipientEvidenceFile,
  validateSelectedLedgerRecipientEvidence,
  type GtmEnrichmentProvider,
} from "../utils/gtmEnrichmentProviders";

const tempDirs: string[] = [];

function ledger(): ExactSiteGtmPilotLedger {
  return {
    schema: "blueprint/exact-site-hosted-review-gtm-ledger/v1",
    pilot: {
      name: "Blueprint uses Blueprint to sell Blueprint",
      wedge: "Exact-Site Hosted Review",
      startDate: "2026-04-27",
      endDate: "2026-05-10",
      status: "active",
      dailyTouchTargetMin: 20,
      dailyTouchTargetMax: 50,
      paidScaleAllowed: false,
    },
    targets: [
      {
        id: "target-1",
        track: "demand_sourced_capture",
        organizationName: "Robot Team",
        buyerSegment: "Warehouse autonomy team",
        workflowNeed: "Pick the warehouse workflow worth capturing first.",
        intentSignals: ["Public deployment signal."],
        evidence: { summary: "Real target evidence." },
        artifact: {
          type: "city_site_opportunity_brief",
          status: "draft",
        },
        captureAsk: {
          requestedSiteType: "warehouse pick aisle",
          status: "not_started",
        },
        outbound: {
          status: "draft_ready",
          approvalState: "blocked",
        },
      },
    ],
    dailyActivity: [],
  };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("GTM enrichment waterfall", () => {
  it("builds an unselected recipient-evidence template without inventing contact data", () => {
    const result = buildHumanRecipientEvidenceTemplate({
      ledger: ledger(),
      ledgerPath: "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
    });

    expect(result.schema).toBe("blueprint/gtm-human-recipient-evidence-template/v1");
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      targetId: "target-1",
      organizationName: "Robot Team",
      email: null,
      evidenceSource: null,
      selectedForFirstSend: false,
    });
    expect(result.instructions.join("\n")).toContain("Do not infer or guess email addresses");
  });

  it("records provider runs and selects a recipient only from normalized evidence", async () => {
    const input = ledger();
    input.targets[0].blockers = [
      {
        id: "gtm-blocker-contact-discovery-allowlist",
        status: "blocked",
        summary: "Governed recipient discovery is blocked because no selected recipient evidence exists.",
        owner: "growth-lead",
        nextAction: "Configure discovery or record explicit recipient-backed evidence.",
      },
    ];
    const provider: GtmEnrichmentProvider = {
      key: "repo_artifact",
      async enrich() {
        return {
          run: {
            providerKey: "repo_artifact",
            status: "contact_found",
            searchedAt: "2026-04-27T12:00:00.000Z",
            candidateCount: 1,
          },
          candidates: [
            {
              email: "buyer@robotteam.co",
              evidenceSource: "Recipient sourced from explicit public contact evidence at https://robotteam.co/contact.",
              evidenceType: "explicit_research",
              providerKey: "repo_artifact",
              confidence: "high",
              discoveredAt: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runGtmEnrichmentWaterfall({
      ledger: input,
      providers: [provider],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(1);
    expect(result.summary.selectedRecipients).toBe(1);
    expect(target.recipient?.email).toBe("buyer@robotteam.co");
    expect(target.outbound.approvalState).toBe("pending_first_send_approval");
    expect(target.enrichment?.status).toBe("contact_found");
    expect(target.enrichment?.providerRuns).toHaveLength(1);
    expect(target.enrichment?.recipientCandidates).toHaveLength(1);
    expect(target.blockers?.[0]).toMatchObject({
      id: "gtm-blocker-contact-discovery-allowlist",
      status: "resolved",
      nextAction: expect.stringContaining("founder first-send approval"),
    });
  });

  it("keeps placeholder candidates out of the ledger", async () => {
    const provider: GtmEnrichmentProvider = {
      key: "repo_artifact",
      async enrich() {
        return {
          run: {
            providerKey: "repo_artifact",
            status: "contact_found",
            searchedAt: "2026-04-27T12:00:00.000Z",
            candidateCount: 1,
          },
          candidates: [
            {
              email: "person@example.com",
              evidenceSource: "Invalid placeholder evidence.",
              evidenceType: "explicit_research",
              providerKey: "repo_artifact",
              confidence: "high",
              discoveredAt: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providers: [provider],
      selectRecipients: true,
    });

    expect(result.ledger.targets[0].recipient).toBeUndefined();
    expect(result.ledger.targets[0].enrichment?.recipientCandidates).toHaveLength(0);
    expect(result.ledger.targets[0].enrichment?.status).toBe("exhausted");
  });

  it("rejects reserved test-domain recipient candidates", async () => {
    const provider: GtmEnrichmentProvider = {
      key: "repo_artifact",
      async enrich() {
        return {
          run: {
            providerKey: "repo_artifact",
            status: "contact_found",
            searchedAt: "2026-04-27T12:00:00.000Z",
            candidateCount: 1,
          },
          candidates: [
            {
              email: "buyer@robotteam.invalid",
              evidenceSource: "Reserved test-domain evidence.",
              evidenceType: "explicit_research",
              providerKey: "repo_artifact",
              confidence: "high",
              discoveredAt: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providers: [provider],
      selectRecipients: true,
    });

    expect(result.ledger.targets[0].recipient).toBeUndefined();
    expect(result.ledger.targets[0].enrichment?.recipientCandidates).toHaveLength(0);
    expect(result.ledger.targets[0].enrichment?.status).toBe("exhausted");
  });

  it("records human-supplied recipient evidence from a file without selecting unapproved rows", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify({
        recipients: [
          {
            targetId: "target-1",
            email: "buyer@robotteam.co",
            evidenceSource: "Human supplied explicit evidence from CRM note 123.",
            selectedForFirstSend: false,
          },
        ],
      }),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(1);
    expect(result.summary.selectedRecipients).toBe(0);
    expect(target.recipient).toBeUndefined();
    expect(target.enrichment?.recipientCandidates?.[0]?.email).toBe("buyer@robotteam.co");
    expect(target.enrichment?.recipientCandidates?.[0]?.selectable).toBe(false);
  });

  it("selects human-supplied recipient evidence only when the row is explicitly selected", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify([
        {
          organizationName: "Robot Team",
          email: "approved@robotteam.co",
          evidenceSource: "Human supplied explicit evidence from CRM note 456.",
          selectedForFirstSend: true,
        },
      ]),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(1);
    expect(result.summary.selectedRecipients).toBe(1);
    expect(target.recipient?.email).toBe("approved@robotteam.co");
    expect(target.recipient?.evidenceType).toBe("human_supplied");
    expect(target.outbound.approvalState).toBe("pending_first_send_approval");
  });

  it("validates human-supplied recipient evidence before ledger mutation", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify({
        recipients: [
          {
            targetId: "target-1",
            organizationName: "Robot Team",
            email: "approved@robotteam.co",
            evidenceSource: "Human supplied explicit evidence from CRM note 456.",
            selectedForFirstSend: true,
          },
          {
            organizationName: "Different Team",
            email: "person@example.com",
            evidenceSource: "Placeholder row that must stay blocked.",
            selectedForFirstSend: true,
          },
        ],
      }),
      "utf8",
    );

    const result = await validateHumanRecipientEvidenceFile({
      ledger: ledger(),
      evidencePath,
    });

    expect(result.totalRows).toBe(2);
    expect(result.validSelectedRows).toBe(1);
    expect(result.targetsWithSelectedEvidence).toEqual(["target-1"]);
    expect(result.blockers.join("\n")).toContain("row 2 does not exactly match");
    expect(result.blockers.join("\n")).toContain("invalid or placeholder email");
  });

  it("validates selected recipient evidence already recorded in the ledger", () => {
    const input = ledger();
    input.targets[0].recipient = {
      email: "approved@robotteam.co",
      evidenceSource: "Human supplied explicit evidence from CRM note 456.",
      evidenceType: "human_supplied",
    };
    input.targets[0].enrichment = {
      status: "contact_found",
      providerRuns: [],
      selectedRecipientEvidence: {
        providerKey: "manual_human_supplied",
        selectedAt: "2026-05-07T12:00:00.000Z",
        evidenceSource: "Human supplied explicit evidence from CRM note 456.",
      },
      recipientCandidates: [
        {
          email: "approved@robotteam.co",
          evidenceSource: "Human supplied explicit evidence from CRM note 456.",
          evidenceType: "human_supplied",
          providerKey: "manual_human_supplied",
          confidence: "high",
          discoveredAt: "2026-05-07T12:00:00.000Z",
          selectable: true,
        },
      ],
    };

    const result = validateSelectedLedgerRecipientEvidence({
      ledger: input,
      ledgerPath: "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
    });

    expect(result.totalRows).toBe(1);
    expect(result.validSelectedRows).toBe(1);
    expect(result.targetsWithSelectedEvidence).toEqual(["target-1"]);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks selected ledger recipients without normalized selected evidence metadata", () => {
    const input = ledger();
    input.targets[0].recipient = {
      email: "approved@robotteam.co",
      evidenceSource: "Human supplied explicit evidence from CRM note 456.",
      evidenceType: "human_supplied",
    };

    const result = validateSelectedLedgerRecipientEvidence({
      ledger: input,
    });

    expect(result.validSelectedRows).toBe(0);
    expect(result.blockers.join("\n")).toContain("selectedRecipientEvidence metadata");
    expect(result.blockers.join("\n")).toContain("normalized enrichment candidate row");
  });

  it("rejects human-supplied recipient rows with placeholder evidence sources", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify([
        {
          targetId: "target-1",
          email: "approved@robotteam.co",
          evidenceSource: "<source URL or durable source note>",
          selectedForFirstSend: true,
        },
      ]),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const validation = await validateHumanRecipientEvidenceFile({
      ledger: ledger(),
      evidencePath,
    });
    expect(validation.validSelectedRows).toBe(0);
    expect(validation.blockers.join("\n")).toContain("missing a real evidence source");

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });
    expect(result.summary.candidatesAdded).toBe(0);
    expect(result.summary.selectedRecipients).toBe(0);
    expect(result.summary.blockers).toBe(1);
    expect(result.ledger.targets[0].recipient).toBeUndefined();
    expect(result.ledger.targets[0].enrichment?.status).toBe("blocked");
    expect(result.ledger.targets[0].enrichment?.blockers?.join("\n")).toContain("missing a real evidence source");
  });

  it("blocks malformed non-object rows in human-supplied recipient files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify({
        recipients: [
          "not-a-row",
          null,
        ],
      }),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const validation = await validateHumanRecipientEvidenceFile({
      ledger: ledger(),
      evidencePath,
    });
    expect(validation.totalRows).toBe(0);
    expect(validation.blockers.join("\n")).toContain("malformed recipient row");

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });
    expect(result.summary.candidatesAdded).toBe(0);
    expect(result.summary.selectedRecipients).toBe(0);
    expect(result.summary.blockers).toBe(1);
    expect(result.ledger.targets[0].recipient).toBeUndefined();
    expect(result.ledger.targets[0].enrichment?.status).toBe("blocked");
    expect(result.ledger.targets[0].enrichment?.blockers?.join("\n")).toContain("malformed recipient row");
  });

  it("does not match partial organization names in human-supplied recipient evidence", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify([
        {
          organizationName: "Robot",
          email: "approved@robot.co",
          evidenceSource: "Human supplied explicit evidence for a different target.",
          selectedForFirstSend: true,
        },
      ]),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(0);
    expect(result.summary.selectedRecipients).toBe(0);
    expect(target.recipient).toBeUndefined();
    expect(target.enrichment?.recipientCandidates).toHaveLength(0);
    expect(target.enrichment?.status).toBe("exhausted");
  });

  it("blocks malformed matching human-supplied recipient evidence rows", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gtm-human-evidence-"));
    tempDirs.push(tempDir);
    const evidencePath = path.join(tempDir, "recipients.json");
    await fs.writeFile(
      evidencePath,
      JSON.stringify([
        {
          targetId: "target-1",
          email: "person@example.com",
          selectedForFirstSend: true,
        },
      ]),
      "utf8",
    );
    vi.stubEnv("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH", evidencePath);

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providerKeys: ["manual_human_supplied"],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(0);
    expect(result.summary.selectedRecipients).toBe(0);
    expect(result.summary.blockers).toBe(1);
    expect(target.recipient).toBeUndefined();
    expect(target.enrichment?.status).toBe("blocked");
    expect(target.enrichment?.blockers?.join("\n")).toContain("invalid or placeholder email");
  });

  it("discovers allowlisted public contact pages through governed search", async () => {
    vi.stubEnv("BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS", "robotteam.co");
    vi.stubEnv("BLUEPRINT_GTM_CONTACT_DISCOVERY_SEARCH_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_GTM_CONTACT_DISCOVERY_SEARCH_URL", "https://search.invalid/html");
    vi.stubEnv("BLUEPRINT_GTM_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS", "search.invalid");
    const input = ledger();
    input.targets[0].evidence.sourceUrls = ["https://robotteam.co/"];

    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.startsWith("https://search.invalid/html")) {
        return new Response(
          [
            "<html><body>",
            "<a href=\"https://robotteam.co/contact\">Contact</a>",
            "<a href=\"https://outside.co/contact\">Outside</a>",
            "</body></html>",
          ].join(""),
          {
            status: 200,
            headers: { "Content-Type": "text/html" },
          },
        );
      }
      if (href === "https://robotteam.co/contact") {
        return new Response("<html>Contact: buyer@robotteam.co</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGtmEnrichmentWaterfall({
      ledger: input,
      providers: [createGovernedPublicContactProvider()],
      selectRecipients: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/search\.invalid\/html\?/),
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://robotteam.co/contact",
      expect.objectContaining({
        headers: { "User-Agent": "Blueprint GTM contact discovery" },
      }),
    );
    expect(result.summary.candidatesAdded).toBe(1);
    expect(result.summary.selectedRecipients).toBe(1);
    expect(result.ledger.targets[0].recipient?.email).toBe("buyer@robotteam.co");
    expect(result.ledger.targets[0].enrichment?.selectedRecipientEvidence?.providerKey)
      .toBe("governed_public_contact");
  });
});
