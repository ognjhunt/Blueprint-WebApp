// @vitest-environment jsdom
/**
 * "What kind of robot fits this job" on the owner's job page: nothing until
 * Blueprint shares it, then what the job needs, every form of robot with its
 * verdict, what the site can still add and the fixed note. It has no team to
 * show and shows none, and it reads again when the measurements step saves.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteRobotFitSection } from "@/components/site/SiteRobotFitSection";
import { SITE_MEASUREMENTS_SAVED_EVENT, SITE_ROBOT_FIT_NOTE, type SiteRobotFit } from "@/data/robotFit";

const fetchMock = vi.fn();

const FIT: SiteRobotFit = {
  needs: ["It has to pick the object up and put it down at another spot.",
    "It can work from one place: the object moves 90 cm (you measured this)."],
  forms: [
    { id: "fixed_base_arm", label: "One arm on a fixed stand", description: "A single robot arm fixed in place at the work area.",
      verdict: "fits", reasons: [] },
    { id: "bimanual_arm", label: "Two arms on a fixed stand", description: "Two robot arms working together from one fixed spot.",
      verdict: "fits", reasons: [] },
    { id: "wheeled_humanoid", label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.",
      verdict: "fits", reasons: ["Driving between spots isn't needed: the object moves 90 cm (you measured this)."] },
    { id: "humanoid", label: "Walking humanoid", description: "A human-shaped robot with two arms that walks on two legs.",
      verdict: "fits", reasons: ["Walking between spots isn't needed: the object moves 90 cm (you measured this)."] },
  ],
  unknowns: ["How heavy the object is. You can add it under Add measurements (optional) on this page."],
  note: SITE_ROBOT_FIT_NOTE,
};

const respond = (robotFit: SiteRobotFit | null) => ({ ok: true, json: async () => ({ ok: true, robotFit }) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("SiteRobotFitSection", () => {
  it("renders nothing until robot fit is shared", async () => {
    fetchMock.mockResolvedValue(respond(null));
    const { container } = render(<SiteRobotFitSection token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/tok/robot-fit"));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the read fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { container } = render(<SiteRobotFitSection token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what the job needs, every form with its verdict and reasons, what is unknown, and the note", async () => {
    fetchMock.mockResolvedValue(respond(FIT));
    render(<SiteRobotFitSection token="tok" />);
    const section = await screen.findByRole("region", { name: "What kind of robot fits this job" });
    expect(screen.getByText(FIT.needs[1])).toBeInTheDocument();
    for (const form of FIT.forms) expect(screen.getByText(form.label)).toBeInTheDocument();
    expect(screen.getAllByText("Fits")).toHaveLength(4);
    expect(screen.getByText(FIT.forms[3].reasons[0])).toBeInTheDocument();
    expect(screen.getByText(FIT.unknowns[0])).toBeInTheDocument();
    expect(screen.getByText(SITE_ROBOT_FIT_NOTE)).toBeInTheDocument();
    expect(section.textContent).not.toMatch(/\bmatch/i);
  });

  it("reads again when the measurements step saves", async () => {
    fetchMock.mockResolvedValueOnce(respond(FIT));
    render(<SiteRobotFitSection token="tok" />);
    await screen.findByText(FIT.unknowns[0]);
    fetchMock.mockResolvedValueOnce(respond({ ...FIT, unknowns: [], needs: [...FIT.needs, "It has to lift 4 kg (you measured this)."] }));
    await act(async () => { window.dispatchEvent(new Event(SITE_MEASUREMENTS_SAVED_EVENT)); });
    expect(await screen.findByText("It has to lift 4 kg (you measured this).")).toBeInTheDocument();
    expect(screen.queryByText(FIT.unknowns[0])).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
