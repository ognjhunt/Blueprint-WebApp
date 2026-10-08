// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "@openai/agents";
import type OpenAI from "openai";
import { createSiteAssessmentAgent, siteAssessmentSchema } from "../agents/site-assessment";

// Capture the installed SDK's actual Responses request before any network call.
// A scripted Model bypasses this serialization and misses provider schema errors.
describe("site assessment Responses output contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("serializes all tools and output without unsupported strict-schema composition", async () => {
    const network = vi.fn(() => { throw new Error("network_forbidden"); });
    vi.stubGlobal("fetch", network);
    const create = vi.fn(async (_request: unknown) => { throw new Error("capture_only"); });
    const provider = new OpenAIProvider({ useResponses: true,
      openAIClient: { responses: { create } } as unknown as OpenAI });
    const admission = vi.fn(async () => undefined);
    const instance = await createSiteAssessmentAgent({ request_id: "schema-fixture",
      operator_messages: [{ id: "statement", text: "Door and rack movement; success targets unknown.", source_ref: "operator:fixture" }], video: null,
      site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null },
    }, { history_access: null, model_provider: provider, authorize_model_call: admission, max_turns: 1 });
    await expect(instance.run()).rejects.toThrow("capture_only");
    expect(admission).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
    const request = create.mock.calls[0][0] as unknown as {
      tools: Array<{ parameters: unknown }>;
      text: { format: { schema: unknown } };
    };
    const unsupported = new Set(["allOf", "not", "dependentRequired", "dependentSchemas", "if", "then", "else"]);
    const findings: string[] = [];
    function inspect(value: unknown, path: string) {
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      for (const keyword of unsupported) if (keyword in node) findings.push(`${path}/${keyword}`);
      if (node.type === "object") {
        expect(node.additionalProperties, path).toBe(false);
        expect([...(node.required as string[] | undefined ?? [])].sort(), path).toEqual(Object.keys(node.properties as object ?? {}).sort());
      }
      for (const [key, child] of Object.entries(node)) inspect(child, `${path}/${key}`);
    }
    request.tools.forEach((tool, index) => inspect(tool.parameters, `tools/${index}`));
    inspect(request.text.format.schema, "output");
    expect(findings).toEqual([]);
  });

  it("still decodes retained citations without selectors", () => {
    const legacyClaim = { text: "Owner supplied context", basis: "operator_stated", evidence: [{ source_id: "owner:fixture", at_seconds: null }] };
    const legacy = { status: "needs_operator_input", job: [legacyClaim], objects_motions_conditions_variations: [], operator_success: [],
      known: [], estimates: [], missing: [], approaches: [], questions: [],
      next_action: { kind: "ask_operator", action: "Clarify the job", why: legacyClaim } };
    expect(siteAssessmentSchema.parse(legacy).job[0].evidence[0]).not.toHaveProperty("selector");
  });
});
