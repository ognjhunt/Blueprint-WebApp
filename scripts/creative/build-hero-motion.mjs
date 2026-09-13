// Offline media assembly. Models/binaries must already exist locally; no downloads
// or API calls happen here, and this tool is never part of the website build.
// RIFE_BIN=/path/to/rife-ncnn-vulkan RIFE_MODEL_DIR=/path/to/rife-v4.6 \
//   node scripts/creative/build-hero-motion.mjs [scene-id]
import { mkdirSync, mkdtempSync, readFileSync, copyFileSync, writeFileSync, statSync, readdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = path.join(root, 'docs/visuals/hero-motion');
const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
const config = JSON.parse(readFileSync(path.join(sourceRoot, 'motion-v2.json'), 'utf8'));
const output = path.join(root, 'client/public/images/site-led/embodiments/motion');
const scratch = path.join(root, 'output/smooth-hero-build');
const rife = process.env.RIFE_BIN;
const model = process.env.RIFE_MODEL_DIR;
if (!rife || !model) throw new Error('Set RIFE_BIN and RIFE_MODEL_DIR to the local RIFE executable and pinned rife-v4.6 model directory.');
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const [file, expected] of Object.entries(config.interpolator.modelFiles)) {
  if (digest(path.join(model, file)) !== expected) throw new Error(`Unexpected RIFE model: ${file}`);
}
const scenes = config.scenes.filter((scene) => !process.argv[2] || scene.id === process.argv[2]);
if (!scenes.length) throw new Error('Unknown scene id');
mkdirSync(output, { recursive: true });
mkdirSync(scratch, { recursive: true });

for (const scene of scenes) {
  const original = manifest.scenes.find((entry) => entry.id === scene.id);
  const temp = mkdtempSync(path.join(scratch, `${scene.id}-`));
  const input = path.join(temp, 'input');
  const frames = path.join(temp, 'frames');
  mkdirSync(input); mkdirSync(frames);
  const sources = scene.keyframes.map((number, index) => {
    const frame = original.frames[number - 1];
    if (!frame) throw new Error(`${scene.id}: invalid keyframe ${number}`);
    const source = path.join(root, frame.path);
    if (digest(source) !== frame.sha256) throw new Error(`${scene.id}: source frame digest mismatch`);
    copyFileSync(source, path.join(input, `${String(index + 1).padStart(2, '0')}.webp`));
    return { number, sha256: frame.sha256 };
  });
  console.log(`${scene.id}: interpolating ${sources.length} coherent poses locally`);
  execFileSync(rife, ['-m', model, '-i', input, '-o', frames, '-n', String(config.interpolatedFrames), '-f', '%08d.png', '-j', '1:1:1'], { stdio: 'inherit' });
  if (readdirSync(frames).filter((file) => file.endsWith('.png')).length !== config.interpolatedFrames) throw new Error(`${scene.id}: incomplete interpolation`);

  // The approved room stays stationary. Only the robot, task cargo, and their
  // nearby contact shadows use the interpolated sequence.
  const mask = [`color=black:s=1536x1024:r=${config.fps}`,
    ...scene.motionRegions.map(([x, y, w, h]) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=white:t=fill`),
    'format=gray', `gblur=sigma=${config.maskFeatherPixels}`].join(',');
  const target = path.join(output, `${scene.id}-smooth-v2.mp4`);
  const encoded = path.join(temp, 'encoded.mp4');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-loop', '1', '-framerate', String(config.fps), '-i', path.join(input, '01.webp'),
    '-framerate', String(config.fps), '-i', path.join(frames, '%08d.png'),
    '-f', 'lavfi', '-i', mask,
    '-filter_complex', `[0:v]format=gbrp[base];[1:v]tpad=start_mode=clone:start_duration=${config.initialHoldSeconds}:stop_mode=clone:stop_duration=2,format=gbrp[moving];[2:v]format=gbrp[mask];[base][moving][mask]maskedmerge,format=yuv420p[out]`,
    '-map', '[out]', '-t', String(config.durationSeconds), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', encoded,
  ], { stdio: 'inherit' });
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate', '-of', 'json', encoded], { encoding: 'utf8' }));
  const video = probe.streams[0];
  if (video.width !== 1536 || video.height !== 1024 || video.r_frame_rate !== '30/1' || Number(probe.format.duration) !== 6.5) throw new Error(`${scene.id}: unexpected encode format`);
  renameSync(encoded, target);
  writeFileSync(path.join(scratch, `${scene.id}.json`), JSON.stringify({ scene: scene.id, sources, model: config.interpolator, executableSha256: digest(rife), interpolatedFrames: config.interpolatedFrames, outputSha256: digest(target), bytes: statSync(target).size, ...probe }, null, 2) + '\n');
  console.log(`${scene.id}: ${(statSync(target).size / 1024).toFixed(0)} KB, 30 fps`);
}
