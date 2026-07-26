/**
 * 26 TEMMUZ — "SEA CUCUMBERS" CANLI HATASI.
 *
 * Yayına çıkan video (youtube.com/shorts/LeykuLoz5nA) dört ayrı hatayı aynı
 * anda gösterdi. Bu dosya dördünü de kilitler; her testin başlığı canlıda
 * GÖRÜLEN belirtiyi anlatır, açıklaması kök nedeni.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planScene, planVisualStory } from '../src/crew/storyPlanner.js';
import { beatEvents } from '../src/visual/semanticShots.js';
import { validateAssetRepetition } from '../src/pipeline/viewerFirstValidation.js';
import { evaluateEmergencyQualityGate } from '../src/pipeline/emergencyQualityGate.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);
const SAFE = { subtitleSafeArea: { top: 0.08, bottom: 0.25, left: 0.06, right: 0.06 } };

// ---------- 1) Kabarcık fotoğrafının köşesindeki "ORGANS" kutusu ----------
test('odak ölçülemeyen davranış sahnesi HİÇBİR ŞEY çizmez', () => {
  // Canlıda 0:04 ve 0:12'de görselin hiçbir yerine bağlı olmayan bir etiket
  // kutusu duruyordu ("ORGANS", "BODIES"). Özne nerede bilinmiyorsa etiket
  // bir şeyi işaret edemez — çizilmemeli.
  const ev = beatEvents(
    { kind: 'behavior', payload: { subject: 'ORGANS', action: 'EJECTS' }, start: 0, end: 4 },
    SAFE,
  );
  assert.deepEqual(ev, [], 'bağlanamayan etiket hâlâ çiziliyor');
});

test('odak ÖLÇÜLDÜYSE davranış sahnesi çizilir', () => {
  const ev = beatEvents(
    { kind: 'behavior', payload: { subject: 'ORGANS', action: 'EJECTS' },
      focus: { x: 0.6, y: 0.5, confidence: 2 }, start: 0, end: 4 },
    SAFE,
  );
  assert.ok(ev.length > 0, 'ölçülmüş odakta da çizmiyor — fazla agresif kesildi');
});

// ---------- 2) 10 sahnenin 4'ü öznesiz uydu manzarası ----------
test('"okyanus tabanı" harita şablonu SEÇTİRMEZ', () => {
  // Sınıflandırıcı her yer ifadesini 'location' sayıyor, bu da image_prompt'un
  // başına "aerial or satellite-like view" yazdırıyordu: deniz hıyarı videosunda
  // 4 sahne ÖZNESİZ geniş resif manzarası olarak üretildi.
  const p = planScene({ narration: 'They live on the deep ocean floor' });
  assert.notEqual(p.story_template, 'map', 'coğrafyaya çözülmeyen yer harita şablonu seçti');
  const s = { narration: 'They live on the deep ocean floor', image_prompt: 'a sea cucumber' };
  planVisualStory({ scenes: [s] });
  assert.ok(!/aerial|satellite/i.test(s.image_prompt),
    `görsel promptuna uydu kompozisyonu dayatıldı: ${s.image_prompt}`);
});

test('GERÇEK coğrafya hâlâ harita şablonu alır', () => {
  const p = planScene({ narration: 'This happens only in Australia' });
  assert.equal(p.story_template, 'map', 'gerçek ülke adı haritayı kaybetti');
});

// ---------- 3) Her koşuda öten alarm ----------
test('AI kareleri artık tekrar ihlali sayılmaz', () => {
  // Eski kural "arka arkaya 3 AI karesi = hata" diyordu; sistem tüm görsellerini
  // kasten AI ile üretiyor, kural 20 planda 18 kez ateşleniyordu. Sürekli öten
  // alarm yüzünden kapının tamamı devre dışı bırakılmıştı.
  const items = Array.from({ length: 8 }, (_, i) => ({ source: 'ai', assetId: `a${i}` }));
  assert.deepEqual(validateAssetRepetition(items), []);
});

test('gerçek tekrar hâlâ yakalanır, kasıtlı tekrar muaf', () => {
  assert.ok(validateAssetRepetition([
    { source: 'ai', assetId: 'same' }, { source: 'ai', assetId: 'x' }, { source: 'ai', assetId: 'same' },
  ]).some((i) => i.startsWith('VISUAL_ASSET_REPEATED')));
  // Mikro plan kadrajı / dizi karesi / döngü kapanışı KASITLI tekrardır.
  assert.deepEqual(validateAssetRepetition([
    { source: 'ai', assetId: 'a' },
    { source: 'ai', assetId: 'a', subShot: true },
    { source: 'ai', assetId: 'a', loopEcho: true },
  ]), []);
});

// ---------- 4) Kapı hesaplanıyor ama kullanılmıyordu ----------
test('künye eksiği yayını durdurmaz, kalite ihlali durdurur', () => {
  const base = {
    script: { hook_text: 'H', scenes: [{ narration: 'n' }] },
    wordTimings: [{ word: 'aa', start: 0.1, end: 0.4 }, { word: 'bb', start: 0.5, end: 0.9 },
      { word: 'cc', start: 1.0, end: 1.4 }],
    mediaItems: [{ scene: 0, path: '/x.jpg', source: 'ai' }],
    technical: { videoStreamPresent: true, audioStreamPresent: true },
    timeline: { items: [{ duration: 3 }], issues: [] },
    renderPlan: { captionsIncluded: true, captionEventCount: 4 },
    duration: 35,
  };
  const r = evaluateEmergencyQualityGate(base);
  // Lisans kaydı eksik → bulgu var ama BLOKE değil.
  assert.ok(r.advisory.some((f) => f.startsWith('ASSET_RIGHTS_EVIDENCE_MISSING')));
  assert.ok(!r.blocking.some((f) => f.startsWith('ASSET_RIGHTS')));

  // Altyazı yoksa → BLOKE.
  const broken = evaluateEmergencyQualityGate({ ...base, wordTimings: [] });
  assert.ok(broken.blocking.includes('CAPTIONS_MISSING_OR_EMPTY'));
  assert.equal(broken.block, true, 'kalite ihlali yayını durdurmuyor');
});

// ---------- 5) Odak, kabarcık tarlasına kilitlenmişti ----------
test('benek tarlasında odak SUSAR, tek özne varsa BULUR', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  // Canlı kare: boş suyun üstündeki kabarcıklar en yüksek yerel kontrastı
  // üretiyor, gerçek özne sol altta duruyordu; sistem kabarcığı işaretledi
  // (güven 1.41 ile eşiği geçmişti). Benek tarlası = özne DEĞİL.
  const { detectFocus } = await import('../src/visual/focusDetect.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fd3-'));
  try {
    // Kadrajın her yerine dağılmış küçük parlak benekler (kabarcık taklidi).
    const speckles = path.join(dir, 'speckle.png');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'color=c=0x14506e:s=1080x1920',
      '-vf', "noise=alls=90:allf=t+u,format=rgb24",
      '-frames:v', '1', speckles], { maxBuffer: 20 * 1024 * 1024 });
    assert.equal(await detectFocus(speckles), null, 'benek tarlasına odak kilitlendi');

    // Aynı zeminde TEK belirgin özne → bulunmalı.
    const subject = path.join(dir, 'subject.png');
    await run('ffmpeg', ['-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'color=c=0x14506e:s=1080x1920',
      '-f', 'lavfi', '-i', 'color=c=0xFF7A22:s=300x300',
      '-filter_complex',
      "[1:v]format=yuva420p,geq=lum='p(X,Y)':a='if(lt(hypot(X-150,Y-150),145),255,0)'[d];[0:v][d]overlay=400:1100",
      '-frames:v', '1', subject], { maxBuffer: 20 * 1024 * 1024 });
    const f = await detectFocus(subject);
    assert.ok(f, 'düz zeminde tek özne bile bulunamadı — kriter fazla sert');
    const err = Math.hypot(f.x - 550 / 1080, f.y - 1250 / 1920);
    assert.ok(err < 0.08, `odak özneden uzak: sapma ${err.toFixed(3)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
