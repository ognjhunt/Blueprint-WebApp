import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RobotScene } from "@/components/site/RobotScene";

/**
 * The robot illustration beside the sign-in and account forms keeps its artwork. These landmark checks moved here
 * from the home page's tests when the home page's animated example (PilotPreview) was removed on 2026-11-12; the
 * Packaging scene went with it, as only that example drew it.
 */
const SCENES = [
  {
    site: "Warehouse",
    // The original shelving, outbound cart and carried tote surround a biped.
    landmarks: ['rect[x="20"][y="40"][width="110"][height="140"]', 'rect[x="222"][y="128"][width="88"][height="36"]', 'ellipse[rx="11"][ry="13"]', 'rect[width="32"][height="18"]'],
  },
  {
    site: "Café",
    // Keep clean cups laid out side by side on the counter.
    landmarks: ['path[d="M152 130 h16 l-2 10 h-12 z"]', 'path[d="M138 130 h16 l-2 10 h-12 z"]', 'rect[x="204"][y="128"][width="84"][height="12"]'],
  },
  {
    site: "Laundromat",
    // Washers and folded towels identify the original folding-table scene.
    landmarks: ['rect[x="18"][y="70"][width="68"][height="110"]', 'rect[x="92"][y="70"][width="68"][height="110"]', 'rect[width="18"][height="6"]', 'path[d="M206 124 H306 M214 124 V180 M298 124 V180"]'],
  },
  {
    site: "Factory",
    // The full-height CNC, spindle, conveyor and wheeled base remain intact.
    landmarks: ['rect[x="22"][y="44"][width="118"][height="136"]', 'path[d^="M71 62 V"]', 'rect[x="204"][y="140"][width="100"][height="12"]', 'rect[width="48"][height="18"][rx="4"]'],
  },
  { site: "Hotel", landmarks: [] as string[] },
  {
    site: "Lab",
    // Preserve the existing sample cabinet and fixed-arm pedestal.
    landmarks: ['rect[x="176"][y="60"][width="114"][height="120"]', 'rect[x="52"][y="128"][width="36"][height="52"]', 'rect[y="104"][width="4"][height="36"]'],
  },
];

describe("the robot illustration beside forms", () => {
  afterEach(() => vi.useRealTimers());

  it.each(SCENES.map((scene, index) => ({ ...scene, index })).filter(scene => scene.landmarks.length))(
    "preserves the $site scene landmarks", ({ site, landmarks, index }) => {
      vi.useFakeTimers();
      render(<RobotScene />);
      // The first scene plays from its still frame (5.5 s left of its loop); each later one plays a full 10 s loop.
      for (let step = 0; step < index; step++) act(() => { vi.advanceTimersByTime(step === 0 ? 5_500 : 10_000); });
      // A later scene restarts its loop at 0: play it to the same still frame (4.5 s) the first scene starts on.
      if (index > 0) act(() => { vi.advanceTimersByTime(4_500); });
      fireEvent.click(screen.getByRole("button", { name: "Pause robot animation" }));
      const illustration = screen.getByRole("img", { name: new RegExp(`${site} example`, "i") });
      for (const landmark of landmarks) expect(illustration.querySelector(landmark), landmark).toBeInTheDocument();
      if (site === "Laundromat") expect(illustration.querySelector('rect[x="258"][y="60"][width="52"][height="120"]')).not.toBeInTheDocument();
    });

  it("shows an illustration only: no result, name or score", () => {
    const { container } = render(<RobotScene />);
    expect(container.textContent).toBe("");
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(/did best|tries|AI software|result/i);
  });
});
