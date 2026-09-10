// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { taskEvaluationLaunchPreparationInputSchema } from "../utils/taskEvaluationLaunchPreparationContract";
import { sceneConfigurationBudgetProfiles } from "../utils/taskEvaluationSceneConfigurationBudgetProfiles";

const fixture = () => JSON.parse(readFileSync(new URL("./fixtures/astra-preparation-request.v1.json", import.meta.url), "utf8"));

describe("Pipeline/WebApp scene authoring budget parity", () => {
  it("matches the Pipeline-generated versioned profile data", () => {
    const shared = JSON.parse(readFileSync(new URL("./fixtures/task-evaluation-scene-budget-profiles.v1.json", import.meta.url), "utf8"));
    expect(sceneConfigurationBudgetProfiles).toEqual(shared);
    expect(shared.creates_spend_authority).toBe(false);
  });

  it("accepts the exact shared fresh Astra quote without mutating its caps", () => {
    const value = fixture();
    const original = JSON.stringify(value);
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    expect(value.spend.hard_cap_usd).toBe(16.76);
    expect(value.spend.external_service_caps.openai.maximum_cost_usd).toBe(10.76);
    expect(JSON.stringify(value)).toBe(original);
  });

  it("allows explicit authoring budgets through 15 but never beyond the profile ceiling", () => {
    const value = fixture();
    value.spend.hard_cap_usd = 26.76;
    value.spend.external_service_caps.openai.maximum_cost_usd = 20.76;
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 15;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 15.01;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(false);
  });

  it("keeps absent or legacy backend requests at external 6 and attempt 12", () => {
    const value = fixture();
    delete value.replacement_authoring_backend;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(false);
    value.spend.hard_cap_usd = 12;
    value.spend.external_service_caps.openai.maximum_cost_usd = 6;
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 0.24;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    value.replacement_authoring_backend = "content_agents";
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    value.replacement_authoring_backend = "astra_cad_blender_v1";
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(false);
  });
});
