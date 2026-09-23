// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnthropicAuthoringChoice } from "@/components/site/AnthropicAuthoringChoice";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
afterEach(() => vi.unstubAllGlobals());

it("keeps Claude opt-in until a named owner accepts the exact linked terms", async () => {
  const terms = { digest: "anthropic:opus-5-5-private-processing-v1",
    label: "Anthropic API terms", url: "https://example.com/anthropic-terms" };
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
    ? { ok: true, json: async () => ({ accepted: { accepted_by: "Site owner", provider_terms_reference: terms.digest, choice_digest: "sha256:example" } }) }
    : { ok: true, json: async () => ({ available: true, terms, accepted: null }) });
  vi.stubGlobal("fetch", fetcher);
  render(<AnthropicAuthoringChoice token="owner-token" />);
  const button = await screen.findByRole("button", { name: "Select Claude for this capture" });
  expect(button).toBeDisabled();
  expect(screen.getByRole("link", { name: "Review Anthropic API terms" })).toHaveAttribute("href", terms.url);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Site owner" } });
  fireEvent.click(screen.getByLabelText(/I authorize Anthropic processing/));
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(await screen.findByText(/Claude Opus 5.5 authoring was selected/)).toBeInTheDocument();
  const payload = JSON.parse(fetcher.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string);
  expect(payload).toEqual({ authoring_provider: "anthropic", accepted: true,
    accepted_by: "Site owner", provider_terms_reference: terms.digest });
});
