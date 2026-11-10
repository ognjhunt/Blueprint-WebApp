import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ManagedScreeningResults } from "../../src/components/shared/ManagedScreeningResults";
import { ScreeningPracticeRuns } from "../../src/components/shared/ScreeningPracticeRuns";
import type { JobManagedEvidenceSummary } from "../../src/types/jobMarketplace";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const id = (character: string) => character.repeat(64);
const candidate = { candidateId: "candidate-a", name: "Candidate A", state: "completed", planned: 3, scored: 2, succeeded: 1,
  failed: 1, void: 1, blockers: [], practiceRuns: [
    { number: 1, outcome: "success" as const, videos: [
      { videoId: id("a"), camera: "wrist", phase: "run" as const, durationSeconds: 62.4 },
      { videoId: id("b"), camera: "overview", phase: "run" as const, durationSeconds: null },
      { videoId: id("c"), camera: "external", phase: "setup_check" as const, durationSeconds: 0.25 }] },
    { number: 2, outcome: "failure" as const, videos: [{ videoId: id("d"), camera: "external", phase: "run" as const, durationSeconds: 9 }] },
    { number: 3, outcome: "void" as const, videos: [] }] };
const url = (videoId: string) => `/api/screening-practice-run-videos/job/run/candidate-a/${videoId}.mp4?expires=1&signature=${id("0")}`;

it("names each practice run by its outcome in plain words and asks for tickets only when one is opened", async () => {
  const loadUrls = vi.fn(async (_candidate: string, videoIds: string[]) => Object.fromEntries(videoIds.map(videoId => [videoId, url(videoId)])));
  const { container } = render(<ScreeningPracticeRuns candidate={candidate} loadUrls={loadUrls} />);
  expect(screen.getByRole("heading", { name: "Practice runs: Candidate A" })).toBeInTheDocument();
  expect(screen.getByText(/renders of that simulation, not footage of a real robot/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Practice run 1 · Succeeded" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Practice run 2 · Did not finish the task" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Practice run 3 · Could not be scored" })).toBeInTheDocument();
  expect(loadUrls).not.toHaveBeenCalled();
  expect(container.querySelector("video")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Practice run 1 · Succeeded" }));
  await waitFor(() => expect(container.querySelectorAll("video")).toHaveLength(3));
  expect(loadUrls).toHaveBeenCalledWith("candidate-a", [id("a"), id("b"), id("c")]);
  const videos = [...container.querySelectorAll("video")];
  // Overview first, then the wrist camera; the set-up check sits apart, below.
  expect(videos.map(video => video.getAttribute("aria-label"))).toEqual(["Overview, practice run 1", "Wrist camera, practice run 1",
    "Side view, practice run 1"]);
  expect(screen.getByText("Before the robot started")).toBeInTheDocument();
  expect(screen.getByText("Wrist camera · 1:02")).toBeInTheDocument();
  for (const video of videos) {
    expect(video).toHaveAttribute("controls");
    expect(video.getAttribute("controlsList")).toBe("nodownload noremoteplayback");
    expect(video).toHaveAttribute("disablepictureinpicture");
    expect(video.getAttribute("src")).toMatch(/^\/api\/screening-practice-run-videos\//);
  }
  expect(container.querySelector("a[download], a[href*='screening-practice-run-videos']")).toBeNull();

  // Closing drops the tickets; opening again asks for fresh ones.
  fireEvent.click(screen.getByRole("button", { name: "Practice run 1 · Succeeded" }));
  expect(container.querySelector("video")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Practice run 1 · Succeeded" }));
  await waitFor(() => expect(loadUrls).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole("button", { name: "Practice run 3 · Could not be scored" }));
  expect(screen.getByText("No video was kept of this practice run.")).toBeInTheDocument();
  expect(loadUrls).toHaveBeenCalledTimes(2);
});

it("says plainly when the videos could not be loaded", async () => {
  render(<ScreeningPracticeRuns candidate={candidate} loadUrls={vi.fn(async () => { throw new Error("refused"); })} />);
  fireEvent.click(screen.getByRole("button", { name: "Practice run 2 · Did not finish the task" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The videos could not be loaded. Close this practice run and open it again to retry.");
});

it("shows practice runs only where the owner can ask for view tickets", async () => {
  const evidence = [{ runId: "run", state: "completed", outcome: "estimate", current: true, resultDigest: null, summary: "Your simulation estimate is ready.",
    nextAction: "", limitations: [], href: "#run", screening: { candidates: [candidate] } }] as JobManagedEvidenceSummary[];
  const { rerender } = render(<ManagedScreeningResults evidence={evidence} />);
  expect(screen.queryByText("Practice runs: Candidate A")).toBeNull();
  const urls = vi.fn(async () => ({}));
  rerender(<ManagedScreeningResults evidence={evidence} practiceRunVideoUrls={urls} />);
  expect(screen.getByText("Practice runs: Candidate A")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Practice run 2 · Did not finish the task" }));
  expect(urls).toHaveBeenCalledWith("run", "candidate-a", [id("d")]);
  // A video the ticket answer leaves out is said to be unavailable, never linked.
  expect(await screen.findByText("This video is unavailable.")).toBeInTheDocument();
});

it("says a video that is no longer kept is gone, and a failed one can be retried", async () => {
  const probe = vi.fn(async (request: string) => new Response(null, { status: request.includes(id("a")) ? 410 : 503 }));
  vi.stubGlobal("fetch", probe);
  const loadUrls = vi.fn(async (_candidate: string, videoIds: string[]) => Object.fromEntries(videoIds.map(videoId => [videoId, url(videoId)])));
  const { container } = render(<ScreeningPracticeRuns candidate={candidate} loadUrls={loadUrls} />);
  fireEvent.click(screen.getByRole("button", { name: "Practice run 1 · Succeeded" }));
  await waitFor(() => expect(container.querySelectorAll("video")).toHaveLength(3));
  fireEvent.error(screen.getByLabelText("Wrist camera, practice run 1"));
  expect(await screen.findByText("This video is no longer kept.")).toBeInTheDocument();
  expect(probe).toHaveBeenCalledWith(url(id("a")), { headers: { Range: "bytes=0-0" } });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(container.querySelectorAll("video")).toHaveLength(2);
  fireEvent.error(screen.getByLabelText("Overview, practice run 1"));
  expect(await screen.findByRole("alert")).toHaveTextContent("The videos could not be loaded.");
});

it("puts each candidate's practice runs directly under that candidate's row", () => {
  const other = { ...candidate, candidateId: "candidate-b", name: "Candidate B", practiceRuns: [candidate.practiceRuns[1]] };
  const evidence = [{ runId: "run", state: "completed", outcome: "estimate", current: true, resultDigest: null, summary: "Your simulation estimate is ready.",
    nextAction: "", limitations: [], href: "#run", screening: { candidates: [candidate, other] } }] as JobManagedEvidenceSummary[];
  render(<ManagedScreeningResults evidence={evidence} practiceRunVideoUrls={vi.fn(async () => ({}))} />);
  const rows = within(screen.getByRole("table", { name: "Candidates evaluated for your job" })).getAllByRole("row").slice(1);
  expect(rows.map(value => value.querySelector("th[scope=row], h4")?.textContent)).toEqual([
    "Candidate A", "Practice runs: Candidate A", "Candidate B", "Practice runs: Candidate B"]);
  expect(within(rows[3]).getByRole("button", { name: "Practice run 2 · Did not finish the task" })).toBeInTheDocument();
  expect(within(rows[1]).queryByText("Candidate B")).toBeNull();
});

it("shows the newest evaluation and every earlier one with results, and folds the rest", () => {
  const scored = { candidateId: "scored", name: "Scored candidate", state: "completed", planned: 10, scored: 10, succeeded: 0,
    failed: 10, void: 0, blockers: [] };
  const waiting = { candidateId: "waiting", name: "Waiting candidate", state: "pending", planned: 10, scored: 0, succeeded: 0,
    failed: 0, void: 0, blockers: [] };
  const run = (runId: string, summary: string, candidates: object[], outcome: string | null = null) => ({ runId, state: "running", outcome,
    current: true, resultDigest: null, summary, nextAction: "", limitations: [], href: `#${runId}`, screening: { candidates } });
  // Newest first, as the server sends them.
  const evidence = [run("newest", "Simulation evaluation of your job: 0 of 1 candidates finished.", [waiting]),
    run("replaced-a", "Continued in a newer run.", [waiting], "superseded"),
    run("with-results", "Your simulation estimate is ready.", [scored], "estimate"),
    run("replaced-b", "Held: a problem on our side stopped the simulation.", [{ ...waiting, state: "blocked" }], "held_setup"),
  ] as JobManagedEvidenceSummary[];
  render(<ManagedScreeningResults evidence={evidence} />);
  const regions = screen.getAllByRole("region", { name: "Simulation results for your job" });
  expect(regions.map(region => region.querySelector("h3")?.textContent)).toEqual(["Simulation evaluation", "Your simulation estimate"]);
  expect(within(regions[0]).getByText(evidence[0].summary)).toBeVisible();
  expect(within(regions[0]).queryByText("From an earlier evaluation run of your job.")).toBeNull();
  expect(within(regions[1]).getByText("From an earlier evaluation run of your job.")).toBeVisible();
  expect(within(regions[1]).getByText("Scored candidate")).toBeVisible();
  const earlier = screen.getByText("Earlier evaluation runs (2)").closest("details")!;
  expect(earlier).not.toHaveAttribute("open");
  expect(within(earlier).getAllByRole("article", { hidden: true }).map(article => article.querySelector("p")?.textContent)).toEqual([
    "Continued in a newer run.", "Held: a problem on our side stopped the simulation."]);
});
