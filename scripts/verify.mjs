import {execFile} from 'node:child_process';
import {readFile, stat, writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const videoPath = 'out/neosaniye-short.mp4';
const manifestPath = 'out/manifest.json';
const reportPath = 'out/verification.json';

async function main() {
  const videoStat = await stat(videoPath);
  if (videoStat.size < 100_000) throw new Error(`Video file is too small: ${videoStat.size}`);

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const {stdout} = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,channels',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    videoPath,
  ]);
  const probe = JSON.parse(stdout);
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  const duration = Number(probe.format?.duration || 0);

  if (!video) throw new Error('No video stream found.');
  if (!audio) throw new Error('No audio stream found.');
  if (video.width !== 1080 || video.height !== 1920) {
    throw new Error(`Invalid resolution: ${video.width}x${video.height}`);
  }
  if (video.r_frame_rate !== '30/1') throw new Error(`Invalid frame rate: ${video.r_frame_rate}`);
  if (duration < 20 || duration > 60) throw new Error(`Duration outside Shorts policy: ${duration}`);
  if (Math.abs(duration - manifest.durationSeconds) > 1.2) {
    throw new Error(`Manifest/render duration mismatch: ${manifest.durationSeconds} vs ${duration}`);
  }

  const report = {
    ok: true,
    videoBytes: videoStat.size,
    duration,
    slug: manifest.slug,
    slot: manifest.slot,
    video,
    audio,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
