// Local media assembly only. No model, API, network, or credential access.
// Run: node scripts/creative/build-hero-motion.mjs [scene-id]
import { mkdirSync, readFileSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(root, "docs/visuals/hero-motion");
const manifest = JSON.parse(readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
const output = path.join(root, "client/public/images/site-led/embodiments/motion");
mkdirSync(output, { recursive: true });
const summaries = [];
for (const scene of manifest.scenes.filter((entry) => !process.argv[2] || entry.id === process.argv[2])) {
  if (scene.frames.length !== 9) throw new Error(`${scene.id}: expected nine reviewed source frames`);
  const temp = path.join(root, "output/hero-motion-build", scene.id);
  mkdirSync(temp, { recursive: true });
  scene.frames.forEach((frame, index) => copyFileSync(path.join(root, frame.path), path.join(temp, `frame-${String(index + 1).padStart(2, "0")}.webp`)));
  const target = path.join(output, `${scene.id}.mp4`);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-framerate", "2", "-i", path.join(temp, "frame-%02d.webp"),
    // Repeat source frames exactly: optical flow invented ghosted robot joints.
    // Bound the input to the nine canonical frames even if old temp holds exist.
    "-vf", "trim=end_frame=9,fps=24,tpad=start_mode=clone:start_duration=0.5:stop_mode=clone:stop_duration=2",
    "-t", "6.5", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", target,
  ], { stdio: "inherit" });
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate", "-of", "json", target], { encoding: "utf8" }));
  summaries.push({ id: scene.id, bytes: statSync(target).size, ...probe });
  console.log(`${scene.id}: ${(statSync(target).size / 1024).toFixed(0)} KB`);
}
writeFileSync(path.join(root, "output/hero-motion-build/summary.json"), JSON.stringify(summaries, null, 2) + "\n");
