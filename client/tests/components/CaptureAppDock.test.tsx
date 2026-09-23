import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ url: "https://www.tryblueprint.io/capture-app" }));
const route = vi.hoisted(() => ({ path: "/capture-app" }));

vi.mock("@/lib/client-env", () => ({
  getCaptureAppPlaceholderUrl: () => env.url,
}));
vi.mock("wouter", () => ({
  useLocation: () => [route.path, () => undefined],
}));

import { CaptureAppDock } from "@/components/site/CaptureAppDock";

afterEach(() => {
  env.url = "https://www.tryblueprint.io/capture-app";
  route.path = "/capture-app";
});

describe("CaptureAppDock", () => {
  it("offers the app only when the configured link is a real app destination", () => {
    env.url = "https://apps.apple.com/app/id6444444444";
    render(<CaptureAppDock />);
    const link = screen.getByRole("link", { name: "Get Blueprint Capture for iPhone" });
    expect(link).toHaveAttribute("href", "https://apps.apple.com/app/id6444444444");
    expect(link).toHaveTextContent("Films a space from a Blueprint capture link");
    expect(link).not.toHaveTextContent(/Download|boots on the ground/i);
  });

  it("renders nothing when the link is one of Blueprint's own pages", () => {
    for (const url of ["https://www.tryblueprint.io/capture-app", "https://tryblueprint.io/capture-app", "/capture-app"]) {
      env.url = url;
      const { container, unmount } = render(<CaptureAppDock />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("stays off routes other than the capture-app pages", () => {
    env.url = "https://apps.apple.com/app/id6444444444";
    route.path = "/contact/site-operator";
    const { container } = render(<CaptureAppDock />);
    expect(container).toBeEmptyDOMElement();
  });
});
