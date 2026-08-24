import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SiteTaskIntake from "@/pages/SiteTaskIntake";
import { gateFields, specFields } from "@/data/siteTaskQualification";

function choose(question: string, value: string) {
  fireEvent.change(screen.getByLabelText(question), { target: { value } });
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Answer every gate with its first `clear` option. */
function answerGatesClear() {
  for (const field of gateFields) {
    const clear = field.options.find((option) => option.verdict === "clear");
    if (!clear) continue;
    choose(field.question, clear.value);
  }
}

describe("SiteTaskIntake", () => {
  it("asks for a site address and not a site name", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();
    expect(screen.getByLabelText("Site address")).toBeInTheDocument();
    expect(screen.queryByLabelText("Site name")).toBeNull();
    expect(screen.queryByLabelText("Site location")).toBeNull();
  });

  it("asks no account questions — no password, no terms gate", () => {
    // The flow this replaces made a site operator choose a password before they
    // could describe their cell. The account is worth nothing until there is a
    // match to give them access to.
    const { container } = render(<SiteTaskIntake />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    // No field asks for one. (The hero says "no password" on purpose, so this
    // asserts on controls rather than on copy.)
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByLabelText(/terms|accept/i)).toBeNull();
    expect(container.textContent).toMatch(/No account/i);
  });

  it("leads with the six screening questions", () => {
    render(<SiteTaskIntake />);
    for (const field of gateFields) {
      expect(screen.getByLabelText(field.question)).toBeInTheDocument();
    }
  });

  it("withholds the specification questions until the gates are answered", () => {
    render(<SiteTaskIntake />);

    // Nobody enumerates payload weights before learning they are out of area.
    for (const field of specFields) {
      expect(screen.queryByLabelText(field.question)).toBeNull();
    }

    answerGatesClear();

    for (const field of specFields) {
      expect(screen.getByLabelText(field.question)).toBeInTheDocument();
    }
  });

  it("keeps the specification questions hidden when a gate blocks", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();

    const serviceArea = gateFields[0];
    const blocking = serviceArea.options.find((option) => option.verdict === "blocking");
    choose(serviceArea.question, blocking!.value);

    for (const field of specFields) {
      expect(screen.queryByLabelText(field.question)).toBeNull();
    }
  });

  it("shows a blocked site which answer blocked it and what would flip it", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();

    const windowGate = gateFields.find((field) => field.id === "accessWindow")!;
    const blocking = windowGate.options.find((option) => option.verdict === "blocking")!;
    choose(windowGate.question, blocking.value);

    expect(screen.getAllByText(/Not yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(blocking.unblocks!.slice(0, 40), "i"))).toBeInTheDocument();
    // A rejection is still worth sending — that is how the next metro gets picked.
    expect(screen.getByText(/We keep tasks on file/i)).toBeInTheDocument();
  });

  it("routes a marginal answer to a call rather than to a yes or a no", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();

    const scene = gateFields.find((field) => field.id === "sceneStability")!;
    const marginal = scene.options.find((option) => option.verdict === "marginal")!;
    choose(scene.question, marginal.value);

    expect(screen.getAllByText(/Needs a short call/i).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(marginal.ambiguity!.slice(0, 35), "i"))).toBeInTheDocument();
  });

  it("promises a qualified site a match check rather than a visit", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();

    expect(screen.getAllByText(/Clears the screen/i).length).toBeGreaterThan(0);
    // /capture-visit leads with "we do not capture speculatively". This form
    // must not contradict it by implying a booking.
    expect(screen.getByText(/we do not capture speculatively/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /book a visit|pick a date|schedule your capture/i,
    );
  });

  it("states plainly that submitting triggers nothing", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();
    expect(
      screen.getByText(/Nothing is captured, scheduled, or shown to a robot team/i),
    ).toBeInTheDocument();
  });

  it("keeps submission disabled until the task is actually described", () => {
    render(<SiteTaskIntake />);
    answerGatesClear();

    const submit = screen.getByRole("button", { name: /Send the task/i });
    expect(submit).toBeDisabled();

    fill("Your name", "Sam Rivera");
    fill("Work email", "sam@example.com");
    fill("Company", "Example Logistics");
    expect(submit).toBeDisabled();

    // The address is the site's identity — an operator has to drive to it.
    fill("Site address", "500 E 5th St, Austin, TX");
    expect(submit).toBeDisabled();

    fill(/Describe the task as if explaining it/i, "Move totes from the conveyor to a pallet.");
    expect(submit).toBeEnabled();
  });
});
