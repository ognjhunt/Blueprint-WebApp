import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { canvasSurfaceColors, canvasSurfaceFor } from "@/app/canvasSurface";

/**
 * Keeps the canvas ground in step with the route.
 *
 * Must render *outside* the router's Suspense boundary: while the next route's
 * chunk loads, the fallback replaces everything inside it, so a sync living in
 * there would unmount at exactly the moment the canvas is what the user sees.
 *
 * `useLayoutEffect` lands the attribute in the same commit that swaps the page
 * in, before the browser paints — so the destination's ground is already up
 * when the fallback appears, and there is no frame of the previous surface.
 */
export function CanvasSurfaceSync() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    const surface = canvasSurfaceFor(location);
    document.documentElement.dataset.surface = surface;
    // Mobile browser chrome reads this, so it has to move with the ground.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", canvasSurfaceColors[surface]);
  }, [location]);

  return null;
}
