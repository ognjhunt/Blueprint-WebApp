import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import builtinReview from "../../../server/tests/fixtures/native-g1-private-review.v1.json";
import selectedReview from "../../../server/tests/fixtures/native-g1-team-private-review.v1.json";
import { nativeG1ReviewArtifacts, parseNativeG1PrivateReview } from "../../../server/utils/nativeG1PrivateReview";

const state = vi.hoisted(() => ({ runId: "", user: { uid: "owner-1" } }));
vi.mock("wouter", () => ({ useParams: () => ({ runId: state.runId }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: state.user, loading: false }) }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async () => ({ Authorization: "Bearer test" }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/helmet", () => ({ Helmet: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/blueprint/app/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import NativeG1PrivateReview from "@/pages/app/NativeG1PrivateReview";

let client: QueryClient | undefined;
afterEach(() => { client?.clear(); vi.unstubAllGlobals(); });

function show(review: typeof builtinReview | typeof selectedReview) {
  state.runId = "run_id" in review ? review.run_id : "builtin-review";
  const parsed = parseNativeG1PrivateReview(review);
  if (!parsed) throw new Error("fixture not verified");
  const artifacts = nativeG1ReviewArtifacts(parsed);
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith("/ticket") ? { download_url: `/api/native-g1-review-downloads/${state.runId}/${artifacts[1].artifact_id}?expires=123&signature=test` }
      : { schema_version: "native_g1_private_review_site_record.v1", run_id: state.runId, review, artifacts },
  ), { status: url.endsWith("/ticket") ? 201 : 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><NativeG1PrivateReview /></QueryClientProvider>);
  return fetcher;
}

describe("same private G1 page for built-in and selected policy evidence", () => {
  it("renders the selected failure, actual count, endpoint label and both camera controls", async () => {
    const fetcher = show(selectedReview);
    expect(await screen.findByText(/1 policy episode · HTTPS policy endpoint/)).toBeInTheDocument();
    expect(screen.getByText(/Outcome: failure · Policy queries: 2/)).toBeInTheDocument();
    expect(screen.getByText("G1 head camera")).toBeInTheDocument();
    expect(screen.getByText("Overview camera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download manifest" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Load video" })[0]);
    await waitFor(() => expect(document.querySelector("video")?.getAttribute("src"))
      .toContain(`/api/native-g1-review-downloads/${state.runId}/`));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/4 policy episodes/)).not.toBeInTheDocument();
  });

  it("keeps the built-in four-policy campaign on the same page", async () => {
    show(builtinReview);
    expect(await screen.findByText(/4 policy episodes · container runtime/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Load video" })).toHaveLength(8);
  });
});
