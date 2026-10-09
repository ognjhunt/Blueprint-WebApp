import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  token: "claim-token-123",
  auth: { currentUser: null as any },
  create: vi.fn(),
  signIn: vi.fn(),
  google: vi.fn(),
  sendVerification: vi.fn(),
  authChanged: null as null | ((user: any) => void),
  workspaceRequest: vi.fn(),
}));

vi.mock("wouter", () => ({ useParams: () => ({ token: mocks.token }) }));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth, signInWithGoogle: mocks.google }));
vi.mock("firebase/auth", () => ({
  getAuth: () => mocks.auth,
  createUserWithEmailAndPassword: mocks.create,
  signInWithEmailAndPassword: mocks.signIn,
  sendEmailVerification: mocks.sendVerification,
  onAuthStateChanged: (_auth: unknown, callback: (user: any) => void) => {
    mocks.authChanged = callback;
    callback(mocks.auth.currentUser);
    return () => { mocks.authChanged = null; };
  },
}));
vi.mock("@/lib/workspace", () => ({
  WorkspaceRequestError: class WorkspaceRequestError extends Error {
    constructor(message: string, public status: number, public code?: string) {
      super(message);
    }
  },
  workspaceRequest: mocks.workspaceRequest,
}));
vi.mock("@/components/auth/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

import { ClaimSite } from "@/pages/ClaimSite";

const summary = {
  ok: true,
  requestId: "request-1",
  alreadyClaimed: false,
  claimEmail: "operator@example.com",
  siteTermsAcceptedCurrent: false,
  site: {
    siteName: "Packing line",
    siteLocation: "Austin",
    taskStatement: "pack cartons",
    qualificationState: "submitted",
  },
};

function claimResponse(value = summary) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => value,
  }));
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    email: "operator@example.com",
    emailVerified: true,
    reload: vi.fn(),
    getIdToken: vi.fn(),
    ...overrides,
  };
}

describe("ClaimSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.token = "claim-token-123";
    mocks.auth.currentUser = null;
    mocks.authChanged = null;
    mocks.workspaceRequest.mockResolvedValue({ ok: true });
  });

  it("uses neutral task progress copy and links an already claimed site to the workspace", async () => {
    claimResponse({ ...summary, alreadyClaimed: true });
    render(<ClaimSite />);

    expect(await screen.findByRole("heading", { name: /already in a workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/job, progress, and available results/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open your workspace/i })).toHaveAttribute("href", "/app");
    expect(screen.queryByText(/robot teams can now evaluate/i)).not.toBeInTheDocument();
  });

  it("does not describe a network failure as an expired claim", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<ClaimSite />);

    expect(await screen.findByRole("heading", { name: /couldn’t check this link/i })).toBeInTheDocument();
    expect(screen.queryByText(/link has expired/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("lets a matching verified signed-in user attach without a password", async () => {
    claimResponse();
    mocks.auth.currentUser = user();
    render(<ClaimSite />);

    await screen.findByRole("heading", { name: /keep track of packing line/i });
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));

    await screen.findByRole("heading", { name: /this site is yours/i });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.workspaceRequest).toHaveBeenCalledWith(
      mocks.auth.currentUser,
      "/claim",
      "POST",
      { token: "claim-token-123", acceptedTerms: true },
    );
  });

  it("restores passwordless attach when a matching verified session hydrates late", async () => {
    claimResponse();
    render(<ClaimSite />);

    await screen.findByRole("heading", { name: /keep track of packing line/i });
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    const restored = user();
    mocks.auth.currentUser = restored;
    fireEvent.click(screen.getByRole("checkbox"));
    act(() => mocks.authChanged?.(restored));

    await waitFor(() => expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument());
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));

    await screen.findByRole("heading", { name: /this site is yours/i });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.workspaceRequest).toHaveBeenCalledWith(
      restored,
      "/claim",
      "POST",
      { token: "claim-token-123", acceptedTerms: true },
    );
  });

  it("verifies a new account before attach and refreshes its token on explicit retry", async () => {
    claimResponse();
    const created = user({ emailVerified: false });
    mocks.create.mockResolvedValue({ user: created });
    render(<ClaimSite />);

    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));

    await screen.findByRole("heading", { name: /check your inbox/i });
    expect(mocks.sendVerification).toHaveBeenCalledWith(
      created,
      expect.objectContaining({ url: expect.stringContaining("claim-token-123") }),
    );
    // The workspace and the accepted terms are recorded before the email goes
    // out, so the verification link can finish the claim with nothing to ask.
    expect(mocks.workspaceRequest).toHaveBeenCalledTimes(1);
    expect(mocks.workspaceRequest).toHaveBeenCalledWith(created, "/setup", "POST", expect.objectContaining({
      workspaceType: "site_operator", acceptedTerms: true,
    }));
    expect(mocks.workspaceRequest.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.sendVerification.mock.invocationCallOrder[0]);

    created.emailVerified = true;
    fireEvent.click(screen.getByRole("button", { name: /i’ve verified/i }));
    await screen.findByRole("heading", { name: /this site is yours/i });
    expect(created.reload).toHaveBeenCalledOnce();
    expect(created.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.workspaceRequest).toHaveBeenCalled();
  });

  it("still sends the verification email when recording the workspace is refused", async () => {
    claimResponse();
    const created = user({ emailVerified: false });
    mocks.create.mockResolvedValue({ user: created });
    mocks.workspaceRequest.mockRejectedValueOnce(new Error("refused"));
    render(<ClaimSite />);

    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));

    await screen.findByRole("heading", { name: /check your inbox/i });
    expect(mocks.sendVerification).toHaveBeenCalledTimes(1);
  });

  it("resends verification only after the explicit resend action", async () => {
    claimResponse();
    const existing = user({ emailVerified: false });
    mocks.auth.currentUser = existing;
    render(<ClaimSite />);

    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
    await screen.findByRole("heading", { name: /check your inbox/i });
    expect(mocks.sendVerification).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    await waitFor(() => expect(mocks.sendVerification).toHaveBeenCalledTimes(2));
  });

  it("finishes the claim on its own when the verification link returns the verified owner", async () => {
    window.history.replaceState({}, "", "/claim/claim-token-123?auto=1");
    try {
      claimResponse();
      mocks.auth.currentUser = user();
      render(<ClaimSite />);

      await screen.findByRole("heading", { name: /this site is yours/i });
      expect(mocks.workspaceRequest).toHaveBeenCalledWith(
        mocks.auth.currentUser, "/claim", "POST", { token: "claim-token-123", acceptedTerms: false },
      );
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("reuses current site intake terms for the verified matching account without a repeat checkbox", async () => {
    claimResponse({ ...summary, siteTermsAcceptedCurrent: true });
    mocks.auth.currentUser = user();
    render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
    await screen.findByRole("heading", { name: /this site is yours/i });
    expect(mocks.workspaceRequest).toHaveBeenCalledWith(
      mocks.auth.currentUser, "/claim", "POST",
      { token: "claim-token-123", acceptedTerms: false },
    );
  });

  it("reuses the submitted terms while the account still verifies its email", async () => {
    claimResponse({ ...summary, siteTermsAcceptedCurrent: true });
    mocks.auth.currentUser = user({ emailVerified: false });
    render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("uses an existing current-version workspace acceptance when the site intake lacks one", async () => {
    claimResponse();
    mocks.auth.currentUser = user();
    mocks.workspaceRequest.mockImplementation(async (_user, path) =>
      path === "/setup" ? { termsRequired: false } : { ok: true });
    render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
    await screen.findByRole("heading", { name: /this site is yours/i });
    expect(mocks.workspaceRequest).toHaveBeenCalledWith(
      mocks.auth.currentUser, "/claim", "POST",
      { token: "claim-token-123", acceptedTerms: false },
    );
  });

  it("does not claim on its own for an unverified or different account", async () => {
    window.history.replaceState({}, "", "/claim/claim-token-123?auto=1");
    try {
      claimResponse();
      mocks.auth.currentUser = user({ emailVerified: false });
      render(<ClaimSite />);
      await screen.findByRole("heading", { name: /keep track of packing line/i });
      await act(async () => undefined);
      expect(mocks.workspaceRequest).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("hides the previous site's form immediately while another claim link loads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => summary })
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "private-password" } });
    fireEvent.click(screen.getByRole("checkbox"));

    mocks.token = "second-claim-token";
    view.rerender(<ClaimSite />);

    expect(screen.queryByRole("form", { name: /claim this site/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/packing line/i)).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(mocks.workspaceRequest).not.toHaveBeenCalled();
  });

  it("does not carry passwords or checked consent to another site's claim", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => summary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...summary,
        requestId: "request-2", claimEmail: "other@example.com",
        site: { ...summary.site, siteName: "Second site" },
      }) }));
    const view = render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "private-password" } });
    fireEvent.click(screen.getByRole("checkbox"));

    mocks.token = "second-claim-token";
    view.rerender(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of second site/i });
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("textbox", { name: /work email/i })).toHaveValue("other@example.com");
  });

  it("ignores a late retry from the previous claim after navigating to another link", async () => {
    let resolveRetry!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...summary,
        requestId: "request-2", site: { ...summary.site, siteName: "Second site" },
      }) }));
    const view = render(<ClaimSite />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    mocks.token = "second-claim-token";
    view.rerender(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of second site/i });
    await act(async () => resolveRetry({ ok: true, json: async () => summary }));
    expect(screen.getByRole("heading", { name: /keep track of second site/i })).toBeInTheDocument();
    expect(screen.queryByText(/packing line/i)).not.toBeInTheDocument();
  });


  it("keeps the new claim visible when sign-in for the previous link finishes late", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => summary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...summary,
        requestId: "request-2", site: { ...summary.site, siteName: "Second site" },
      }) }));
    let finishSignIn!: (value: unknown) => void;
    mocks.signIn.mockImplementationOnce(() => new Promise(resolve => { finishSignIn = resolve; }));
    const view = render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.click(screen.getByRole("link", { name: /sign in instead/i }));
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "private-password" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
    mocks.token = "second-claim-token";
    view.rerender(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of second site/i });
    await act(async () => finishSignIn({ user: user() }));
    expect(screen.getByRole("heading", { name: /keep track of second site/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /this site is yours/i })).not.toBeInTheDocument();
    expect(mocks.workspaceRequest).not.toHaveBeenCalledWith(expect.anything(), "/claim", "POST", expect.objectContaining({ token: "second-claim-token" }));
  });

  it("does not show an old verification completion under the next claim link", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => summary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...summary,
        requestId: "request-2", site: { ...summary.site, siteName: "Second site" },
      }) }));
    let finishReload!: () => void;
    const existing = user({ emailVerified: false, reload: vi.fn(() => new Promise<void>(resolve => { finishReload = resolve; })) });
    mocks.auth.currentUser = existing;
    const view = render(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of packing line/i });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
    fireEvent.click(await screen.findByRole("button", { name: /i’ve verified/i }));
    mocks.token = "second-claim-token";
    view.rerender(<ClaimSite />);
    await screen.findByRole("heading", { name: /keep track of second site/i });
    existing.emailVerified = true;
    await act(async () => finishReload());
    expect(screen.getByRole("heading", { name: /keep track of second site/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /this site is yours/i })).not.toBeInTheDocument();
    expect(mocks.workspaceRequest).not.toHaveBeenCalledWith(expect.anything(), "/claim", "POST", expect.objectContaining({ token: "second-claim-token" }));
  });

it("sets up a password account from submitted details and the signed job token", async () => {
  claimResponse({ ...summary, siteTermsAcceptedCurrent: true, accountDefaults: { name: "Alex Owner", organization: "Actual Company" } } as any);
  const created = user({ emailVerified: false }); mocks.create.mockResolvedValue({ user: created });
  render(<ClaimSite />); await screen.findByRole("heading", { name: /keep track of packing line/i });
  expect(screen.getByRole("textbox", { name: /work email/i })).toHaveAttribute("readonly");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
  fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
  await screen.findByRole("heading", { name: /check your inbox/i });
  expect(mocks.workspaceRequest).toHaveBeenCalledWith(created, "/setup", "POST", { name: "Alex Owner", organization: "Actual Company", workspaceType: "site_operator", acceptedTerms: true, siteClaimToken: "claim-token-123" });
});
it("attaches Google sign-in to the submitted job without repeated intake or verification", async () => {
  claimResponse({ ...summary, siteTermsAcceptedCurrent: true });
  const signedIn = user(); mocks.google.mockResolvedValue(signedIn);
  render(<ClaimSite />); fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
  await screen.findByRole("heading", { name: /this site is yours/i });
  expect(mocks.workspaceRequest).toHaveBeenCalledWith(signedIn, "/claim", "POST", { token: "claim-token-123", acceptedTerms: false });
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.sendVerification).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Open your job" })).toHaveAttribute("href", "/app/tasks/request-1");
});
it("refuses a Google account whose email differs from the submitted job", async () => {
  claimResponse({ ...summary, siteTermsAcceptedCurrent: true }); mocks.google.mockResolvedValue(user({ email: "other@example.com" }));
  render(<ClaimSite />); fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
  await screen.findByText(/Use the Google account for the email you submitted/i);
  expect(mocks.workspaceRequest).not.toHaveBeenCalled();
});
it("retries attachment with the account already created instead of creating a second identity", async () => {
  claimResponse({ ...summary, siteTermsAcceptedCurrent: true });
  const created = user(); mocks.create.mockResolvedValue({ user: created });
  mocks.workspaceRequest.mockRejectedValueOnce(new Error("Temporarily unavailable"));
  render(<ClaimSite />); await screen.findByRole("heading", { name: /keep track of packing line/i });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
  fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
  await screen.findByText("Temporarily unavailable");
  fireEvent.submit(screen.getByRole("form", { name: /claim this site/i }));
  await screen.findByRole("heading", { name: /this site is yours/i }); expect(mocks.create).toHaveBeenCalledTimes(1);
});

});
