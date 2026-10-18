/** /beta says how long each step takes, from the shared timeline constants. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Beta from "@/pages/Beta";
import { EVALUATION_START_TIMELINE, REPLY_TIMELINE, SIMULATION_BUILD_TIMELINE } from "@/data/betaTimelines";

describe("the beta page", () => {
  it("states the expected timelines under What do I receive?", () => {
    render(<Beta />);
    const section = screen.getByRole("heading", { name: "What do I receive?" }).closest("section")!;
    for (const line of [REPLY_TIMELINE, SIMULATION_BUILD_TIMELINE, EVALUATION_START_TIMELINE]) {
      expect(section).toHaveTextContent(line);
    }
  });
});
