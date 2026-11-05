// Blueprint's host for the vendored SuperSplat Viewer (see README.md). Owner decision
// 2026-10-29: a site views its 3D preview and never downloads it, so the splat comes only
// from Blueprint's own short-lived view route; any other content URL is refused.
import { createViewer } from "./index.js";

const NOT_LOADED = "This 3D preview could not be loaded. Go back to your job page and open it again in a minute.";
const NO_GRAPHICS = "This browser could not show the 3D preview. Try again in an up-to-date desktop browser.";

/** One plain message over the viewer; the first problem is the one shown. */
function showProblem(text) {
  if (document.querySelector(".bp-problem")) return;
  const message = document.createElement("p");
  message.className = "bp-problem";
  message.setAttribute("role", "alert");
  message.textContent = text;
  document.body.append(message);
}

const params = new URL(location.href).searchParams;
const contentUrl = params.get("content") ?? "";
if (!contentUrl.startsWith("/api/website-atlas-preview-views/")) {
  document.body.textContent = "This 3D preview link is not valid. Open the preview again from your job page.";
} else {
  // The viewer parses whatever body it is given: a refused or failed request reads as a bad
  // PLY header and leaves an empty black scene. Say so instead, including when the
  // connection drops partway through a large splat.
  const contents = fetch(contentUrl).then((response) => {
    if (!response.ok || !response.body) throw new Error(`3D preview request failed (${response.status})`);
    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable).catch(() => showProblem(NOT_LOADED));
    return new Response(readable, { status: response.status, headers: response.headers });
  });
  contents.catch(() => showProblem(NOT_LOADED));
  createViewer({
    container: document.body,
    // The preview's own start view (where the recording starts), else the package defaults.
    settings: fetch(contentUrl.replace("/scene.ply?", "/settings.json?"))
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("no start view"))))
      .catch(() => fetch("./settings.json").then((response) => response.json())),
    contentUrl,
    contents,
    renderer: params.has("webgl") ? "webgl" : "webgpu",
    ui: true,
  }).catch(() => showProblem(NO_GRAPHICS));
}
