// Blueprint's host for the vendored SuperSplat Viewer (see README.md). Owner decision
// 2026-10-29: a site views its 3D preview and never downloads it, so the splat comes only
// from Blueprint's own short-lived view route; any other content URL is refused.
import { createViewer } from "./index.js";

const params = new URL(location.href).searchParams;
const contentUrl = params.get("content") ?? "";
if (!contentUrl.startsWith("/api/website-atlas-preview-views/")) {
  document.body.textContent = "This 3D preview link is not valid. Open the preview again from your job page.";
} else {
  createViewer({
    container: document.body,
    settings: fetch("./settings.json").then((response) => response.json()),
    contentUrl,
    contents: fetch(contentUrl),
    renderer: params.has("webgl") ? "webgl" : "webgpu",
    ui: true,
  });
}
