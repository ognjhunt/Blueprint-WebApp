import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SceneSmithExplainerMedia from "@/components/sections/SceneSmithExplainerMedia";
import { scenesmithMedia } from "@/data/scenesmithMedia";

describe("SceneSmithExplainerMedia", () => {
  it("renders first media item and visible attribution links", () => {
    render(<SceneSmithExplainerMedia />);

    expect(
      screen.getByText("See the pipeline mechanics, not just the claims."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("scenesmith-spotlight-title")).toHaveTextContent(
      scenesmithMedia[0].title,
    );
    expect(screen.getByTestId("scenesmith-attribution")).toBeInTheDocument();
    expect(screen.getByText("GitHub repository")).toBeInTheDocument();
    expect(screen.getByText("Project paper")).toBeInTheDocument();
  });

  it("switches spotlight media when a selector is clicked", () => {
    render(<SceneSmithExplainerMedia />);

    fireEvent.click(screen.getByRole("button", { name: /Robot evaluation loop/i }));

    expect(screen.getByTestId("scenesmith-spotlight-title")).toHaveTextContent(
      scenesmithMedia[1].title,
    );
  });

  it("falls back to poster image when media fails while keeping source CTA", () => {
    render(<SceneSmithExplainerMedia />);

    const spotlight = screen.getByAltText(scenesmithMedia[0].title);
    fireEvent.error(spotlight);

    const fallbackSpotlight = screen.getByAltText(scenesmithMedia[0].title);
    expect(fallbackSpotlight.getAttribute("src")).toContain(
      "social-preview.png",
    );

    const sourceCta = screen.getByTestId("scenesmith-source-cta");
    expect(sourceCta).toBeInTheDocument();
    expect(sourceCta).toHaveAttribute("href", scenesmithMedia[0].sourceHref);
  });
});
