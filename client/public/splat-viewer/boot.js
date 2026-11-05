// Blueprint's host for the vendored SuperSplat Viewer (see README.md). Owner decision
// 2026-10-29: a site views its 3D preview and never downloads it, so the splat comes only
// from Blueprint's own short-lived view route; any other content URL is refused.

const NOT_VALID = "This 3D preview link is not valid. Open the preview again from your job page.";
const NOT_LOADED = "This 3D preview could not be loaded. Go back to your job page and open it again in a minute.";
const NO_GRAPHICS = "This browser could not show the 3D preview. Try again in an up-to-date desktop browser.";
/** The view route's scene URL; its first segment is the job the preview belongs to. */
const SCENE_URL = /^\/api\/website-atlas-preview-views\/([A-Za-z0-9][A-Za-z0-9._-]{0,119})\/[^/?]+\/scene\.ply\?/;

const status = document.querySelector(".bp-status");

/** One plain message over the viewer; the first problem is the one shown. */
function showProblem(text) {
  status?.remove();
  if (document.querySelector(".bp-problem")) return;
  const message = document.createElement("p");
  message.className = "bp-problem";
  message.setAttribute("role", "alert");
  message.textContent = text;
  document.body.append(message);
}

const params = new URL(location.href).searchParams;
const contentUrl = params.get("content") ?? "";
const job = SCENE_URL.exec(contentUrl)?.[1];
if (!job) {
  showProblem(NOT_VALID);
} else {
  const back = document.querySelector(".bp-back");
  if (back) {
    back.href = `/app/tasks/${encodeURIComponent(job)}`;
    back.textContent = "Back to your job";
  }
  // Ask for the scene and its start view before loading the viewer's code: on a first view
  // the server is still preparing them, and that wait now overlaps the download.
  //
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
  // The preview's own start view (where the recording starts), else the package defaults.
  const settings = fetch(contentUrl.replace("/scene.ply?", "/settings.json?"))
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("no start view"))))
    .catch(() => fetch("./settings.json").then((response) => response.json()));
  const viewer = import("./index.js").then(({ createViewer }) => createViewer({
    container: document.body,
    settings,
    contentUrl,
    contents,
    renderer: params.has("webgl") ? "webgl" : "webgpu",
    ui: true,
  }).catch((error) => { showProblem(NO_GRAPHICS); throw error; }), (error) => { showProblem(NOT_LOADED); throw error; });
  // The viewer's own progress bar takes over only once the scene is arriving and the viewer is
  // up: a prepared scene can answer before the viewer's code has finished downloading.
  Promise.all([contents, viewer]).then(() => status?.remove(), () => undefined);
}
