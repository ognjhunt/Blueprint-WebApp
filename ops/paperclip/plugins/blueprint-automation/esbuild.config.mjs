import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");
const productionBuild = !watch;

const workerCtx = await esbuild.context({
  ...presets.esbuild.worker,
  sourcemap: watch ? presets.esbuild.worker.sourcemap : false,
  minify: productionBuild,
  external: [
    ...(presets.esbuild.worker.external ?? []),
    "firebase-admin",
    "firebase-admin/app",
    "firebase-admin/firestore",
    "firebase-admin/*",
    "../../../../../server/utils/growth-ops.js",
    "https-proxy-agent",
    "uuid",
  ],
});
// Override manifest to bundle constants into it (default is bundle: false)
const manifestCtx = await esbuild.context({
  ...presets.esbuild.manifest,
  bundle: true,
  sourcemap: watch ? presets.esbuild.manifest.sourcemap : false,
  minify: productionBuild,
  external: ["@paperclipai/plugin-sdk"],
});
const uiCtx = await esbuild.context({
  ...presets.esbuild.ui,
  sourcemap: watch ? presets.esbuild.ui.sourcemap : false,
  minify: productionBuild,
});

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
  console.log("blueprint automation plugin watch mode enabled");
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()]);
}
