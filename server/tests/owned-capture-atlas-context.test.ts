// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { requireOwnedCaptureAtlasSource, validateOwnedCaptureAtlasContext } from "../utils/ownedCaptureAtlasContext";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-context.json", import.meta.url), "utf8"));
const example = () => structuredClone(fixture);
const bind = (value: ReturnType<typeof example>) => requireOwnedCaptureAtlasSource({
  session: value.session, ownerUid: "reference-owner", context: value.context,
});
const rehash = (context: Record<string, any>) => {
  context.context_digest = crossRuntimeArtifactDigest(context, "context_digest");
};

it("reads the Python-generated context with RFC8785 numbers and keeps all source facts", () => {
  const value = example(), before = structuredClone(value);
  expect(crossRuntimeArtifactDigest(value.context, "context_digest")).toBe(value.context.context_digest);
  expect(bind(value)).toEqual(value.context);
  expect(value).toEqual(before);
  expect(value.context.task_specification.operations).toEqual(["pickup", "containment", "articulation", "return"]);
  expect(value.context.task_confirmation_status).toBe("proposed_unconfirmed");
  expect(value.context.governance.consent).toBe("not_required");
  expect(value.context.governance.provider_constraints.external_processing_allowed).toBe(false);
  expect(value.context.authority_issued).toBe(false);
});

it.each(["owner", "lifecycle", "access", "source_digest", "source_profile", "source_session", "qa"])(
  "reopens the session and refuses changed %s", (changed) => {
    const value = example();
    if (changed === "owner") value.session.owner_user_id = "another-user";
    if (changed === "lifecycle") value.session.completed_capture_lifecycle = { action: "delete" };
    if (changed === "access") value.session.capture_access = { future_processing_allowed: false };
    if (changed === "source_digest") value.session.pipeline_capture_intake_receipt.capture_digest = `sha256:${"6".repeat(64)}`;
    if (changed === "source_profile") value.session.request.capture_authority_profile = "another-profile";
    if (changed === "source_session") value.session.session_id = "another-session";
    if (changed === "qa") value.session.pipeline_capture_qa.report.checks = [{ check_id: "fabricated" }];
    expect(() => bind(value)).toThrow();
  },
);

it.each(["task", "privacy", "retention", "providers", "coordinates"])(
  "does not accept a client-rehashed change to current %s", (changed) => {
    const value = example(), context = value.context;
    if (changed === "task") context.description = context.task_specification.description = "Do an easier task.";
    if (changed === "privacy") context.governance.privacy = "restricted_local_only";
    if (changed === "retention") context.governance.retention.max_days = 365;
    if (changed === "providers") context.permitted_reconstruction_providers.push("another-provider");
    if (changed === "coordinates") context.coordinate_frame_declaration.metric_scale = "measured";
    rehash(context);
    expect(validateOwnedCaptureAtlasContext(context)).toEqual(context);
    expect(() => bind(value)).toThrow("owned_capture_atlas_source_or_task_changed");
  },
);

it("retains null confirmation as null and never manufactures acceptance", () => {
  const value = example();
  value.context.task_specification.success_parameters_status = null;
  value.context.task_confirmation_status = null;
  value.session.request.known_task_specification.success_parameters_status = null;
  rehash(value.context);
  expect(bind(value).task_confirmation_status).toBeNull();
  value.context.authority_issued = true;
  rehash(value.context);
  expect(() => bind(value)).toThrow("owned_capture_atlas_context_schema_invalid");
});

it("does not trim or rewrite the complete original task text", () => {
  const value = example(), text = `  ${value.context.description}  `;
  value.context.description = value.context.task_specification.description = text;
  value.session.request.known_task_specification.description = text;
  rehash(value.context);
  expect(bind(value).description).toBe(text);
});
