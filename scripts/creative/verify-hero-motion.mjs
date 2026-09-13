// Compare decoded media at the same cadence, rather than treating an fps label
// as evidence of smooth motion. FFmpeg is local; this makes no network calls.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = path.join(root, 'docs/visuals/hero-motion/motion-v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function differences(file, crop) {
  const metadata = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf',
    `fps=30,crop=${crop},tblend=all_mode=difference,signalstats,metadata=print:file=-`,
    '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 3_000_000 });
  // Number() retains scientific notation used for tiny compression differences.
  const values = [...metadata.matchAll(/lavfi.signalstats.YAVG=([^\r\n]+)/g)].map((match) => Number(match[1]));
  if (values.length !== 194 || !values.every(Number.isFinite)) throw new Error(`Unexpected difference samples: ${file}`);
  return { peak: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, changingFrames: values.filter((value) => value > 0.02).length };
}
const report = { checkedAt: new Date().toISOString(), configSha256: hash(configPath), method: 'Mean absolute luma change between consecutive decoded frames at 30 fps; 0-255 scale', scenes: [] };
for (const scene of config.scenes) {
  const directory = path.join(root, 'client/public/images/site-led/embodiments/motion');
  const before = path.join(root, 'docs/visuals/hero-motion/baseline', `${scene.id}.mp4`);
  const after = path.join(directory, `${scene.id}-smooth-v2.mp4`);
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', after], { encoding: 'utf8' }));
  const stream = metadata.streams[0];
  if (metadata.streams.length !== 1 || stream.codec_name !== 'h264' || stream.width !== 1536 || stream.height !== 1024 || stream.r_frame_rate !== '30/1' || Number(stream.nb_frames) !== 195 || Number(metadata.format.duration) !== 6.5) throw new Error(`${scene.id}: incorrect video format`);
  const original = differences(before, '900:850:600:120');
  const smoothed = differences(after, '900:850:600:120');
  const background = differences(after, '320:80:1200:0');
  const peakReductionPercent = (1 - smoothed.peak / original.peak) * 100;
  const passed = peakReductionPercent >= 60 && smoothed.changingFrames >= 80 && background.peak <= 0.25;
  report.scenes.push({ id: scene.id, beforeSha256: hash(before), afterSha256: hash(after), bytes: fs.statSync(after).size, original, smoothed, background, peakReductionPercent, passed });
  console.log(`${scene.id}: peak jump reduced ${peakReductionPercent.toFixed(1)}%, ${smoothed.changingFrames} changing frames, background peak ${background.peak.toFixed(4)} — ${passed ? 'PASS' : 'FAIL'}`);
}
const reportPath = path.join(root, 'output/smooth-hero-review/motion-quality.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (report.scenes.some((scene) => !scene.passed)) process.exitCode = 1;
