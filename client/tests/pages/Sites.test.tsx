import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sites from "@/pages/Sites";
import SiteDetail from "@/pages/SiteDetail";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sites", () => {
  it("renders the captured-site library with the expected filters and CTAs", () => {
    render(<Sites />);

    expect(
      screen.getByRole("heading", {
        name: /Browse captured sites for robot evaluation\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search sites, tasks, locations, or use cases/i),
    ).toBeInTheDocument();

    for (const label of ["Site type", "Task pack", "Readiness", "Access", "Region"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    const harborviewCard = screen
      .getByRole("heading", { name: /Harborview Grocery Distribution Annex/i })
      .closest("article");
    expect(harborviewCard).not.toBeNull();
    expect(within(harborviewCard as HTMLElement).getByText(/500 ready/i)).toBeInTheDocument();
    expect(within(harborviewCard as HTMLElement).getByRole("link", { name: /View site/i })).toHaveAttribute(
      "href",
      "/sites/sw-chi-01",
    );
    expect(
      within(harborviewCard as HTMLElement).getByText(/Materialization/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/Site, task, scenario, eval, and threshold manifests attached/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/CPU setup manifests present/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByText(/Awaiting policy\/container\/trace\/demo\/plugin evidence/i),
    ).toBeInTheDocument();
    expect(
      within(harborviewCard as HTMLElement).getByRole("button", {
        name: /Create eval job request/i,
      }),
    ).toBeInTheDocument();
  });

  it("posts a durable robot_eval_job_request when a robot team starts from a site card", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "queued_for_pipeline",
        jobRequest: {
          schema_version: "robot_eval_job_request.v1",
          job_id: "robot-eval-sw-chi-01-place-return-in-bin-fixture",
        },
      }),
    } as Response);

    render(<Sites />);

    const harborviewCard = screen
      .getByRole("heading", { name: /Harborview Grocery Distribution Annex/i })
      .closest("article");
    expect(harborviewCard).not.toBeNull();

    fireEvent.click(
      within(harborviewCard as HTMLElement).getByRole("button", {
        name: /Create eval job request/i,
      }),
    );
    fireEvent.change(within(harborviewCard as HTMLElement).getByLabelText(/Endpoint URL/i), {
      target: { value: "https://policies.robotteam.dev/v1/action" },
    });
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Auth handling/i),
      {
        target: { value: "Bearer token in redacted robot-team secret ref" },
      },
    );
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Observation schema/i),
      {
        target: { value: "gs://robot-team/schemas/observation.v1.json" },
      },
    );
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Action schema/i),
      {
        target: { value: "gs://robot-team/schemas/action.v1.json" },
      },
    );
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Rate-limit/i),
      {
        target: { value: "200 ms p95, 10 rps" },
      },
    );
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Callback \/ log URI/i),
      {
        target: { value: "gs://robot-team/blueprint/callbacks/" },
      },
    );
    fireEvent.change(
      within(harborviewCard as HTMLElement).getByLabelText(/Owner contact/i),
      {
        target: { value: "robot-owner@robotteam.dev" },
      },
    );

    fireEvent.click(
      within(harborviewCard as HTMLElement).getByRole("button", {
        name: /Create eval job request/i,
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/robot-eval/job-requests",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body || "{}"));
    expect(body.schema_version).toBe("robot_eval_job_request.v1");
    expect(body.buyer_request_id).toBe(
      "buyer-request-sw-chi-01-place-return-in-bin-default-fixture-policy",
    );
    expect(body.site_package.site_slug).toBe("sw-chi-01");
    expect(body.site_package.site_submission_id).toBe("site-submission-sw-chi-01");
    expect(body.site_package.capture_job_id).toBe("capture-job-sw-chi-01");
    expect(body.site_package.capture_id).toBe("capture-sw-chi-01");
    expect(body.site_package.buyer_request_id).toBe(body.buyer_request_id);
    expect(body.site_package.pipeline_prefix).toBe(
      "/synced-artifacts/sites/sw-chi-01/pipeline",
    );
    expect(body.site_package.publication_ready_to_evaluate).toBe(true);
    expect(body.site_package.cpu_preflight_scorecard_uri).toContain(
      "/cpu_preflight_scorecard.json",
    );
    expect(body.site_package.episode_spec_manifest_uri).toContain(
      "/episode_spec_manifest.json",
    );
    expect(body.pipeline_trigger.cpu_pre_gpu_preflight).toEqual(
      expect.objectContaining({
        local_cpu_preflight_smoke_ran: false,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      }),
    );
    expect(body.requested_tasks[0]).toEqual(
      expect.objectContaining({
        task_id: "place_return_in_bin",
        scenario_ids: ["scenario_place_return_in_bin_mobile_manipulator_rgb_v1"],
      }),
    );
    expect(body.owner_system).toEqual(
      expect.objectContaining({
        buyer_request_id: body.buyer_request_id,
        site_submission_id: "site-submission-sw-chi-01",
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
      }),
    );
    expect(Object.keys(body.policy_package)).toEqual([
      "policy_api_endpoint",
    ]);
    expect(body.policy_package.policy_api_endpoint).toEqual(
      expect.objectContaining({
        endpoint_url: "https://policies.robotteam.dev/v1/action",
        observation_schema_ref: "gs://robot-team/schemas/observation.v1.json",
        action_schema_ref: "gs://robot-team/schemas/action.v1.json",
        owner_contact: "robot-owner@robotteam.dev",
      }),
    );
    expect(JSON.stringify(body.policy_package)).not.toMatch(/placeholder/i);
    expect(await screen.findByText(/robot-eval-sw-chi-01/i)).toBeInTheDocument();
  });

  it("filters by site type, task pack, readiness, access, region, and search", () => {
    render(<Sites />);

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "Hospital" } });
    expect(screen.getByText(/Piedmont Hospital Supply Hallway/i)).toBeInTheDocument();
    expect(screen.queryByText(/Harborview Grocery Distribution Annex/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Site type"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "Pick/place" } });
    expect(screen.getByText(/Triangle Robotics Lab/i)).toBeInTheDocument();
    expect(screen.queryByText(/Motor City Battery Staging Cell/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task pack"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Readiness"), { target: { value: "Capture complete" } });
    expect(screen.getByText(/Motor City Battery Staging Cell/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "Open sample" } });
    expect(screen.getByText(/No matching sites yet\./i)).toBeInTheDocument();
  });

  it("renders a compact site detail page for a legacy slug alias", () => {
    render(<SiteDetail params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(
      screen.getByRole("heading", { name: /Triangle Robotics Lab/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Open sample/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Available task packs/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Create eval job request/i })[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Materialization/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CPU setup manifests present/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Post-Training Data Package export awaits request approval/i).length).toBeGreaterThan(0);
  });
});
