// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildResearchPrompt,
  buildCritiquePrompt,
  buildFollowUpResearchPrompt,
  buildSynthesisPrompt,
  slugifyCityName,
  validateCityLaunchPlaybookMarkdown,
} from "../utils/cityLaunchPlanningHarness";
import { CITY_LAUNCH_RESEARCH_SCHEMA_VERSION } from "../utils/cityLaunchResearchParser";
import {
  CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
} from "../utils/cityLaunchDoctrine";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
} from "../utils/deepResearchFileSearch";

describe("city launch planning harness", () => {
  it("slugifies city names for artifact paths", () => {
    expect(slugifyCityName("Austin, TX")).toBe("austin-tx");
    expect(slugifyCityName("San Francisco, CA")).toBe("san-francisco-ca");
  });

  it("builds a critique prompt that audits Blueprint-specific risks", () => {
    const prompt = buildCritiquePrompt("Initial research body");
    expect(prompt).toContain("Blueprint's city proof-motion critique agent");
    expect(prompt).toContain("generic city marketplace launcher");
    expect(prompt).toContain("citywide expansion or liquidity language");
    expect(prompt).toContain("rights, provenance, privacy, or hosted proof");
    expect(prompt).toContain("unsupported access assumptions");
    expect(prompt).toContain("invented city-specific telemetry");
    expect(prompt).toContain("Manipulative or posture-drifting language");
    expect(prompt).toContain('missing a "verify before outreach" label');
    expect(prompt).toContain("Contract mismatches and unsafe structured output");
  });

  it("builds a research prompt with Blueprint proof-motion framing and constraints", () => {
    const prompt = buildResearchPrompt({
      city: "San Diego, CA",
      region: "California",
      similarCompanies: ["Uber", "DoorDash"],
      context: "Context body",
    });
    expect(prompt).toContain("Blueprint's city proof-motion research director");
    expect(prompt).toContain("Blueprint city proof-motion architecture");
    expect(prompt).toContain("not a generic startup memo or city marketplace launcher");
    expect(prompt).toContain("one site lane, one workflow lane, one buyer proof path");
    expect(prompt).toContain("private industrial or controlled-access interior capture requires explicit operator authorization");
    expect(prompt).toContain("use only repo-approved analytics vocabulary with city/source tags");
    expect(prompt).toContain("treat defense, export-controlled, or air-gapped review requirements as explicit constraints");
    expect(prompt).toContain("do not use manipulative, hypey, deceptive, or posture-changing language");
    expect(prompt).toContain("Analog sanity check");
    expect(prompt).toContain("Lawful capture supply acquisition system");
    expect(prompt).toContain("Rights / provenance / privacy clearance system");
    expect(prompt).toContain("Buyer proof-path routing system using only exact_site, adjacent_site, scoped_follow_up vocabulary");
    expect(prompt).toContain("Budget policy and approval thresholds");
    expect(prompt).toContain("Daily / weekly operating cadence");
    expect(prompt).toContain("Hypotheses needing validation");
    expect(prompt).toContain("What Must Be Validated Before Live Outreach");
    expect(prompt).toContain("Machine-readable activation payload");
    expect(prompt).toContain(CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION);
    expect(prompt).not.toContain("first 25, first 100, first 250 capturers");
    expect(prompt).toContain("do not ask for citywide liquidity");
  });

  it("builds a follow-up prompt focused on unresolved proof-motion gaps", () => {
    const prompt = buildFollowUpResearchPrompt({
      city: "San Diego, CA",
      critique: "Critique body",
      priorResearch: "Prior research body",
    });

    expect(prompt).toContain("Continue the Blueprint city proof-motion research for San Diego, CA.");
    expect(prompt).toContain("unresolved Blueprint proof-motion gaps");
    expect(prompt).toContain("lawful access path evidence");
    expect(prompt).toContain("hosted-review readiness");
    expect(prompt).toContain("commercial handoff readiness");
    expect(prompt).toContain("machine-readable activation payload");
    expect(prompt).toContain("do not drift into generic marketplace framing");
  });

  it("builds an optional file search tool config for deep research", () => {
    expect(buildDeepResearchTools()).toBeUndefined();
    expect(buildDeepResearchTools(["  "])).toBeUndefined();
    expect(buildDeepResearchTools(["fileSearchStores/blueprint-city-launch"])).toEqual([
      {
        type: "file_search",
        file_search_store_names: ["fileSearchStores/blueprint-city-launch"],
      },
    ]);
  });

  it("prefers explicit file search stores over env defaults", () => {
    process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE =
      "fileSearchStores/from-env";

    expect(
      resolveDeepResearchFileSearchStoreNames({
        explicitStoreNames: ["fileSearchStores/from-cli"],
        envKeys: ["BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE"],
      }),
    ).toEqual(["fileSearchStores/from-cli"]);

    delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
  });

  it("falls back to env-configured file search stores", () => {
    process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE =
      "fileSearchStores/store-a, fileSearchStores/store-b";

    expect(resolveDeepResearchFileSearchStoreNames({
      envKeys: ["BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE"],
    })).toEqual([
      "fileSearchStores/store-a",
      "fileSearchStores/store-b",
    ]);

    delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
  });

  it("builds a synthesis prompt that requires an operator-ready proof-motion playbook", () => {
    const prompt = buildSynthesisPrompt({
      city: "Austin, TX",
      research: "Research body",
      critiqueOutputs: ["Critique 1", "Critique 2"],
    });
    expect(prompt).toContain("single operator-ready Blueprint city proof-motion playbook");
    expect(prompt).toContain("City proof-motion thesis");
    expect(prompt).toContain("Narrow wedge definition");
    expect(prompt).toContain("Analog sanity check");
    expect(prompt).toContain("Lawful capture supply acquisition system");
    expect(prompt).toContain("Rights / provenance / privacy clearance system");
    expect(prompt).toContain("Buyer proof-path routing system");
    expect(prompt).toContain("Hosted-review conversion system");
    expect(prompt).toContain("Budget policy and approval thresholds");
    expect(prompt).toContain("Daily / weekly operating cadence");
    expect(prompt).toContain("Evidence-backed claims");
    expect(prompt).toContain("Hypotheses needing validation");
    expect(prompt).toContain("What Must Be Validated Before Live Outreach");
    expect(prompt).toContain("Human vs agent operating model");
    expect(prompt).toContain("What not to say publicly yet");
    expect(prompt).toContain("Machine-readable activation payload");
    expect(prompt).toContain("Structured launch data appendix");
    expect(prompt).toContain("not a generic marketplace launch plan");
    expect(prompt).toContain("first lawful site-operator access paths");
    expect(prompt).toContain("do not introduce city-specific analytics event names");
    expect(prompt).toContain("machine_policy_version");
    expect(prompt).toContain(CITY_LAUNCH_MACHINE_POLICY_VERSION);
    expect(prompt).toContain("allowed buyer target proof_path values");
    expect(prompt).toContain("approved analytics references for the instrumentation section");
    expect(prompt).not.toContain("first 25, first 100, first 250 capturers");
    expect(prompt).toContain("```city-launch-activation-payload");
    expect(prompt).toContain("```city-launch-records");
  });

  it("rejects synthesized playbooks that drift on telemetry, messaging, or appendix contracts", () => {
    const invalidPlaybook = [
      "# Austin, TX",
      "",
      "## Truth constraints",
      "",
      "## Evidence-backed claims",
      "",
      "## Inferred claims",
      "",
      "## Hypotheses needing validation",
      "",
      "## What not to say publicly yet",
      "",
      "Maintain an aura of exclusive, high-demand access.",
      "",
      "## Instrumentation spec",
      "",
      "- use `capturer_waitlist_entry` and `capture_materialized`",
      "",
      "## Machine-readable activation payload",
      "",
      "```city-launch-activation-payload",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
          machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
          city: "Austin, TX",
          city_slug: "austin-tx",
          city_thesis: "Test thesis",
          primary_site_lane: "warehouse",
          primary_workflow_lane: "dock handoff",
          primary_buyer_proof_path: "exact_site",
          lawful_access_modes: ["site_operator_intro"],
          preferred_lawful_access_mode: "site_operator_intro",
          rights_path: {
            summary: "Rights summary",
            private_controlled_interiors_require_authorization: true,
            validation_required: true,
            source_urls: [],
          },
          validation_blockers: [],
          required_approvals: [{ lane: "founder", reason: "go/no-go" }],
          owner_lanes: ["city-launch-agent"],
          issue_seeds: [
            {
              key: "seed-one",
              title: "Seed one",
              phase: "founder_gates",
              owner_lane: "city-launch-agent",
              human_lane: "growth-lead",
              summary: "Seed summary",
              dependency_keys: [],
              success_criteria: ["Do the thing"],
              metrics_dependencies: ["first_lawful_access_path"],
              validation_required: false,
            },
          ],
          metrics_dependencies: [
            {
              key: "robot_team_inbound_captured",
              kind: "event",
              status: "required_not_tracked",
              owner_lane: "analytics-agent",
            },
          ],
          named_claims: [
            {
              subject: "Example Robotics",
              claim_type: "company",
              claim: "Example claim",
              validation_required: true,
              source_urls: [],
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
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-13T00:00:00.000Z",
          buyer_target_candidates: [
            {
              company_name: "Example Robotics",
              status: "researched",
              proof_path: "hosted_review",
              source_urls: ["https://example.com"],
              explicit_fields: ["company_name"],
              inferred_fields: [],
            },
          ],
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const result = validateCityLaunchPlaybookMarkdown({
      city: "Austin, TX",
      markdown: invalidPlaybook,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("Manipulative or posture-drifting language detected");
    expect(result.errors.join("\n")).toContain("unsupported analytics vocabulary");
    expect(result.errors.join("\n")).toContain('Missing required section heading: "What Must Be Validated Before Live Outreach"');
    expect(result.errors.join("\n")).toContain('unsupported "proof_path" value "hosted_review"');
    expect(result.errors.join("\n")).toContain(
      'Activation payload is missing required metrics_dependencies key "proof_path_assigned"',
    );
  });
});
