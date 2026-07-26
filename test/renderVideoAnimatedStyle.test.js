import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderVideo } from '../src/video/renderVideo.js';
import { config } from '../src/config.js';

const run = promisify(execFile);

test('animated render plan reaches the real montage path without a scope error', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'animated-render-'));
  const original = {
    outro: config.video.outro,
    tailSeconds: config.video.tailSeconds,
    subPrompt: config.video.subPrompt,
  };
  try {
    config.video.outro = false;
    config.video.tailSeconds = 0;
    config.video.subPrompt = false;

    const audioPath = path.join(dir, 'voice.wav');
    const imagePath = path.join(dir, 'scene.png');
    const outPath = path.join(dir, 'render.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', audioPath]);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=64x96', '-frames:v', '1', imagePath]);

    const result = await renderVideo({
      audioPath,
      media: [{ path: imagePath, type: 'photo' }],
      outPath,
      visualStyle: 'animated',
      scenes: [{ narration: 'A tiny animated render.' }],
    }, { width: 64, height: 96, fps: 5, workDir: path.join(dir, 'work') });

    assert.equal(result.outPath, outPath);
    assert.ok(result.duration > 0);
  } finally {
    Object.assign(config.video, original);
    await rm(dir, { recursive: true, force: true });
  }
});

test('döngü yankısı klibi BENZERSİZ kimlik alır ve timeline geçerli kalır', async () => {
  // GERÇEK REGRESYON: döngü yankısı ilk görseli kasıtlı yeniden kullanır, yani
  // scene=0/part=0 ile gelir ve ilk klibin kimliğiyle çakışırdı. Roma su
  // kemerleri koşusunda doğrulayıcı TIMELINE_ORDER_INVALID:DUPLICATE_CLIP_ID
  // bildirdi — kusur planda değil, kimlik şemasındaydı.
  const { verifyTimelineOrder } = await import('../src/pipeline/finalVideoValidator.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'loopecho-id-'));
  const original = {
    outro: config.video.outro,
    tailSeconds: config.video.tailSeconds,
    subPrompt: config.video.subPrompt,
  };
  try {
    config.video.outro = false;
    config.video.tailSeconds = 0;
    config.video.subPrompt = false;

    const audioPath = path.join(dir, 'voice.wav');
    const imagePath = path.join(dir, 'scene.png');
    const outPath = path.join(dir, 'render.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', audioPath]);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=64x96', '-frames:v', '1', imagePath]);

    const result = await renderVideo({
      audioPath,
      // Son plan ilk görsele döner: aynı yol, aynı sahne/parça, loopEcho işareti.
      media: [
        { path: imagePath, type: 'photo', part: 0, assetId: 'a0' },
        { path: imagePath, type: 'photo', part: 0, assetId: 'a0#loop', loopEcho: true },
      ],
      outPath,
      scenes: [{ narration: 'First beat.' }, { narration: 'Loop closes here.' }],
      // Klip planı KANONİK zaman çizelgesinden türer; o yoksa plan boş kalır.
      timeline: {
        items: [
          { scene: 0, start: 0, end: 1, duration: 1 },
          { scene: 0, start: 1, end: 2, duration: 1 },
        ],
      },
    }, { width: 64, height: 96, fps: 5, workDir: path.join(dir, 'work') });

    const clips = result.renderPlan?.clips || [];
    assert.ok(clips.length >= 2, `klip planı boş: ${JSON.stringify(clips)}`);
    const ids = clips.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `kimlik çakışması: ${ids.join(', ')}`);
    assert.ok(clips.some((c) => c.loopEcho === true), `loopEcho bayrağı taşınmadı: ${JSON.stringify(clips)}`);
    // Muafiyet penceresi PLANA yazılmalı; boş kalırsa doğrulayıcı kasıtlı
    // döngü kapanışını "kopya plan" sayar (üretimde tam olarak bu oldu).
    const lw = result.renderPlan?.overlayWindows?.loopEcho || [];
    assert.equal(lw.length, 1, `loopEcho penceresi plana yazılmadı: ${JSON.stringify(lw)}`);
    const order = verifyTimelineOrder(clips);
    assert.ok(!order.problems.includes('DUPLICATE_CLIP_ID'), JSON.stringify(order.problems));
    assert.ok(!order.problems.some((p) => p.startsWith('OUT_OF_ORDER')), JSON.stringify(order.problems));
  } finally {
    Object.assign(config.video, original);
    await rm(dir, { recursive: true, force: true });
  }
});
