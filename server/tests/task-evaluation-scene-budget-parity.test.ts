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

  it("allows explicit authoring budgets through the shared $25 stage pool but never beyond the profile ceiling", () => {
    const astra = sceneConfigurationBudgetProfiles.profiles.astra_cad_blender_v1;
    expect(astra.authoring_maximum).toBe(25);
    expect(astra.external_maximum).toBe(30.76);
    expect(astra.attempt_maximum).toBe(36.76);
    const value = fixture();
    value.spend.hard_cap_usd = 26.76;
    value.spend.external_service_caps.openai.maximum_cost_usd = 20.76;
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 15;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    value.spend.hard_cap_usd = 36.76;
    value.spend.external_service_caps.openai.maximum_cost_usd = 30.76;
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 25;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(true);
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 25.01;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(false);
    value.spend.external_service_caps.openai.stage_max_cost_usd.content_agents = 25;
    value.spend.hard_cap_usd = 36.77;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(value).success).toBe(false);
  });

  it("derives the native allowance a website articulated scene needs from the shared profile", () => {
    // A prepared website scene runs no ArtiFixer stages: its stage-3 quote is the
    // provider compute cap plus the whole shared CAD/Blender authoring pool. The
    // website sponsorship's native allowance (the scene intent's execution
    // ceiling) must cover it, or the Pipeline refuses the construction request.
    const astra = sceneConfigurationBudgetProfiles.profiles.astra_cad_blender_v1;
    expect(sceneConfigurationBudgetProfiles.provider_compute_cap + astra.authoring_maximum).toBe(31);
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
