import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { preflightCheck, parseFfmpegFilterEvents } from '../src/pipeline/preflight.js';

const run = promisify(execFile);

const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

// ---- saf ayrıştırıcı (fixture stderr — ffmpeg'in gerçek log biçimleri) ----

test('parseFfmpegFilterEvents: siyah/donma/sessizlik/peak logları doğru ayrıştırılır', () => {
  const stderr = [
    '[blackdetect @ 0x55d] black_start:0 black_end:1.2 black_duration:1.2',
    '[blackdetect @ 0x55d] black_start:14.5 black_end:15.6 black_duration:1.1',
    '[freezedetect @ 0x55e] lavfi.freezedetect.freeze_start: 5.04',
    '[silencedetect @ 0x55f] silence_start: 10.5',
    '[silencedetect @ 0x55f] silence_end: 14.2 | silence_duration: 3.7',
    '[Parsed_volumedetect_1 @ 0x560] max_volume: -1.3 dB',
  ].join('\n');
  const ev = parseFfmpegFilterEvents(stderr);
  assert.equal(ev.black.length, 2);
  assert.deepEqual(ev.black[0], { start: 0, end: 1.2, duration: 1.2 });
  assert.equal(ev.freeze.length, 1);
  assert.equal(ev.freeze[0].start, 5.04);
  assert.equal(ev.silence.length, 1);
  assert.deepEqual(ev.silence[0], { start: 10.5, end: 14.2, duration: 3.7 });
  assert.equal(ev.maxVolumeDb, -1.3);
});

test('parseFfmpegFilterEvents: boş/ilgisiz log → sıfır tespit', () => {
  const ev = parseFfmpegFilterEvents('frame= 100 fps= 30 q=28.0 size= 256kB');
  assert.deepEqual(ev, { black: [], freeze: [], silence: [], maxVolumeDb: null });
});

test('parseFfmpegFilterEvents: kapanmamış sessizlik (dosya sonuna kadar) end=null kalır', () => {
  const ev = parseFfmpegFilterEvents('[silencedetect @ 0x1] silence_start: 30.2');
  assert.equal(ev.silence.length, 1);
  assert.equal(ev.silence[0].end, null);
});

// ---- gerçek MP4 üzerinde entegrasyon (ffmpeg gerekir; yoksa atlanır) ----

test('preflightCheck: gerçek üretilmiş MP4 üzerinde teknik alanları doldurur', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pf-test-'));
  try {
    const file = path.join(dir, 'fixture.mp4');
    // 16s test videosu: hareketli desen (donma yok) + -20dB sinüs (sessiz değil).
    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=16',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=16',
      '-filter:a', 'volume=-20dB',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', file,
    ], { maxBuffer: 20 * 1024 * 1024 });

    const pf = await preflightCheck(file, { expectedDuration: 16 });
    const t = pf.technical;
    assert.equal(t.videoStreamPresent, true);
    assert.equal(t.audioStreamPresent, true);
    assert.equal(t.resolution, '1080x1920');
    assert.equal(t.fps, 30);
    assert.ok(Math.abs(t.durationSeconds - 16) < 0.5, `süre ${t.durationSeconds}`);
    assert.ok(Math.abs(t.durationDeltaSeconds) < 0.5);
    assert.equal(t.decodePassed, true);
    assert.equal(t.blackSegmentCount, 0);
    assert.equal(typeof t.fileSizeMB, 'number');
    assert.ok(t.maxVolumeDb !== null, 'volumedetect çalışmadı');
    // Sinüs -20dB tam ölçekte değil → clipping uyarısı OLMAMALI.
    assert.ok(!pf.warnings.some((w) => w.includes('clipping')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('preflightCheck: bozuk dosya sert hata verir (ok=false)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pf-bad-'));
  try {
    const file = path.join(dir, 'garbage.mp4');
    await writeFile(file, 'bu bir video degil '.repeat(50000)); // ~950KB çöp
    const pf = await preflightCheck(file);
    assert.equal(pf.ok, false);
    assert.ok(pf.issues.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('preflightCheck: olmayan dosya → ok=false, çökmez', async () => {
  const pf = await preflightCheck('/nonexistent/video.mp4');
  assert.equal(pf.ok, false);
  assert.ok(pf.issues[0].includes('dosya yok'));
});
