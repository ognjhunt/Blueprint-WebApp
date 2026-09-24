import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TaskFollowUp } from "@/components/site/TaskFollowUp";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
vi.mock("@/components/site/TaskItemsPanel", () => ({ TaskItemsPanel: () => <div>Item photo editor</div> }));

afterEach(() => vi.unstubAllGlobals());

describe("TaskFollowUp", () => {
  it("shows one question at a time and saves an owner answer", async () => {
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) =>
      Promise.resolve(options?.method === "POST"
        ? { ok: true, json: async () => ({ ok: true }) }
        : { ok: true, json: async () => ({ questions: [
          { id: "success_target", question: "What would a good result look like?", hint: "A target is fine." },
          { id: "item_weight", question: "How much do items weigh?", hint: "A range is fine." },
        ] }) }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<TaskFollowUp token="owner-token" />);

    expect(await screen.findByRole("heading", { name: "What would a good result look like?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "How much do items weigh?" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "40 items per hour" } });
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));

    expect(await screen.findByRole("heading", { name: "How much do items weigh?" })).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ questionId: "success_target", answer: "40 items per hour" });
  });

  it("keeps a failed answer on screen for retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options?: RequestInit) =>
      Promise.resolve(options?.method === "POST"
        ? { ok: false }
        : { ok: true, json: async () => ({ questions: [
          { id: "item_weight", question: "How much do items weigh?", hint: "A range is fine." },
        ] }) }),
    ));
    render(<TaskFollowUp token="owner-token" />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Your answer" }), { target: { value: "10 kg" } });
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not save that"));
    expect(screen.getByDisplayValue("10 kg")).toBeInTheDocument();
  });
});
