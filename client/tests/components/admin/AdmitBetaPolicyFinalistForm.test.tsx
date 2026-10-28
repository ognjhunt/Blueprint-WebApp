// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: any) => ({ ...headers, "X-CSRF-Token": "csrf" }) }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: any) => ({ ...headers, Authorization: "Bearer owner" }) }));
import { AdmitBetaPolicyFinalistForm } from "@/components/admin/AdmitBetaPolicyFinalistForm";
const finalist = { candidateId: "local-policy-one", planDigest: `sha256:${"a".repeat(64)}`, episodes: 200 as const,
  approvalPending: true, approvalCapUsd: 20, minimumCapUsd: 10.5, approvalTtlMs: 3_600_000 };
afterEach(() => vi.unstubAllGlobals());
it("approves the prepared exact finalist through the existing owner route with a bounded Blueprint cap", async () => {
  const network = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runId: "finalist-one", created: true }) });
  vi.stubGlobal("fetch", network);
  const onAdmitted = vi.fn();
  render(<AdmitBetaPolicyFinalistForm jobId="same-job" runId="finalist-one" finalist={finalist}
    currentUser={{ uid: "founder" } as any} onAdmitted={onAdmitted} />);
  expect(screen.getByLabelText("Blueprint compute cap (USD)")).toHaveValue(10.5);
  fireEvent.click(screen.getByRole("button", { name: "Approve full scoring" }));
  await waitFor(() => expect(network).toHaveBeenCalledTimes(1));
  const [path, options] = network.mock.calls[0];
  expect(path).toBe("/api/admin/free-evaluations/same-job/admit");
  expect(JSON.parse(options.body)).toMatchObject({ finalistId: "finalist-one", planDigest: finalist.planDigest,
    episodes: 200, sponsorCapUsd: 10.5, maxAttempts: 1, evidenceScope: "development_only" });
  expect(options.headers).toMatchObject({ Authorization: "Bearer owner", "X-CSRF-Token": "csrf" });
  await screen.findByRole("status"); expect(onAdmitted).toHaveBeenCalledTimes(1);
});
it("requires authenticated authority before submitting a prepared run", () => {
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  render(<AdmitBetaPolicyFinalistForm jobId="same-job" runId="finalist-one" finalist={finalist}
    currentUser={null} onAdmitted={() => {}} />);
  expect(screen.getByRole("button", { name: "Approve full scoring" })).toBeDisabled();
  expect(network).not.toHaveBeenCalled();
});
