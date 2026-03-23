import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";

describe("AnimatedCounter", () => {
  it("renders the final value in server output", () => {
    const markup = renderToString(<AnimatedCounter value={25} prefix="$" suffix="%" />);

    expect(markup).toContain("25");
    expect(markup).not.toContain("$0%");
  });
});
