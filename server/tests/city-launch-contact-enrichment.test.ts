// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("city launch contact enrichment", () => {
  it("repairs missing contact_email fields from truthful recipient evidence and writes an enrichment artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-contact-enrichment-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-sacramento.md");
    const outputPath = path.join(tempDir, "city-launch-sacramento-contact-enrichment.json");
    await fs.writeFile(
      artifactPath,
      [
        "# Sacramento, CA",
        "",
        "## Machine-readable activation payload",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Sacramento, CA",
            city_slug: "sacramento-ca",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "city-opening-first-wave-pack",
                title: "Assemble first-wave pack",
                phase: "supply",
                owner_lane: "capturer-growth-agent",
                human_lane: "growth-lead",
                summary: "Prepare first-wave outreach and posting assets.",
                dependency_keys: [],
                success_criteria: ["First-wave pack is ready."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            ],
            named_claims: [
              {
                subject: "Capital Robotics",
                claim_type: "company",
                claim: "Capital Robotics is a named buyer target.",
                validation_required: false,
                source_urls: ["https://example.com/buyer"],
              },
            ],
          },
          null,
          2,
        ),
        "```",
        "",
        "## Structured launch data appendix",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-17T12:00:00.000Z",
            capture_location_candidates: [
              {
                name: "Northgate Logistics",
                source_bucket: "industrial_warehouse",
                channel: "professional_outreach",
                status: "qualified",
                workflow_fit: "dock handoff",
                source_urls: ["https://example.com/location"],
                explicit_fields: ["name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
            buyer_target_candidates: [
              {
                company_name: "Capital Robotics",
                status: "researched",
                workflow_fit: "dock handoff",
                proof_path: "exact_site",
                source_urls: ["https://example.com/buyer"],
                explicit_fields: ["company_name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    const { runCityLaunchContactEnrichment } = await import("../utils/cityLaunchContactEnrichment");
    const result = await runCityLaunchContactEnrichment({
      city: "Sacramento, CA",
      artifactPath,
      outputPath,
      resolveRecipientEvidence: async () =>
        new Map([
          [
            "capitalrobotics",
            {
              recipientEmail: "taylor@capitalrobotics.com",
              source: "Recipient sourced from real growth campaign delivery evidence for Capital Robotics.",
            },
          ],
          [
            "northgatelogistics",
            {
              recipientEmail: "ops@northgatelogistics.com",
              source: "Recipient sourced from real growth campaign delivery evidence for Northgate Logistics.",
            },
          ],
        ]),
    });

    expect(result.status).toBe("enriched");
    expect(result.errors).toEqual([]);
    expect(result.parsed?.buyerTargets[0]?.contactEmail).toBe("taylor@capitalrobotics.com");
    expect(result.parsed?.captureCandidates[0]?.contactEmail).toBe("ops@northgatelogistics.com");
    expect(result.parsed?.buyerTargets[0]?.provenance.sourceType).toBe("city_launch_contact_enrichment");
    expect(result.outputPath).toBe(outputPath);

    const persisted = JSON.parse(await fs.readFile(outputPath, "utf8")) as {
      buyer_target_candidates: Array<{ contact_email: string }>;
      capture_location_candidates: Array<{ contact_email: string }>;
    };
    expect(persisted.buyer_target_candidates[0]?.contact_email).toBe("taylor@capitalrobotics.com");
    expect(persisted.capture_location_candidates[0]?.contact_email).toBe("ops@northgatelogistics.com");
  });

  it("recovers a missing activation payload from a canonical payload artifact before enrichment", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-contact-enrichment-fallback-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-san-diego.md");
    const fallbackActivationPayloadPath = path.join(tempDir, "city-launch-san-diego-activation-payload.json");
    await fs.writeFile(
      artifactPath,
      [
        "# San Diego, CA",
        "",
        "## Structured launch data appendix",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-17T12:00:00.000Z",
            capture_location_candidates: [],
            buyer_target_candidates: [],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(
      fallbackActivationPayloadPath,
      JSON.stringify(
        {
          schema_version: "2026-04-13.city-launch-activation-payload.v1",
          machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
          city: "San Diego, CA",
          city_slug: "san-diego-ca",
          city_thesis: "Run one proof-led warehouse wedge.",
          primary_site_lane: "industrial_warehouse",
          primary_workflow_lane: "dock handoff",
          primary_buyer_proof_path: "exact_site",
          lawful_access_modes: ["buyer_requested_site"],
          preferred_lawful_access_mode: "buyer_requested_site",
          rights_path: {
            summary: "Private controlled interiors require authorization.",
            private_controlled_interiors_require_authorization: true,
            validation_required: false,
            source_urls: ["https://example.com/rights"],
          },
          validation_blockers: [],
          required_approvals: [{ lane: "founder", reason: "go/no-go" }],
          owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
          issue_seeds: [
            {
              key: "city-opening-first-wave-pack",
              title: "Assemble first-wave pack",
              phase: "supply",
              owner_lane: "capturer-growth-agent",
              human_lane: "growth-lead",
              summary: "Prepare first-wave outreach and posting assets.",
              dependency_keys: [],
              success_criteria: ["First-wave pack is ready."],
              metrics_dependencies: ["first_lawful_access_path"],
              validation_required: false,
            },
          ],
          metrics_dependencies: [
            { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
          ],
          named_claims: [
            {
              subject: "San Diego industrial wedge",
              claim_type: "company",
              claim: "San Diego is a bounded industrial wedge.",
              validation_required: false,
              source_urls: ["https://example.com/claim"],
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const { runCityLaunchContactEnrichment } = await import("../utils/cityLaunchContactEnrichment");
    const result = await runCityLaunchContactEnrichment({
      city: "San Diego, CA",
      artifactPath,
      fallbackActivationPayloadPath,
      resolveRecipientEvidence: async () => new Map(),
    });

    expect(result.status).toBe("no_changes");
    expect(result.errors).toEqual([]);
    expect(result.parsed?.activationPayload?.city).toBe("San Diego, CA");
    expect(result.warnings.join("\n")).toContain("Recovered machine-readable activation payload from canonical artifact");
  });

  it("falls back to governed external directory discovery when internal evidence is missing", async () => {
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS", "directory.example.com, company.example.com");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-contact-enrichment-external-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-sacramento.md");
    await fs.writeFile(
      artifactPath,
      [
        "# Sacramento, CA",
        "",
        "## Machine-readable activation payload",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Sacramento, CA",
            city_slug: "sacramento-ca",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "city-opening-first-wave-pack",
                title: "Assemble first-wave pack",
                phase: "supply",
                owner_lane: "capturer-growth-agent",
                human_lane: "growth-lead",
                summary: "Prepare first-wave outreach and posting assets.",
                dependency_keys: [],
                success_criteria: ["First-wave pack is ready."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            ],
            named_claims: [
              {
                subject: "Capital Robotics",
                claim_type: "company",
                claim: "Capital Robotics is a named buyer target.",
                validation_required: false,
                source_urls: ["https://example.com/buyer"],
              },
            ],
          },
          null,
          2,
        ),
        "```",
        "",
        "## Structured launch data appendix",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-17T12:00:00.000Z",
            capture_location_candidates: [
              {
                name: "Northgate Logistics",
                source_bucket: "industrial_warehouse",
                channel: "professional_outreach",
                status: "qualified",
                workflow_fit: "dock handoff",
                source_urls: ["https://company.example.com/contact"],
                explicit_fields: ["name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
            buyer_target_candidates: [
              {
                company_name: "Capital Robotics",
                status: "researched",
                workflow_fit: "dock handoff",
                proof_path: "exact_site",
                source_urls: ["https://directory.example.com/capital-robotics"],
                explicit_fields: ["company_name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (href.includes("directory.example.com")) {
          return new Response(
            '<html><body>Reach Taylor at <a href="mailto:taylor@capitalrobotics.com">taylor@capitalrobotics.com</a></body></html>',
            { status: 200 },
          );
        }
        if (href.includes("company.example.com")) {
          return new Response(
            "<html><body>Email ops@northgatelogistics.com for Sacramento availability.</body></html>",
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { runCityLaunchContactEnrichment } = await import("../utils/cityLaunchContactEnrichment");
    const result = await runCityLaunchContactEnrichment({
      city: "Sacramento, CA",
      artifactPath,
      resolveRecipientEvidence: async () => new Map(),
    });

    expect(result.status).toBe("enriched");
    expect(result.parsed?.buyerTargets[0]?.contactEmail).toBe("taylor@capitalrobotics.com");
    expect(result.parsed?.captureCandidates[0]?.contactEmail).toBe("ops@northgatelogistics.com");
    expect(result.warnings.join("\n")).not.toContain("No governed external directory hosts");
  });

  it("can discover candidate public contact pages through a governed search provider before fetching them", async () => {
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS", "capitalrobotics.com");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_URL", "https://search.example.com/html");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS", "search.example.com");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-contact-enrichment-search-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-sacramento.md");
    await fs.writeFile(
      artifactPath,
      [
        "# Sacramento, CA",
        "",
        "## Machine-readable activation payload",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Sacramento, CA",
            city_slug: "sacramento-ca",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "city-opening-first-wave-pack",
                title: "Assemble first-wave pack",
                phase: "supply",
                owner_lane: "capturer-growth-agent",
                human_lane: "growth-lead",
                summary: "Prepare first-wave outreach and posting assets.",
                dependency_keys: [],
                success_criteria: ["First-wave pack is ready."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            ],
            named_claims: [
              {
                subject: "Capital Robotics",
                claim_type: "company",
                claim: "Capital Robotics is a named buyer target.",
                validation_required: false,
                source_urls: ["https://example.com/buyer"],
              },
            ],
          },
          null,
          2,
        ),
        "```",
        "",
        "## Structured launch data appendix",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-17T12:00:00.000Z",
            buyer_target_candidates: [
              {
                company_name: "Capital Robotics",
                status: "researched",
                workflow_fit: "dock handoff",
                proof_path: "exact_site",
                source_urls: [],
                explicit_fields: ["company_name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (href.startsWith("https://search.example.com/html")) {
          return new Response(
            '<html><body><a href="https://capitalrobotics.com/contact">Contact</a><a href="https://evil.example.net/contact">Ignore</a></body></html>',
            { status: 200 },
          );
        }
        if (href === "https://capitalrobotics.com/contact") {
          return new Response(
            "<html><body>Email taylor@capitalrobotics.com for autonomous warehouse pilots.</body></html>",
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { runCityLaunchContactEnrichment } = await import("../utils/cityLaunchContactEnrichment");
    const result = await runCityLaunchContactEnrichment({
      city: "Sacramento, CA",
      artifactPath,
      resolveRecipientEvidence: async () => new Map(),
    });

    expect(result.status).toBe("enriched");
    expect(result.parsed?.buyerTargets[0]?.contactEmail).toBe("taylor@capitalrobotics.com");
  });

  it("ranks stronger discovered contact pages ahead of generic about/team pages", async () => {
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS", "capitalrobotics.com");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_URL", "https://search.example.com/html");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS", "search.example.com");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-contact-enrichment-search-ranking-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-sacramento.md");
    await fs.writeFile(
      artifactPath,
      [
        "# Sacramento, CA",
        "",
        "## Machine-readable activation payload",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Sacramento, CA",
            city_slug: "sacramento-ca",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "city-opening-first-wave-pack",
                title: "Assemble first-wave pack",
                phase: "supply",
                owner_lane: "capturer-growth-agent",
                human_lane: "growth-lead",
                summary: "Prepare first-wave outreach and posting assets.",
                dependency_keys: [],
                success_criteria: ["First-wave pack is ready."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            ],
            named_claims: [
              {
                subject: "Capital Robotics",
                claim_type: "company",
                claim: "Capital Robotics is a named buyer target.",
                validation_required: false,
                source_urls: ["https://example.com/buyer"],
              },
            ],
          },
          null,
          2,
        ),
        "```",
        "",
        "## Structured launch data appendix",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-17T12:00:00.000Z",
            buyer_target_candidates: [
              {
                company_name: "Capital Robotics",
                status: "researched",
                workflow_fit: "dock handoff",
                proof_path: "exact_site",
                source_urls: [],
                explicit_fields: ["company_name", "workflow_fit"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (href.startsWith("https://search.example.com/html")) {
          return new Response(
            [
              "<html><body>",
              '<a href="https://capitalrobotics.com/about">About</a>',
              '<a href="https://capitalrobotics.com/team">Team</a>',
              '<a href="https://capitalrobotics.com/contact">Contact</a>',
              "</body></html>",
            ].join(""),
            { status: 200 },
          );
        }
        if (href === "https://capitalrobotics.com/about") {
          return new Response(
            "<html><body>Email hello@capitalrobotics.com to learn more.</body></html>",
            { status: 200 },
          );
        }
        if (href === "https://capitalrobotics.com/team") {
          return new Response(
            "<html><body>Email team@capitalrobotics.com for bios.</body></html>",
            { status: 200 },
          );
        }
        if (href === "https://capitalrobotics.com/contact") {
          return new Response(
            "<html><body>Email taylor@capitalrobotics.com for exact-site review pilots.</body></html>",
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { runCityLaunchContactEnrichment } = await import("../utils/cityLaunchContactEnrichment");
    const result = await runCityLaunchContactEnrichment({
      city: "Sacramento, CA",
      artifactPath,
      resolveRecipientEvidence: async () => new Map(),
    });

    expect(result.status).toBe("enriched");
    expect(result.parsed?.buyerTargets[0]?.contactEmail).toBe("taylor@capitalrobotics.com");
    expect(result.parsed?.buyerTargets[0]?.notes).toContain("https://capitalrobotics.com/contact");
  });
});
