/**
 * V3 Faz 3b/3c/3d — 14 şablonluk hikâye kütüphanesi, yeni aktörler ve
 * şablon farkındalı köprü.
 *
 * Bu dosyanın koruduğu asıl iddia: audit'in "sahnede olay yok, sadece kamera
 * hareketi var" tespiti, sınıflandırıcının 5 beat türünün 14 hikâyeyi
 * karşılamamasından kaynaklanıyordu. "hidden", "spreads", "warns" gibi
 * cümleler hiçbir beat'e girmiyor, sahne dekoratif kalıyordu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planScene, planVisualStory, extractTimeMarks, STORY_TEMPLATES } from '../src/crew/storyPlanner.js';
import { beatToActors, planActors, FOCUS_TEMPLATES } from '../src/visual/beatToActors.js';
import { actorEvents } from '../src/visual/actors.js';
import { selectSceneMotion } from '../src/video/motionPlan.js';
import { assessVisualNarration } from '../src/pipeline/visualNarrationQC.js';
import { shotLadder } from '../src/media/generateImages.js';

const FOCUS = { x: 0.62, y: 0.48, confidence: 2.1 };

// ---------------- ŞABLON KÜTÜPHANESİ 14'E TAMAMLANDI ----------------
test('audit §3.2\'deki altı eksik şablon anlatımdan seçilir', () => {
  const cases = {
    chain_reaction: 'One alarm spreads through the whole colony in seconds',
    cause_effect: 'The rising heat triggers the whole cycle',
    communication: 'A single guard signals the rest of the nest',
    navigation: 'It finds its way home across sixty kilometres',
    problem_solution: 'The tunnel floods, so the workers get around it',
  };
  for (const [expected, narration] of Object.entries(cases)) {
    assert.equal(planScene({ narration }).story_template, expected, narration);
  }
});

test('timeline yalnızca GERÇEK iki zaman noktası varsa seçilir', () => {
  // Dayanağı olan: iki yıl geçiyor.
  assert.equal(planScene({ narration: 'Between 1969 and 2024 the colony doubled' }).story_template,
    'timeline');
  // Dayanağı olmayan: tek yıl → eksen çizilecek veri yok, şablon zorlanmaz.
  assert.notEqual(planScene({ narration: 'It was first described in 1969' }).story_template,
    'timeline');
});

test('zaman işaretleri uydurulmaz, metinden çıkarılır', () => {
  assert.deepEqual(extractTimeMarks('from 1969 to 2024'), [{ label: '1969' }, { label: '2024' }]);
  assert.equal(extractTimeMarks('a quiet afternoon').length, 0);
  assert.equal(extractTimeMarks('30 years later, after 200 years of silence').length, 2);
});

test('şablon kütüphanesi 14 hikâye + sayım + dolgu + 4 V3 aktif şablonu', () => {
  assert.equal(STORY_TEMPLATES.length, 20);
  for (const t of ['communication', 'cause_effect', 'chain_reaction', 'timeline',
    'navigation', 'problem_solution']) {
    assert.ok(STORY_TEMPLATES.includes(t), `${t} eksik`);
  }
  // V3 (§4): eylem anlatan cümlelerin gideceği yer.
  for (const t of ['filtering', 'reconstruct', 'retrieval', 'emotion_link']) {
    assert.ok(STORY_TEMPLATES.includes(t), `V3 şablonu eksik: ${t}`);
  }
});

// ---------------- DEKORATİF KALAN SAHNE HATASI ----------------
test('override ile seçilen şablon artık AKTÖR beat\'i taşır (dekoratif kalmaz)', () => {
  // Eskiden: classifyBeat sessiz kalınca story_beat null oluyordu; sahnede
  // yalnızca kamera hareketi kalıyordu — audit'in 1. ve 2. maddesi.
  const s = { narration: 'The insect stays hidden against the bark', image_prompt: 'x' };
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'search_reveal');
  assert.ok(s.story_beat, 'şablon seçildi ama aktör beat\'i taşınmadı');
  assert.equal(s.story_beat.template, 'search_reveal');
  const actors = beatToActors({ ...s.story_beat, start: 0, end: 4, focus: FOCUS });
  assert.ok(actors.some((a) => a.type === 'ring'), JSON.stringify(actors));
});

// ---------------- ŞABLONA ÖZGÜ KOREOGRAFİ ----------------
test('her yeni şablon kendi aktörünü üretir', () => {
  const mk = (template, extra = {}) => beatToActors({
    kind: 'story', template, payload: {}, start: 0, end: 4, focus: FOCUS, ...extra,
  });
  assert.ok(mk('communication').some((a) => a.type === 'signal_wave'));
  assert.ok(mk('chain_reaction').some((a) => a.type === 'spread'));
  assert.ok(mk('cause_effect').some((a) => a.type === 'flow_arrow'));
  assert.ok(mk('navigation').some((a) => a.type === 'walker'));
  assert.ok(mk('problem_solution').some((a) => a.type === 'ring'));
  assert.ok(mk('construction').some((a) => a.type === 'build_up'));
  const tl = beatToActors({ kind: 'story', template: 'timeline', start: 0, end: 4,
    payload: { marks: [{ label: '1969' }, { label: '2024' }] } });
  assert.ok(tl.some((a) => a.type === 'axis'));
});

// ---------------- BELGENİN AMİRAL ÖRNEĞİ ----------------
test('mekanizma sahnesi kesitte AKIŞ çizer (sıcak yukarı, soğuk aşağı)', () => {
  const s = { narration: 'Warm air rises through the interior chambers and cool air sinks back',
    image_prompt: 'a mound' };
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'mechanism');
  assert.equal(s.story_beat.payload.flow, 'thermal');
  const made = beatToActors({ ...s.story_beat, start: 0, end: 5, focus: FOCUS });
  const arrows = made.filter((a) => a.type === 'flow_arrow');
  assert.equal(arrows.length, 2, JSON.stringify(made.map((a) => a.type)));
  assert.equal(arrows[0].temp, 'hot');
  assert.equal(arrows[1].temp, 'cold');
  // Sıcak YUKARI gider (hedef y kaynaktan küçük), soğuk AŞAĞI.
  assert.ok(arrows[0].to[1] < arrows[0].from[1], 'sıcak hava yukarı çıkmıyor');
  assert.ok(arrows[1].to[1] > arrows[1].from[1], 'soğuk hava aşağı inmiyor');
  // Sırayla belirirler: sahne içinde bir olay DİZİSİ yaşanır.
  assert.ok(arrows[1].start > arrows[0].start, 'iki ok aynı anda beliriyor');
});

test('akıştan söz etmeyen "inside" cümlesine ok çizilmez', () => {
  // "inside" geçen her cümleye hava akışı oku koymak, olmayan bir iddiada
  // bulunmaktı — konum uydurmanın akış hâli.
  const s = { narration: 'The chamber inside stays completely dry', image_prompt: 'x' };
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'mechanism');
  assert.equal(s.story_beat, null, 'dayanaksız akış oku üretildi');
});

test('konum ÖLÇÜLMEDİYSE aktör üretilmez (uydurma konum yasağı)', () => {
  for (const template of ['communication', 'chain_reaction', 'cause_effect',
    'navigation', 'problem_solution', 'search_reveal']) {
    const made = beatToActors({ kind: 'story', template, payload: {}, start: 0, end: 4 });
    assert.deepEqual(made, [], `${template}: ölçüm yokken aktör uydurdu`);
  }
});

test('zaman ekseni işaretsiz çizilmez', () => {
  assert.deepEqual(
    beatToActors({ kind: 'story', template: 'timeline', payload: { marks: [{ label: '1969' }] }, start: 0, end: 4 }),
    [],
  );
});

test('FOCUS_TEMPLATES yalnızca konum gerektirenleri içerir', () => {
  assert.ok(FOCUS_TEMPLATES.has('communication'));
  assert.ok(!FOCUS_TEMPLATES.has('timeline'), 'eksen konum ölçümü istemiyor — boşuna maliyet');
});

test('planActors istatistiği şablon adıyla raporlar', () => {
  const { stats } = planActors([
    { kind: 'story', template: 'chain_reaction', payload: {}, start: 0, end: 4, focus: FOCUS },
  ]);
  assert.equal(stats.actorScenes, 1);
  assert.ok(stats.byKind.chain_reaction, JSON.stringify(stats.byKind));
  assert.equal(stats.byActor.spread, 1, 'ekranda çizilen aktör türü raporlanmıyor');
});

test('şablon koreografisi beat sınıfını EZER', () => {
  // "build a tower" cümlesi sınıflandırıcıda davranış (hareket fiili) olarak
  // geçiyordu; kamera "yüksel" derken aktör yürüme izi çiziyordu. Şablon
  // koreografisi öncelikli olduğu için artık ikisi aynı hikâyeyi anlatır.
  const made = beatToActors({ kind: 'behavior', template: 'construction',
    payload: {}, start: 0, end: 4, focus: FOCUS });
  assert.ok(made.some((a) => a.type === 'build_up'), JSON.stringify(made.map((a) => a.type)));
  assert.ok(!made.some((a) => a.type === 'walker'));
});

// ---------------- MERKEZ KİLİDİ (kanıt render'ının bulduğu hata) ----------------
test('büyüyen halkalar \\fscx ile DEĞİL gerçek yarıçapla çizilir', () => {
  // Kanıt render'ı: libass bir çizimi \fscx ile ölçeklerken şekil \pos
  // etrafında büyümüyor; %400'lük dalga öznenin epeyce soluna/üstüne kayıyordu.
  // "Daire nesnenin üstünde değil" şikâyetinin kaynağı buydu.
  for (const a of [
    { type: 'ring', at: [0.5, 0.5], start: 0, end: 4 },
    { type: 'signal_wave', at: [0.5, 0.5], start: 0, end: 4 },
  ]) {
    const joined = actorEvents(a).join('\n');
    assert.ok(!/\\fscx/.test(joined), `${a.type}: ölçekleme hâlâ kullanılıyor`);
    assert.ok(/\\an7\\pos\(0,0\)/.test(joined), `${a.type}: mutlak koordinat kullanılmıyor`);
  }
});

test('halka gerçekten hedefin ETRAFINDA (merkez kayması yok)', () => {
  const ev = actorEvents({ type: 'ring', at: [0.5, 0.4], start: 0, end: 4 });
  // Her çizimin x uçları merkezden simetrik olmalı: (min+max)/2 ≈ 540.
  for (const line of ev) {
    const nums = [...line.matchAll(/[ml]\s+(-?\d+)\s+(-?\d+)/g)].map((m) => Number(m[1]));
    if (nums.length < 2) continue;
    const mid = (Math.min(...nums) + Math.max(...nums)) / 2;
    assert.ok(Math.abs(mid - 540) < 12, `merkez ${mid} — hedeften kaymış`);
  }
});

// ---------------- KAMERA DİLİ ----------------
test('yeni motivasyonlar kamerayı belirler, gerekçe kaydedilir', () => {
  const m = (motivation, index = 1) => selectSceneMotion(
    { camera_plan: { motivation } }, { type: 'image' }, { previous: [], index },
  );
  assert.equal(m('widen-with-the-spread').type, 'slow-pull-out');
  assert.equal(m('hold-the-timeline').type, 'static-hold', 'eksen okunurken kamera durmalı');
  assert.equal(m('tight-then-wide').reason, 'story:tight-then-wide');
  assert.ok(['pan-left-to-right', 'pan-right-to-left'].includes(m('follow-the-route').type));
});

test('ilk klip hikâye gerekçesine rağmen zoom 1\'den başlar (loop kapanışı)', () => {
  // Loop karesi sabit duruyor; ilk klip yakın kadrajdan başlarsa dikiş tutmaz.
  const first = selectSceneMotion(
    { camera_plan: { motivation: 'widen-with-the-spread' } }, { type: 'image' },
    { previous: [], index: 0 },
  );
  assert.equal(first.type, 'slow-push-in', 'ilk klip geriye çekilerek başlıyor — loop bozulur');
  assert.equal(first.reason, 'story:widen-with-the-spread', 'gerekçe kaybolmuş');
});

// ---------------- MİKRO PLAN MERDİVENİ ----------------
test('yeni şablonların kendi kadraj merdiveni var', () => {
  assert.ok(shotLadder('chain_reaction', 6).length >= 1);
  // Yayılım: dar başla, geniş bitir.
  const cr = shotLadder('chain_reaction', 6);
  assert.ok(cr[cr.length - 1].z > cr[0].z, 'yayılım kadrajı genişlemiyor');
  // Eksen alt üçlükte: kadraj sabit kalmalı.
  assert.equal(shotLadder('timeline', 6)[0].motion, 'static-hold');
});

// ---------------- QC PAYDA REGRESYONU ----------------
test('aktör oranı KLİP değil SAHNE sayısına bölünür', () => {
  // Faz 4 bir sahneyi 3 klibe bölüyor; aktör sahne başına planlanıyor.
  // Klibe bölmek oranı yapay olarak üçte birine düşürüp her videoda yanlış
  // uyarı üretiyordu.
  const items = [];
  for (let s = 0; s < 10; s += 1) {
    for (let p = 0; p < 3; p += 1) items.push({ scene: s, assetId: `a${s}-${p}` });
  }
  const r = assessVisualNarration({
    items,
    beats: [],
    motionPlan: new Array(30).fill({ type: 'slow-push-in' }),
    duration: 44,
    scenes: new Array(10).fill({ story_template: 'flow', viewer_task: 'Follow the trail' }),
    actorStats: { actorScenes: 7, cardScenes: 1, byKind: { flow: 7 } },
  });
  assert.equal(r.metrics.actorDenom, 10, 'payda klip sayısına kaymış');
  assert.equal(r.metrics.actorRatio, 0.7);
  assert.ok(!r.warnings.some((w) => /aktörlü sahne oranı/.test(w)), JSON.stringify(r.warnings));
});
