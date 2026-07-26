/**
 * V3 AKTİF GÖRSEL KATMANI — §5 overlay/odak, §8 taraf kimliği,
 * §9 prompt çelişkileri, §10 bağlama duyarlı negatif, §16 fallback merdiveni.
 *
 * Hepsi brain-vs-ai-memory çıktısında ölçülmüş somut kusurlara karşılık gelir:
 * ekran %99 statik, tüm sahneler aynı mavi palette, prompt kendi kendisiyle
 * çelişiyor, "human face" istenen sahnede yasaklı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { actorEvents, buildActorAss, applyOverlayBudget, ACTOR_TYPES } from '../src/visual/actors.js';
import { beatToActors } from '../src/visual/beatToActors.js';
import { planWithFallback, summarizeLadder, LADDER } from '../src/visual/fallbackLadder.js';
import {
  applySideIdentity, detectSidePair, sideOfScene, SIDE_IDENTITIES,
} from '../src/visual/sideIdentity.js';
import {
  applyPromptStyle, resolveContradictions, styleForScript,
} from '../src/crew/promptStyle.js';
import { contextualForbidden } from '../src/crew/subjectBible.js';

// ---------------- §5 OVERLAY: HEDEFSİZ ÇİZİLMEZ ----------------
test('hedefi olmayan işaret overlay\'i çizilmez', () => {
  // ANA KURAL: "izleyici şu anda tam olarak nereye ve neden bakmalı?"
  // Cevabı olmayan overlay render edilmez — rastgele dekorasyon yok.
  for (const type of ['arrow_pointer', 'focus_box', 'spotlight']) {
    assert.deepEqual(actorEvents({ type, start: 0, end: 3 }), [], `${type} hedefsiz çizdi`);
  }
});

test('yeni overlay tipleri gerçek ASS üretir', () => {
  const cases = {
    arrow_pointer: { at: [0.6, 0.5] },
    focus_box: { at: [0.5, 0.5] },
    spotlight: { at: [0.5, 0.5] },
    card_dissolve: { at: [0.5, 0.5], count: 9, keep: 3 },
    piece_fill: { at: [0.5, 0.5], slots: 4 },
    block_grid: { at: [0.5, 0.46] },
    link_burst: { at: [0.5, 0.46], nodes: 4 },
    scan_line: {},
  };
  for (const [type, extra] of Object.entries(cases)) {
    const ev = actorEvents({ type, start: 0, end: 4, ...extra });
    assert.ok(ev.length > 0, `${type} boş`);
    const joined = ev.join('');
    assert.ok(!joined.includes('undefined'), `${type}: undefined sızdı`);
    assert.ok(!joined.includes('NaN'), `${type}: NaN sızdı`);
    assert.ok(joined.includes('Dialogue:'), `${type}: ASS satırı değil`);
  }
});

test('kart eritme GERÇEKTEN azalma gösterir (kalanlar durur, gidenler söner)', () => {
  const ev = actorEvents({ type: 'card_dissolve', at: [0.5, 0.5], count: 10, keep: 3, start: 0, end: 5 });
  // Kalan kartlar sahne sonuna kadar durmalı; elenenler daha erken bitmeli.
  const ends = ev.map((line) => line.split(',')[2]);
  const uniqueEnds = new Set(ends);
  assert.ok(uniqueEnds.size >= 2, `bütün kartlar aynı anda bitiyor — azalma görünmez: ${[...uniqueEnds]}`);
});

test('yeniden kurmada SON parça farklı renkte (tahmin olduğu görünür)', () => {
  const ev = actorEvents({ type: 'piece_fill', at: [0.5, 0.5], slots: 4, start: 0, end: 5 });
  const joined = ev.join('\n');
  // Tahmin rengi (amber) en az bir kez geçmeli — dürüstlük görselde de var.
  assert.ok(/F0A72B|2BA7F0/i.test(joined) || joined.includes('\\1c'),
    'tahmin parçası ayırt edilmiyor');
});

// ---------------- §5 OVERLAY BÜTÇESİ ----------------
test('aynı anda iki ANA overlay olmaz', () => {
  const { kept, dropped } = applyOverlayBudget([
    { type: 'card_dissolve', start: 0, end: 4 },
    { type: 'block_grid', start: 1, end: 5 },     // çakışıyor → düşmeli
    { type: 'link_burst', start: 6, end: 9 },     // çakışmıyor → kalmalı
  ]);
  assert.equal(kept.length, 2, JSON.stringify(kept.map((k) => k.type)));
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].reason, /ANA/);
});

test('ANA + YARDIMCI aynı anda olabilir (biri anlatır, biri yönlendirir)', () => {
  const { kept, dropped } = applyOverlayBudget([
    { type: 'card_dissolve', start: 0, end: 4 },
    { type: 'focus_box', start: 1, end: 4 },
  ]);
  assert.equal(kept.length, 2, JSON.stringify(dropped));
  assert.deepEqual(dropped, []);
});

test('aynı anda iki YARDIMCI de olmaz (ekran okunmaz olur)', () => {
  const { kept, dropped } = applyOverlayBudget([
    { type: 'focus_box', start: 0, end: 4 },
    { type: 'spotlight', start: 1, end: 4 },
  ]);
  assert.equal(kept.length, 1);
  assert.match(dropped[0].reason, /YARDIMCI/);
});

test('bütçe buildActorAss içinde GERÇEKTEN uygulanır', () => {
  const crowded = [
    { type: 'card_dissolve', at: [0.5, 0.5], start: 0, end: 4 },
    { type: 'block_grid', at: [0.5, 0.5], start: 0.5, end: 4 },
    { type: 'link_burst', at: [0.5, 0.5], start: 1, end: 4 },
  ];
  const withBudget = buildActorAss(crowded, { budget: true });
  const without = buildActorAss(crowded, { budget: false });
  const count = (a) => a.split('\n').filter((l) => l.startsWith('Dialogue')).length;
  assert.ok(count(withBudget) < count(without),
    `bütçe uygulanmadı: ${count(withBudget)} vs ${count(without)}`);
});

// ---------------- §4 ŞABLONLAR GERÇEKTEN ÇİZİYOR ----------------
test('dört V3 şablonu odak OLMADAN da aktör üretir', () => {
  // Kaçışın kaynağı buydu: focusDetect ölçemeyince sahne dekoratif kalıyordu.
  for (const template of ['filtering', 'reconstruct', 'retrieval', 'emotion_link']) {
    const a = beatToActors({ kind: 'story', template, payload: {}, start: 0, end: 4 });
    assert.ok(a.length > 0, `${template} odaksız hiçbir şey üretmedi`);
  }
});

test('karşılaştırma iki tarafı SIRAYLA işaretler', () => {
  const a = beatToActors({ kind: 'story', template: 'comparison', payload: {}, start: 0, end: 6 });
  assert.equal(a.length, 2);
  assert.ok(a[0].at[0] < 0.5 && a[1].at[0] > 0.5, JSON.stringify(a.map((x) => x.at)));
  assert.ok(a[0].end <= a[1].start + 0.01, 'iki kutu aynı anda — göz nereye bakacağını bilemez');
});

// ---------------- §16 FALLBACK MERDİVENİ ----------------
test('şablon aktörü varsa en üst basamak', () => {
  const r = planWithFallback({ actors: [{ type: 'card_dissolve' }], start: 0, end: 4 });
  assert.equal(r.rung, 'semantic_diagram');
});

test('aktör yoksa merdivenden inilir ama ASLA boş kalmaz', () => {
  const both = planWithFallback({ actors: [], side: 'both', start: 0, end: 4 });
  assert.equal(both.rung, 'split_screen');
  assert.ok(both.actors.length);

  const oneSide = planWithFallback({ actors: [], side: 'ai', start: 0, end: 4 });
  assert.equal(oneSide.rung, 'before_after');
  assert.ok(oneSide.actors.length);

  const focused = planWithFallback({ actors: [], focus: { x: 0.6, y: 0.5 }, start: 0, end: 4 });
  assert.equal(focused.rung, 'labels_arrows');
  assert.ok(focused.actors.some((a) => a.type === 'arrow_pointer'));

  const bare = planWithFallback({ actors: [], start: 0, end: 4 });
  assert.equal(bare.rung, 'crop_focus');
  assert.ok(bare.actors.length);
});

test('çok kısa sahne en alt basamakta kalır ve bunu SÖYLER', () => {
  const r = planWithFallback({ actors: [], start: 0, end: 1.2 });
  assert.equal(r.rung, 'ken_burns');
  assert.deepEqual(r.actors, []);
  // Sessizce boş dönmek yerine sebebini yazar — raporun dürüstlüğü buradan gelir.
  assert.ok(r.reason.length > 10, r.reason);
});

test('merdiven özeti aktif sahne oranını verir', () => {
  const s = summarizeLadder([
    { rung: 'semantic_diagram' }, { rung: 'labels_arrows' },
    { rung: 'ken_burns' }, { rung: 'ken_burns' },
  ]);
  assert.equal(s.activeSceneShare, 0.5);
  assert.equal(s.plainSceneCount, 2);
  assert.equal(LADDER[LADDER.length - 1], 'ken_burns');
});

test('merdivenin ürettiği her aktör tipi GERÇEKTEN render edilebilir', () => {
  // Merdiven var olmayan bir tip üretirse sahne sessizce boş kalırdı.
  const all = [
    planWithFallback({ actors: [], side: 'both', start: 0, end: 4 }),
    planWithFallback({ actors: [], side: 'ai', start: 0, end: 4 }),
    planWithFallback({ actors: [], focus: { x: 0.5, y: 0.5 }, start: 0, end: 4 }),
    planWithFallback({ actors: [], start: 0, end: 4 }),
  ].flatMap((r) => r.actors);
  for (const a of all) {
    assert.ok(ACTOR_TYPES.includes(a.type), `merdiven bilinmeyen tip üretti: ${a.type}`);
    assert.ok(actorEvents({ ...a }).length > 0, `${a.type} render edilemedi`);
  }
});

// ---------------- §8 TARAF RENK KİMLİĞİ ----------------
test('insan/AI karşılaştırması tespit edilir', () => {
  const pair = detectSidePair({
    topic: 'Brain vs AI memory',
    scenes: [{ narration: 'The human brain forgets details.' }, { narration: 'AI systems store records.' }],
  });
  assert.deepEqual(pair, { a: 'human', b: 'ai' });
});

test('karşılaştırma OLMAYAN konuya kimlik uygulanmaz', () => {
  // Bir doğa belgeseline zorla "HUMAN vs AI" rengi vermek anlamsız olurdu.
  const pair = detectSidePair({
    topic: 'How hummingbirds hover',
    scenes: [{ narration: 'The bird beats its wings 80 times a second.' }],
  });
  assert.equal(pair, null);
});

test('her sahne kendi tarafının rengini alır', () => {
  const script = {
    topic: 'Brain vs AI memory',
    scenes: [
      { narration: 'The human brain reconstructs memories.', image_prompt: 'BASE' },
      { narration: 'AI retrieves stored records exactly.', image_prompt: 'BASE' },
      { narration: 'Neither the human brain nor AI stores the same way.', image_prompt: 'BASE' },
    ],
  };
  const r = applySideIdentity(script);
  assert.equal(script.scenes[0].side, 'human');
  assert.equal(script.scenes[0].sideAccent, SIDE_IDENTITIES.human.accent);
  assert.equal(script.scenes[1].side, 'ai');
  assert.equal(script.scenes[1].sideAccent, SIDE_IDENTITIES.ai.accent);
  // İki taraf da geçen sahne tek renge boyanmaz — o sahne karşılaştırmanın kendisi.
  assert.equal(script.scenes[2].side, 'both');
  assert.equal(script.scenes[2].sideAccent, null);
  assert.match(script.scenes[2].image_prompt, /Left side.*Right side/s);
  assert.ok(r.scenesTouched >= 3);
});

test('renk kimliği prompt\'a DOKU dilini de yazar (daltonik izleyici)', () => {
  // Yalnızca renk değiştirmek yetmez: doku ve geometri de ayrışmalı.
  assert.match(SIDE_IDENTITIES.human.promptStyle, /organic|soft|irregular/i);
  assert.match(SIDE_IDENTITIES.ai.promptStyle, /sharp|geometry|grid/i);
});

// ---------------- §9 PROMPT ÇELİŞKİLERİ ----------------
test('kategori izin verdiği şeyi yasaklamaz', () => {
  const { kept, removed } = resolveContradictions(
    ['modern devices', 'holograms', 'medieval objects'],
    ['modern devices', 'holographic interface'],
  );
  assert.ok(removed.includes('modern devices'));
  assert.ok(removed.includes('holograms'), `kök eşleşmesi kaçtı: ${JSON.stringify(kept)}`);
  assert.ok(kept.includes('medieval objects'));
});

test('GERÇEK ÇELİŞKİ: "futuristic control room" + "no modern devices"', () => {
  const script = {
    topic: 'Brain vs AI memory',
    scenes: [{
      narration: 'AI retrieves stored records.',
      image_prompt: 'a futuristic control room',
      negative_prompt: 'modern devices, holograms, text',
    }],
  };
  const r = applyPromptStyle(script);
  assert.equal(r.style, 'science_future');
  assert.ok(r.contradictionsRemoved.includes('modern devices'));
  assert.ok(!script.scenes[0].negative_prompt.includes('modern devices'));
  assert.ok(!script.scenes[0].negative_prompt.includes('holograms'));
  // Konuyla alakasız yasaklar KALMALI: gevşetme her şeyi serbest bırakmak değil.
  assert.match(script.scenes[0].negative_prompt, /medieval|historical/);
});

test('tarih konusunda modern cihaz yasağı KALIR', () => {
  const script = {
    topic: 'Roman aqueducts',
    scenes: [{ narration: 'Romans built stone channels.', image_prompt: 'a stone aqueduct', negative_prompt: '' }],
  };
  applyPromptStyle(script);
  assert.match(script.scenes[0].negative_prompt, /modern devices/);
  assert.match(script.scenes[0].negative_prompt, /holograms/);
});

test('kategori bulunamazsa nötr taban kullanılır (uydurma stil yok)', () => {
  const s = styleForScript({ topic: 'Something entirely unclassifiable zzz', scenes: [] });
  assert.equal(s.key, 'neutral');
  assert.deepEqual(s.allow, []);
});

// ---------------- §10 BAĞLAMA DUYARLI NEGATİF ----------------
test('insan isteyen sahnede "human face" YASAKLANMAZ', () => {
  const bible = { forbiddenTraits: ['fantasy creature', 'text'] };
  const withHuman = contextualForbidden(bible, 'A scientist studies a hologram');
  assert.ok(!withHuman.includes('human face'), JSON.stringify(withHuman));
  // Onun yerine BOZUK yüz yasaklanır.
  assert.ok(withHuman.includes('distorted face'));
  assert.ok(withHuman.includes('malformed hands'));
});

test('insan içermeyen sahnede "human face" yasaklanır', () => {
  const bible = { forbiddenTraits: ['fantasy creature'] };
  const noHuman = contextualForbidden(bible, 'A hummingbird hovers near a flower');
  assert.ok(noHuman.includes('human face'), JSON.stringify(noHuman));
  assert.ok(!noHuman.includes('distorted face'));
});

test('konu öznesi insansa yine bağlam insanlı sayılır', () => {
  const bible = { canonicalName: 'human brain', forbiddenTraits: [] };
  const r = contextualForbidden(bible, 'Memories fade over time');
  assert.ok(!r.includes('human face'), JSON.stringify(r));
});

// ---------------- GERÇEK RENDER KANITI ----------------
test('yeni overlay katmanı GERÇEK videoya biner (SSIM farkı ölçülür)', async () => {
  // ASS'in sözdizimsel olarak geçerli olması yetmez: libass onu ÇİZMELİ.
  // Daha önce `\fscx` ile ölçeklenen çizimlerin `\pos` etrafında büyümediği
  // tam böyle bir kanıt render'ıyla bulunmuştu.
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const run2 = promisify(execFile);
  const ok = await run2('ffmpeg', ['-version']).then(() => true).catch(() => false);
  if (!ok) return;

  const dir = await mkdtemp(path.join(os.tmpdir(), 'v3-overlay-'));
  try {
    const ass = buildActorAss([
      { type: 'card_dissolve', at: [0.5, 0.5], count: 9, keep: 3, start: 0, end: 3 },
      { type: 'focus_box', at: [0.3, 0.35], start: 0.5, end: 3 },
    ], { width: 360, height: 640 });
    assert.ok(ass, 'ASS üretilmedi');
    const assPath = path.join(dir, 'a.ass');
    await writeFile(assPath, ass);

    const plain = path.join(dir, 'plain.mp4');
    const withOverlay = path.join(dir, 'over.mp4');
    await run2('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'color=c=0x203040:s=360x640:d=3:r=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', plain]);
    await run2('ffmpeg', ['-y', '-v', 'error', '-i', plain,
      '-vf', `ass=${assPath.replace(/([:\\])/g, '\\$1')}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', withOverlay]);

    // SSIM 1.0 = hiç fark yok = overlay ÇİZİLMEDİ.
    const { stderr } = await run2('ffmpeg', ['-v', 'info', '-i', plain, '-i', withOverlay,
      '-lavfi', 'ssim', '-f', 'null', '-'], { maxBuffer: 10 * 1024 * 1024 })
      .catch((e) => ({ stderr: e.stderr || '' }));
    const m = /All:([\d.]+)/.exec(stderr || '');
    assert.ok(m, `SSIM okunamadı: ${String(stderr).slice(-200)}`);
    assert.ok(Number(m[1]) < 0.995,
      `overlay ekranda görünmüyor (SSIM ${m[1]}) — ASS geçerli ama libass çizmiyor`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---------------- §6 GÖRSEL DEĞİŞİM TEMPOSU ----------------
test('sabit ekran YAVAŞ tempo uyarısı verir, hareketli ekran vermez', async () => {
  const { validateFinalVideo } = await import('../src/pipeline/finalVideoValidator.js');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const run2 = promisify(execFile);
  if (!await run2('ffmpeg', ['-version']).then(() => true).catch(() => false)) return;

  const dir = await mkdtemp(path.join(os.tmpdir(), 'v3-cadence-'));
  try {
    // Tamamen sabit 8 saniye: ekran hiç değişmiyor.
    const still = path.join(dir, 'still.mp4');
    await run2('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'color=c=0x203040:s=180x320:d=8:r=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', still]);
    const a = await validateFinalVideo(still, { duration: 8, clips: [] }, { fps: 2 });
    assert.ok(a.warnings.some((w) => w.startsWith('SLOW_VISUAL_CADENCE')),
      `sabit ekran uyarı üretmedi: ${JSON.stringify(a.warnings)}`);
    assert.ok(a.meanChangeIntervalSeconds >= 1.8, String(a.meanChangeIntervalSeconds));

    // Sürekli değişen gradyan: tempo hedefin içinde.
    const moving = path.join(dir, 'moving.mp4');
    await run2('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi',
      '-i', 'testsrc2=s=180x320:d=8:r=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', moving]);
    const b = await validateFinalVideo(moving, { duration: 8, clips: [] }, { fps: 2 });
    assert.ok(!b.warnings.some((w) => w.startsWith('SLOW_VISUAL_CADENCE')),
      `hareketli ekran yanlış uyarı verdi: ${JSON.stringify(b.warnings)}`);
    assert.ok(b.perceptibleChangeCount > a.perceptibleChangeCount);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// ---------------- CANLI ÇIKTIDAN ÖĞRENİLENLER (fungal-networks) ----------------
test('DAİRELER GERÇEKTEN DAİRE: genişlik/yükseklik oranı 1', () => {
  // GERÇEK HATA: circlePath kontrol noktalarını cy∓k'ya koyuyordu. Yarım
  // daireyi tek kübik Bézier ile çizerken bu yanlıştır — eğri t=0.5'te yalnızca
  // 0.75k yükselir, yani şekil 2k genişliğinde ama 1.5k yüksekliğinde bir
  // ELİPS olur. Canlı önizlemede camgöbeği "daireler" gözle görülür yayvandı
  // ve sistemdeki BÜTÜN daireler (halka, düğüm, nabız) bunu taşıyordu.
  const ev = actorEvents({ type: 'ring', at: [0.5, 0.5], radius: 0.1, start: 0, end: 3 });
  const draw = ev.map((l) => l.slice(l.indexOf('}') + 1)).find((d) => d.startsWith('m '));
  assert.ok(draw, 'çizim yolu bulunamadı');
  // "m x0 y b c1x c1y c2x c2y x1 y ..." — kontrol ofseti yarıçapın 4/3'ü olmalı.
  const n = draw.replace(/[a-z{}\\/]/gi, ' ').trim().split(/\s+/).map(Number).filter(Number.isFinite);
  const [x0, y0, , c1y, , , x1] = n;
  const rx = Math.abs(x1 - x0) / 2;
  const ctrlOffset = Math.abs(y0 - c1y);
  // Bézier tepe noktası = (P0+3P1+3P2+P3)/8 → ofset*0.75 = gerçek yükseklik.
  const ry = ctrlOffset * 0.75;
  assert.ok(Math.abs(rx - ry) / rx < 0.05,
    `daire elips çiziyor: yatay ${rx}px, dikey ${ry.toFixed(1)}px`);
});

test('link_burst merkezi DOLU DİSK değil, içi boş halka', () => {
  // Canlı önizlemede orman fotoğrafının ortasında ~124 piksellik opak
  // camgöbeği bir leke vardı: hiçbir şey anlatmayan dekorasyon.
  const ev = actorEvents({ type: 'link_burst', at: [0.5, 0.46], nodes: 4, start: 0, end: 4 });
  const center = ev[0];
  assert.match(center, /\\1a&HFF&/, `merkez dolu çiziliyor: ${center.slice(0, 120)}`);
  assert.match(center, /\\bord\d/, 'merkezin kenarlığı yok — görünmez olur');
});

test('hook penceresinde overlay çizilmez (ekran zaten dolu)', () => {
  // Canlı önizleme-hook: 0.5s'te AYNI ANDA hook başlığı + altyazı + halka.
  const { kept, dropped } = applyOverlayBudget([
    { type: 'link_burst', start: 0.2, end: 4 },
    { type: 'card_dissolve', start: 5, end: 8 },
  ], { reservedWindows: [[0, 2.8]] });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].type, 'card_dissolve');
  assert.match(dropped[0].reason, /ayrılmış pencere/);
});

test('odak kadrajın üst şeridine kilitlenirse anlatı bandına çekilir', async () => {
  // Canlı: focusDetect güneş huzmesine kilitlendi (y=0.189) ve sinyal dalgası
  // boş gökyüzünden yayıldı.
  const a = beatToActors({
    kind: 'story', template: 'communication', payload: {},
    start: 0, end: 4, focus: { x: 0.382, y: 0.189, confidence: 1.72 },
  });
  assert.equal(a.length, 1);
  assert.ok(a[0].at[1] >= 0.28, `overlay hâlâ gökyüzünde: y=${a[0].at[1]}`);
});

test('"trees share nutrients" aktarım eylemidir, atmosphere olamaz', async () => {
  const { activeTemplateFor } = await import('../src/crew/storyPlanner.js');
  assert.equal(activeTemplateFor('Trees share nutrients with each other through this connection.'), 'flow');
});

test('sahnenin KENDİ promptuyla çelişen negatif terim kaldırılır', () => {
  // Canlı sahne 9: pozitif "animals moving freely", negatif "animal anatomy".
  const script = {
    topic: 'Fungal Networks', category: 'nature',
    scenes: [{
      narration: 'This hidden network supports life.',
      image_prompt: 'A wide shot of a thriving forest with animals moving freely',
      negative_prompt: 'animal anatomy, fantasy creature',
    }],
  };
  const r = applyPromptStyle(script);
  assert.ok(r.contradictionsRemoved.includes('animal anatomy'), JSON.stringify(r));
  assert.ok(!script.scenes[0].negative_prompt.includes('animal anatomy'));
  assert.ok(script.scenes[0].negative_prompt.includes('fantasy creature'));
});

test('ortak stil eki artık konuya özel kısıt TAŞIMAZ', async () => {
  // Canlı manifest: mantar ağları hakkındaki DOĞA videosunun her promptunda
  // "no astronauts" ve "no modern devices in historical scenes" yazıyordu.
  const { config } = await import('../src/config.js');
  for (const suffix of [config.images.styleSuffix, config.images.animatedStyleSuffix]) {
    assert.ok(!/astronaut/i.test(suffix), `ortak ek hâlâ konuya özel: ${suffix.slice(-90)}`);
    assert.ok(!/historical scenes|historically accurate/i.test(suffix), suffix.slice(-90));
    assert.ok(!/futuristic/i.test(suffix), suffix.slice(-90));
    // Her koşulda geçerli olanlar KALMALI.
    assert.match(suffix, /no text/);
    assert.match(suffix, /no watermark/);
  }
});

test('kapalı/yeraltı sahnesine "golden hour light" eklenmez', () => {
  const script = {
    topic: 'Fungal Networks', category: 'nature',
    scenes: [{
      narration: 'a',
      image_prompt: 'A medium shot of tree roots intertwined with mycelium underground, soft lighting',
      negative_prompt: '',
    }],
  };
  applyPromptStyle(script);
  assert.ok(!/golden hour/i.test(script.scenes[0].image_prompt),
    `yeraltı sahnesine altın saat ışığı eklendi: ${script.scenes[0].image_prompt.slice(-80)}`);
});
