// @vitest-environment jsdom
/**
 * Robot fit for staff: what the job needs, every form's rating, exactly what
 * the site would see, sharing, and the researched-team ranking with each
 * reason's quote. Loaded only when opened; actions apply what they return at
 * once, so a failed refresh never hides a run; a failed run keeps the last
 * good ranking on screen.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

import { RobotFitConsole } from "@/components/admin/RobotFitConsole";
import { SITE_ROBOT_FIT_NOTE, type AdminRobotFitResponse, type RobotFitRanking } from "@/data/robotFit";

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const RANKING: RobotFitRanking = {
  rankedAtIso: "2026-10-20T12:00:00.000Z", rankedBy: "admin-1", inputsDigest: "sha256:x", candidateCount: 106,
  droppedReasons: 1, droppedTeams: 0, provider: "openai_responses", model: "test-model",
  teams: [{ teamId: "humanoid-co", name: "Humanoid Co", status: "prospect", agreed: false, fit: "strong", form: "wheeled_humanoid",
    concerns: ["Region not stated."], reasons: [{ claim: "Moves totes between stations", quote: "wheeled humanoid moving totes between stations" }] }],
};

function response(overrides: Partial<AdminRobotFitResponse> = {}): AdminRobotFitResponse {
  return {
    job: { rated: true, notRatedReason: null, summary: "Move sealed cartons onto a pallet",
      instruction: "Pick up the carton and place it on the pallet.",
      requirements: [{ key: "pick_to_place_span", label: "How far the object moves", display: "300 cm", source: "site_measured" }],
      needs: ["It has to pick the object up and put it down at another spot.",
        "It has to move between the spots: the object moves 300 cm (you measured this)."],
      unknowns: [{ key: "object_mass", label: "How heavy the object is", resolve: "measurements" },
        { key: "people_nearby", label: "Whether people work near the job", resolve: "staff" }],
      forms: [
        { id: "fixed_base_arm", verdict: "not_a_fit", checks: [{ requirement: "pick_to_place_span", outcome: "fail",
          text: "It stays in one place, and the object moves 300 cm (you measured this), too far to reach both spots." }] },
        { id: "humanoid", verdict: "fits", checks: [{ requirement: "pick_to_place_span", outcome: "pass",
          text: "It can move between the spots: the object moves 300 cm (you measured this)." }] },
      ] },
    ranking: null,
    lastAttempt: null,
    sharing: null,
    site: { needs: ["It has to pick the object up and put it down at another spot."], forms: [], unknowns: [], note: SITE_ROBOT_FIT_NOTE },
    consentRevoked: false,
    ...overrides,
  };
}

async function open() {
  const { container } = render(<RobotFitConsole requestId="job-1" currentUser={null} />);
  const details = container.querySelector("details")!;
  await act(async () => {
    details.open = true;
    fireEvent(details, new Event("toggle"));
  });
  return container;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("RobotFitConsole", () => {
  it("loads nothing until opened, then shows the needs, every form's rating and the site preview", async () => {
    fetchMock.mockResolvedValueOnce(json(response()));
    const { container } = render(<RobotFitConsole requestId="job-1" currentUser={null} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const details = container.querySelector("details")!;
    await act(async () => {
      details.open = true;
      fireEvent(details, new Event("toggle"));
    });
    expect(await screen.findByText("From the video: Pick up the carton and place it on the pallet.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/jobs/job-1/robot-fit");
    const forms = screen.getByRole("region", { name: "Robot forms" });
    expect(within(forms).getByText("Walking humanoid")).toBeInTheDocument();
    expect(within(forms).getByText("Not a fit")).toBeInTheDocument();
    expect(screen.getByText("It has to move between the spots: the object moves 300 cm (you measured this).")).toBeInTheDocument();
    expect(screen.getByText(/whether people work near the job \(ask the site\)/)).toBeInTheDocument();
    expect(screen.getByText("Not shared. The owner's job page shows nothing about robot fit.")).toBeInTheDocument();
    expect(screen.getByText("Not ranked yet.")).toBeInTheDocument();
  });

  it("offers a retry after a failed load", async () => {
    // jsdom also fires a toggle for `open = true`; reopening after a failure retries, so every read fails until the retry.
    fetchMock.mockResolvedValue(json({ error: "Robot fit is unavailable. Try again." }, 503));
    await open();
    expect(await screen.findByText("Robot fit is unavailable. Try again.")).toBeInTheDocument();
    fetchMock.mockResolvedValue(json(response()));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Robot forms" })).toBeInTheDocument();
  });

  it("shares the site version", async () => {
    fetchMock.mockResolvedValueOnce(json(response()));
    await open();
    const sharing = { shared: true, changedAtIso: "2026-10-20T12:00:00.000Z", changedBy: "admin-1" };
    fetchMock.mockResolvedValueOnce(json({ sharing }));
    fetchMock.mockResolvedValueOnce(json(response({ sharing })));
    fireEvent.click(await screen.findByRole("button", { name: "Share with the site" }));
    expect(await screen.findByRole("button", { name: "Stop sharing" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/admin/jobs/job-1/robot-fit/sharing");
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer token", "X-CSRF-Token": "csrf" } });
    expect(JSON.parse(init.body)).toEqual({ shared: true });
  });

  it("shows a ranking the moment it returns, even when the refresh after it fails", async () => {
    fetchMock.mockResolvedValueOnce(json(response()));
    await open();
    fetchMock.mockResolvedValueOnce(json({ ranking: RANKING, attempt: { state: "ranked", atIso: RANKING.rankedAtIso, by: "admin-1", error: null } }));
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(await screen.findByRole("button", { name: "Rank researched teams" }));
    expect(await screen.findByText("Humanoid Co")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/jobs/job-1/robot-fit/ranking");
    expect(screen.getByText("“wheeled humanoid moving totes between stations”")).toBeInTheDocument();
    expect(screen.getByText("Moves totes between stations")).toBeInTheDocument();
    expect(screen.getByText("Prospect, nothing agreed")).toBeInTheDocument();
    expect(screen.getByText("Wheeled humanoid")).toBeInTheDocument();
    expect(screen.getByText(/106 research notes read/)).toHaveTextContent("dropped 1 unquoted reasons and 0 entries");
    expect(screen.getByRole("button", { name: "Rank again" })).toBeInTheDocument();
  });

  it("keeps the last good ranking on screen when the latest run failed", async () => {
    fetchMock.mockResolvedValueOnce(json(response({ ranking: { ...RANKING, stale: false },
      lastAttempt: { state: "failed", atIso: "2026-10-20T13:00:00.000Z", by: "admin-1", error: "provider_timeout (openai_responses)" } })));
    await open();
    expect(await screen.findByText(/failed: provider_timeout \(openai_responses\)\. The ranking below is the last one that completed\./))
      .toBeInTheDocument();
    expect(screen.getByText("Humanoid Co")).toBeInTheDocument();
  });

  it("warns about a stale ranking and shows the server's refusal", async () => {
    fetchMock.mockResolvedValueOnce(json(response({ ranking: { ...RANKING, stale: true } })));
    await open();
    expect(await screen.findByText(/changed since this ranking/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(json({ code: "job_details_missing", error: "This job has no description yet." }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Rank again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This job has no description yet.");
  });

  it("offers no ranking or sharing once consent is withdrawn", async () => {
    fetchMock.mockResolvedValueOnce(json(response({ consentRevoked: true })));
    await open();
    expect(await screen.findByText(/Recording consent was withdrawn/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rank researched teams" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Share with the site" })).toBeDisabled();
  });

  it("says when a job is not rated", async () => {
    fetchMock.mockResolvedValueOnce(json(response({ job: { ...response().job, rated: false, forms: [], needs: [], requirements: [],
      unknowns: [], notRatedReason: "This job's task has not been screened yet. Robot forms are rated once its brief is confirmed." },
    site: null })));
    await open();
    expect(await screen.findByText(/Robot forms are not rated for this job\. This job's task has not been screened yet/)).toBeInTheDocument();
    expect(screen.getByText("Nothing to show the site for this job.")).toBeInTheDocument();
  });
});
