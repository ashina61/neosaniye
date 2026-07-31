import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * KOREOGRAFİ PRİMİTİFLERİNİN DAVRANIŞ TESTİ
 *
 * Bu depodaki öteki testler kaynak METNİNE bakıyor, çünkü .mjs test dosyası
 * .ts/.tsx'i doğrudan import edemiyor. Metin testi bir kaydın tutarlı olduğunu
 * gösterebilir ama bir FONKSİYONUN doğru sayı döndürdüğünü gösteremez.
 *
 * choreography.ts saf TypeScript (React yok, DOM yok), yani derlenip
 * çalıştırılabilir. Burada tsc ile geçici bir dizine derleyip gerçek davranışı
 * ölçüyoruz. Maliyeti bir saniye; karşılığı, bu dosyadaki sayıların bir daha
 * sessizce bozulmaması.
 *
 * Neden gerektiği ölçümle biliniyor: aynı oturumda CastShadow'un dönüşüm
 * SIRASI yanlış yazıldı ve hata yalnızca render'a bakınca görüldü — gölge
 * figürden 850 piksel uzağa uzanan bir çubuk olmuştu. Sıra/ölçek hataları
 * tiplerden görünmez.
 */

let mod;
let tmp;

test.before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'neo-film-'));
  await run(
    process.execPath,
    [
      path.join(ROOT, 'node_modules/typescript/bin/tsc'),
      'src/film/choreography.ts',
      'src/motion/stepped.ts',
      'src/design/tokens.ts',
      '--outDir',
      tmp,
      // commonjs, esnext DEĞİL — ve sebebi şu: tsc göreli import'lara `.js`
      // uzantısı EKLEMEZ. ESM olarak derlenince Node
      // `Cannot find module '.../design/tokens'` diyor, çünkü ESM tam yol
      // ister. CommonJS çözümlemesi uzantısız yolu kendisi tamamlıyor.
      '--module',
      'commonjs',
      '--target',
      'es2022',
      // Gerekli: depoda @types/dom-webcodecs ve lib.dom.d.ts çakışıyor ve tsc
      // bu üç saf dosyayı derlemeyi o çakışma yüzünden reddediyor. Buradaki iş
      // tip denetimi değil (onu `npm run typecheck` yapıyor), DAVRANIŞ ölçmek.
      '--skipLibCheck',
      '--lib',
      'es2022',
    ],
    {cwd: ROOT},
  );
  mod = createRequire(import.meta.url)(path.join(tmp, 'film/choreography.js'));
});

test.after(async () => {
  if (tmp) await rm(tmp, {recursive: true, force: true});
});

/* ------------------------------------------------------------------ */
/* cue — girişleri sahne süresine yayar                                */
/* ------------------------------------------------------------------ */

test('cue girişleri sahnenin sonuna kadar yayar (ölü kuyruk kalmaz)', () => {
  const {cue} = mod;
  for (const seconds of [1.6, 2.0, 2.8, 4.0]) {
    const n = 5;
    const times = Array.from({length: n}, (_, i) => cue(seconds, i, n));
    // Artan sıra
    for (let i = 1; i < n; i += 1) {
      assert.ok(times[i] > times[i - 1], `${seconds}s: ${i}. giriş öncekinden sonra gelmiyor`);
    }
    // İlk giriş hemen, son giriş sahnenin sonuna yakın
    assert.ok(times[0] <= 0.2, `${seconds}s: ilk giriş çok geç (${times[0]})`);
    assert.ok(
      times[n - 1] >= seconds * 0.6,
      `${seconds}s: son giriş sahnenin %60'ından önce (${times[n - 1]}) — kuyruk ölü kalır`,
    );
    // Sahnenin dışına taşmaz
    assert.ok(times[n - 1] < seconds, `${seconds}s: son giriş sahne dışında (${times[n - 1]})`);
  }
});

test('cue tek girişte 0.12 döner ve sınırları kırpar', () => {
  const {cue} = mod;
  assert.equal(cue(3, 0, 1), 0.12);
  // Aralık dışı indeksler ilk/son değere sabitlenir, NaN üretmez
  assert.equal(cue(3, -5, 4), cue(3, 0, 4));
  assert.equal(cue(3, 99, 4), cue(3, 3, 4));
});

/* ------------------------------------------------------------------ */
/* focusHunt — odak çekme                                              */
/* ------------------------------------------------------------------ */

test('focusHunt bulanıklıktan netliğe iner ve SIFIRDA kalır', () => {
  const {focusHunt} = mod;
  const spec = {at: 0.4, duration: 0.6, from: 10};
  const at0 = focusHunt(0, spec);
  const mid = focusHunt(Math.round(0.7 * 30), spec);
  const after = focusHunt(Math.round(1.4 * 30), spec);
  assert.ok(at0 > 5, `başlangıçta bulanık olmalı, ölçülen ${at0}`);
  assert.ok(mid < at0, 'ortada azalmalı');
  assert.equal(after, 0, 'süre bittikten sonra tam net olmalı — kalıntı bulanıklık kabul edilmez');
  // Süre boyunca hiç negatif çıkmaz (negatif blur CSS'te geçersizdir)
  for (let f = 0; f < 60; f += 1) assert.ok(focusHunt(f, spec) >= 0);
});

test('focusFilter yalnızca anlamlı bulanıklıkta dize üretir', () => {
  const {focusFilter} = mod;
  assert.equal(focusFilter(0), undefined);
  assert.equal(focusFilter(0.01), undefined);
  assert.match(focusFilter(3.4), /^blur\(3\.4px\)$/);
});

/* ------------------------------------------------------------------ */
/* parallax — derinlik çarpanı                                         */
/* ------------------------------------------------------------------ */

test('parallax her derinlik kademesinde 0.6 katına iner', () => {
  const {parallax, PARALLAX_DEPTH_FACTOR} = mod;
  assert.equal(PARALLAX_DEPTH_FACTOR, 0.6);
  const frame = 45;
  const spec = {seconds: 3, dx: 100};
  const px = (s) => Number(/translate\((-?[\d.]+)px/.exec(parallax(frame, s))[1]);
  const front = px({...spec, depth: 0});
  const back = px({...spec, depth: 1});
  const deeper = px({...spec, depth: 2});
  assert.ok(Math.abs(back - front * 0.6) < 0.02, `arka katman 0.6 katı olmalı: ${back} vs ${front}`);
  assert.ok(Math.abs(deeper - front * 0.36) < 0.02, `iki kademe arka 0.36 katı olmalı: ${deeper}`);
});

/* ------------------------------------------------------------------ */
/* zoomThrough + peel                                                  */
/* ------------------------------------------------------------------ */

test('zoomThrough sahnenin SONUNDA çalışır, başında değil', () => {
  const {zoomThrough} = mod;
  const spec = {seconds: 3, duration: 0.6, to: 1.5};
  assert.equal(zoomThrough(0, spec).scale, 1, 'sahne başında ölçek 1 olmalı');
  assert.equal(zoomThrough(Math.round(2.0 * 30), spec).scale, 1, 'pencere dışında ölçek 1 olmalı');
  const end = zoomThrough(Math.round(2.95 * 30), spec).scale;
  assert.ok(end > 1.3 && end <= 1.5, `sonda hedefe yaklaşmalı, ölçülen ${end}`);
});

test('peel perspektif üretir ve SIFIR AÇIDA bitmez', () => {
  const {peel} = mod;
  const spec = {seconds: 3, at: 0.2, duration: 0.7, deg: 10};
  const start = peel(Math.round(0.25 * 30), spec);
  const rest = peel(Math.round(2.5 * 30), spec);
  assert.match(start.transform, /perspective\(\d+px\) rotateY\(/);
  const angle = (t) => Math.abs(Number(/rotateY\((-?[\d.]+)deg/.exec(t)[1]));
  assert.ok(angle(start.transform) > angle(rest.transform), 'açı zamanla küçülmeli');
  assert.ok(angle(rest.transform) > 0.5, 'oturduktan sonra açı sıfırlanmamalı — kalınlık hissi kaybolur');
  assert.equal(peel(0, {seconds: 3, edge: 'right'}).origin, 'right center');
  assert.match(peel(0, {seconds: 3, edge: 'top'}).transform, /rotateX\(/);
});

/* ------------------------------------------------------------------ */
/* holdJitter — determinizm ve 12fps ızgarası                          */
/* ------------------------------------------------------------------ */

test('holdJitter deterministik ve 12fps adımında TUTULUR', () => {
  const {holdJitter} = mod;
  assert.equal(holdJitter(7, 3), holdJitter(7, 3), 'aynı kare aynı değeri vermeli');
  // 30fps'de 12fps adımı 2.5 kare: 0 ve 1 aynı adımda, 3 farklı adımda.
  assert.equal(holdJitter(0, 1), holdJitter(1, 1), 'aynı adım içinde titreme değişmemeli');
  assert.notEqual(holdJitter(0, 1), holdJitter(3, 1), 'adım değişince titreme değişmeli');
  // Genlik küçük kalmalı: kompozisyon kilidi ölçümü tol=6 ile çalışıyor.
  for (let f = 0; f < 90; f += 1) {
    const [, x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(holdJitter(f, f % 7));
    assert.ok(Math.abs(Number(x)) <= 1.2 && Math.abs(Number(y)) <= 1.2, `titreme genliği büyük: ${x},${y}`);
  }
});

test('compose boş ve "none" parçaları atar', () => {
  const {compose} = mod;
  assert.equal(compose(undefined, false, 'none'), undefined);
  assert.equal(compose('translate(1px, 2px)', 'none', 'scale(2)'), 'translate(1px, 2px) scale(2)');
});

/* ------------------------------------------------------------------ */
/* Arşiv kolu — lisans süzgeci                                         */
/* ------------------------------------------------------------------ */
/**
 * NEDEN BU TESTİN OLMASI ŞART
 *
 * Lisans süzgeci bu hattaki tek HUKUKİ kapı. Yanlış tarafa açılırsa telif
 * ihlali üretir ve hata sessizdir: video render edilir, yayınlanır, sorun
 * aylar sonra çıkar. En sık yapılan yanlış "CC yazıyorsa serbesttir" varsayımı,
 * oysa:
 *   · ND (NoDerivatives) türev yasaklar — biz fotoğrafı KESİP kolaja koyuyoruz
 *   · NC (NonCommercial) para kazanan bir kanalda kullanılamaz
 */
test('lisans süzgeci ND ve NC lisansları REDDEDİYOR', async () => {
  const {licenceOk} = await import('../pipeline/fetch-archive.mjs');

  for (const good of [
    'Public domain',
    'PD-US',
    'CC0',
    'CC BY 4.0',
    'CC BY-SA 3.0',
    'cc-by-sa-4.0',
  ]) {
    assert.equal(licenceOk(good), true, `serbest lisans reddedildi: ${good}`);
  }

  for (const bad of [
    'CC BY-ND 4.0',
    'CC BY-NC 2.0',
    'CC BY-NC-SA 4.0',
    'All rights reserved',
    'Fair use',
    '',
    undefined,
  ]) {
    assert.equal(licenceOk(bad), false, `kullanılamaz lisans kabul edildi: ${bad}`);
  }
});

test('extmetadata HTML parçaları düz metne iniyor', async () => {
  const {plain} = await import('../pipeline/fetch-archive.mjs');
  assert.equal(plain('<a href="/wiki/User:X" title="t">Jane&nbsp;Doe</a>'), 'Jane Doe');
  assert.equal(plain(''), '');
  assert.equal(plain(undefined), '');
});

/* ------------------------------------------------------------------ */
/* curlAmount — "yaşayan poster" fazının tek olayı                     */
/* ------------------------------------------------------------------ */

test('curlAmount kurulum sırasında SIFIR, tutuş fazında canlanır', () => {
  const {curlAmount} = mod;
  const secs = 10;
  // Kurulum fazı: köşe kalkarsa "yerleşen bir daha oynamaz" kuralı çiğnenir.
  for (const t of [0, 2, 5, 6.9]) {
    assert.equal(curlAmount(t * 30, secs, 30, 0.7), 0, `${t}s'de kalkma olmamalı`);
  }
  // Tutuş fazı: ölü değil.
  const hold = [7.2, 8, 9, 9.8].map((t) => curlAmount(t * 30, secs, 30, 0.7));
  assert.ok(Math.max(...hold) > 0.3, `tutuş fazı ölü: ${hold.map((v) => v.toFixed(2))}`);
});

test('curlAmount NEFES ALIR — tek yönlü rampa değil', () => {
  const {curlAmount} = mod;
  const vals = [];
  for (let f = 210; f <= 300; f += 3) vals.push(curlAmount(f, 10, 30, 0.7));
  // Hava akımı gelir gider: dizide hem artış hem azalış olmalı. Tek yönlü
  // rampa "köşe kalktı ve öyle kaldı" demek olurdu, o da yeni bir donma.
  let up = 0;
  let down = 0;
  for (let i = 1; i < vals.length; i += 1) {
    if (vals[i] > vals[i - 1] + 1e-6) up += 1;
    if (vals[i] < vals[i - 1] - 1e-6) down += 1;
  }
  assert.ok(up > 2 && down > 2, `salınım yok: ${up} artış, ${down} azalış`);
  assert.ok(Math.max(...vals) <= 1.0001, 'kalkma 1 üstüne çıkmamalı');
});

test('curlAmount her sahne süresinde ORANI korur (sabit saniye değil)', () => {
  const {curlAmount} = mod;
  // 3.6 sn'lik kısa bir beat'te de kalkma sahnenin %70'inde başlamalı.
  // Sabit saniye yazılsaydı kısa sahnede hiç görünmezdi — `negationCue`'da
  // ölçülen hatanın aynısı.
  for (const secs of [3.6, 6, 10]) {
    assert.equal(curlAmount(secs * 0.6 * 30, secs, 30, 0.7), 0, `${secs}s: erken kalkma`);
    const late = curlAmount(secs * 0.9 * 30, secs, 30, 0.7);
    assert.ok(late > 0.2, `${secs}s: geç fazda kalkma yok (${late})`);
  }
});
