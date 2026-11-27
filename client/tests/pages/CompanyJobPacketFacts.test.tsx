import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyJobPage } from "@/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "@/lib/companyResponses";
import { PACKET_FACTS_PENDING, SIMULATION_WITHOUT_OBJECT } from "@/lib/companyJobPage";

/**
 * Round 2 (2026-11-24): the facts about the job's object are shown only once the model pass over them has succeeded,
 * and the page says so while it has not; a package the Pipeline built without the job's object says that it is the
 * site's room only, and the two tested answers stay.
 */
const auth = vi.hoisted(() => ({ loading: false, currentUser: { uid: "u1", email: "team@example.test" } as null | { uid: string; email: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
vi.mock("wouter", () => ({ useParams: () => ({ jobId: "job-1" }) }));

const { default: CompanyJob } = await import("@/pages/CompanyJob");

const item = (change: Partial<CompanyJobPage> = {}): CompanyJobPage => ({
  schemaVersion: "company_job_page.v1", id: "job-1", title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
  headline: "Stack cartons on pallets", headlineFacts: [], fitSummary: [], simulationStatus: null,
  visitMustConfirm: [], aboutSite: [],
  publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack cartons onto the pallet.", jobFacts: [], country: "United States",
  video: { state: "preparing" }, simulation: { state: "not_finished" },
  simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?expires=1&signature=a" },
  myAnswer: null, packetFacts: null, notShown: [],
  responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT }, ...change } as CompanyJobPage);
const fetchMock = vi.fn();
const show = (page: CompanyJobPage) => fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ item: page }) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("the facts about the object", () => {
  it("say they are being checked while the model pass has not read them", async () => {
    show(item({ packetFactsPending: true }));
    render(<CompanyJob />);
    expect(await screen.findByText(PACKET_FACTS_PENDING)).toBeInTheDocument();
    expect(screen.queryByText("Nothing about the object is measured or estimated yet.")).not.toBeInTheDocument();
  });

  it("leave their box out when the Pipeline has none (owner, 2026-11-25: a box that only says it is empty)", async () => {
    show(item());
    render(<CompanyJob />);
    await screen.findByText("Stack cartons on pallets");
    expect(screen.queryByRole("region", { name: "The object and how sure we are" })).toBeNull();
  });
});

describe("a simulation without the job's object", () => {
  // Owner, 2026-11-25: what the download holds, and no invitation to test it and say so in the answer (no tested answers).
  it("is said beside the download, with nothing asking what the company tested", async () => {
    show(item({ simulationDownload: { state: "ready", url: "/api/company-media/jobs/job-1/simulation.zip?expires=1&signature=a", objectIncluded: false } }));
    render(<CompanyJob />);
    expect(await screen.findByRole("note")).toHaveTextContent(/^This simulation is the site's room\. Nothing in it is set up as a separate object a robot can move\.$/);
    expect(screen.getByText(SIMULATION_WITHOUT_OBJECT)).toBeInTheDocument();
    expect(screen.queryByText(/what you tested|stand-in/)).toBeNull();
    expect(screen.queryByLabelText("Tested it: can do")).toBeNull();
    expect(screen.queryByLabelText("Tested it: cannot yet")).toBeNull();
  });

  it("is not said for a package with the object", async () => {
    show(item());
    render(<CompanyJob />);
    await screen.findByText("Stack cartons on pallets");
    expect(screen.queryByText(SIMULATION_WITHOUT_OBJECT)).not.toBeInTheDocument();
  });
});
