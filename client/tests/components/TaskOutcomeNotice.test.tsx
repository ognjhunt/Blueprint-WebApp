// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskOutcomeNotice } from "@/components/site/TaskOutcomeNotice";
import { earlyTaskHoldOutcome, processingFailure, projectPreparationOutcome } from "../../../server/utils/taskPreparationOutcome";

describe("the site's stopped attempt", () => {
  it("gives Blueprint the processing repair without telling the site to confirm or reupload", () => {
    render(<TaskOutcomeNotice outcome={processingFailure({label: "Reconstruction status", digest: `sha256:${"a".repeat(64)}`})} />);
    expect(screen.getByRole("region", {name: "Where your job stands"})).toBeInTheDocument();
    // Blueprint's own step needs no label: it says "Nothing is needed from you." itself.
    expect(screen.queryByText(/Next step|Next:/)).not.toBeInTheDocument();
    expect(screen.getByText("Nothing is needed from you. Your video is saved; you don't need to send it again.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Digests and references are the admin console's, never the site's.
    expect(screen.queryByText("Evidence references")).not.toBeInTheDocument();
    expect(screen.queryByText(/sha256:/)).not.toBeInTheDocument();
  });
  it.each(["robot_carry_path_rejected", "task_evidence_incomplete"] as const)("makes %s readable with its limits", reason => {
    const outcome = projectPreparationOutcome(reason === "robot_carry_path_rejected"
      ? {reason, category: "robot_incompatibility", basis: "conservative_configuration_check", robot_id: "franka_panda", evidence_digest: `sha256:${"b".repeat(64)}`}
      : {reason, category: "insufficient_evidence", basis: "missing_evidence", robot_id: null, evidence_digest: `sha256:${"b".repeat(64)}`});
    render(<TaskOutcomeNotice outcome={outcome} />);
    expect(screen.getByRole("heading", {name: outcome.title})).toBeInTheDocument();
    // Only an estimate keeps its caveat; an outcome with no scope shows no empty line.
    if (reason === "robot_carry_path_rejected") expect(screen.getByText(outcome.scope)).toBeInTheDocument();
    else expect(outcome.scope).toBe("");
    expect(screen.getByRole("region").querySelectorAll("p")).toHaveLength(outcome.scope ? 3 : 2);
  });
  it("shows an early hold with no next-step owner, since no step is scheduled", () => {
    render(<TaskOutcomeNotice outcome={earlyTaskHoldOutcome("website_native_task_profile_preparation_required", `sha256:${"c".repeat(64)}`)} />);
    expect(screen.getByRole("heading", {name: "The simulation is held: we can't simulate this kind of job yet."})).toBeInTheDocument();
    expect(screen.queryByText(/Next step|Next:/)).not.toBeInTheDocument();
    expect(screen.getByText("Nothing is needed from you. Your video is saved; you don't need to send it again.")).toBeInTheDocument();
  });
  it("labels the site's own next step, and only that one", () => {
    render(<TaskOutcomeNotice outcome={{ category: "insufficient_evidence", basis: "missing_evidence", title: "Tell us the job in one sentence",
      reason: "We need one sentence.", scope: "", nextStep: "Write it in the box on your job page.", actionOwner: "site", evidence: [] }} />);
    expect(screen.getByText("Next:")).toBeInTheDocument();
    expect(screen.getByText(/Write it in the box on your job page\./)).toBeInTheDocument();
  });
});
