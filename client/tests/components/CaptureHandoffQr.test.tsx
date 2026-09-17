// @vitest-environment jsdom
/**
 * The desktop-to-phone handoff.
 *
 * The capture page is already right for a phone — its file input carries
 * `capture="environment"`, so a tap opens the rear camera and hands the
 * recording straight back for upload, with no camera-roll round trip. None of
 * that helps when the link is on the laptop the form was filled in on, which is
 * where it lands.
 *
 * A text message would mean collecting a phone number: new personal data, a
 * consent surface, a sending service we do not run, and carriers that filter
 * links. A code is drawn from a string the page already holds.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";

describe("CaptureHandoffQr", () => {
  it("draws a scannable code for the link it is given", async () => {
    render(<CaptureHandoffQr url="https://tryblueprint.io/capture-upload/abc.def" />);

    const image = await screen.findByRole("img");
    expect(image.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("describes what it does rather than what it is", async () => {
    // "QR code" tells a screen-reader user nothing they can act on, and the
    // plain link is right beside it for them.
    render(<CaptureHandoffQr url="https://tryblueprint.io/capture-upload/abc.def" />);

    await screen.findByRole("img", { name: /scan to record on your phone/i });
  });

  it("renders nothing at all when a code cannot be drawn", async () => {
    // A broken image frame beside a working link is worse than no image, and an
    // error about a convenience is noise at the moment someone is trying to act.
    vi.doMock("qrcode", () => ({
      toDataURL: async () => {
        throw new Error("encoder unavailable");
      },
    }));
    vi.resetModules();
    const { CaptureHandoffQr: Reloaded } = await import("@/components/site/CaptureHandoffQr");

    const { container } = render(<Reloaded url="https://tryblueprint.io/capture-upload/x.y" />);

    await waitFor(() => expect(container.querySelector("img")).toBeNull());
    expect(container.textContent).toBe("");
    vi.doUnmock("qrcode");
  });
});
