#!/usr/bin/env node
/**
 * STORYBOARD DERLEYİCİ
 *
 * content/story.json (anlatı + olgular) → content/storyboard.json (sahneler).
 * Remotion bu çıktıyı okur; render sırasında hiçbir karar verilmez, çünkü
 * render'ın deterministik olması gerekiyor.
 *
 * Bu betik AĞA ÇIKMAZ ve ÜCRETLİ API ÇAĞIRMAZ. Görsel üretimi ayrı bir adım;
 * görsel yoksa şablonlar prosedürel siluetle çalışır ve tasarım sistemi
 * yine doğrulanabilir.
 */

import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {buildBeats, canRender, checkBeatCount, resolveTemplate, templateVariety, wordCount} from './beats.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FPS = 30;

/**
 * Beat metninden, VERİLEN ŞABLON için payload çıkar.
 *
 * `template` beat'ten değil parametreden gelir: `resolveTemplate` birkaç
 * şablonu deneyip hangisinin gerçekten render edilebileceğine bakıyor, o yüzden
 * aynı beat için birden fazla kez farklı şablonla çağrılabilir.
 */
function payloadForBeat(beat, story, template = beat.template) {
  const text = beat.text.replace(/\s+/g, ' ').trim();
  const p = {};

  switch (template) {
    case 'pull_quote':
      p.quote = text;
      break;

    case 'split_compare': {
      const sides = extractSides(text);
      if (sides) p.sides = sides;
      else p.headline = shorten(text, 8);
      break;
    }

    case 'archival_timeline': {
      // Anlatının tamamından yıl geçen cümleleri topla.
      const rows = collectYears(story.narration);
      if (rows.length >= 2) p.timeline = rows.slice(0, 4);
      else p.headline = shorten(text, 8);
      break;
    }

    case 'map_route': {
      // Rota en az iki yer adı istiyor; yoksa şablon "boş harita" çizer ve
      // sözleşme (canRender) bunu reddeder, başka şablona geçilir.
      const places = extractPlaces(text);
      if (places.length >= 2) {
        p.route = [
          {x: 0.14, y: 0.74, label: places[0]},
          {x: 0.52, y: 0.46},
          {x: 0.86, y: 0.22, label: places[1]},
        ];
      }
      p.headline = shorten(text, 8);
      break;
    }

    case 'grid_scale': {
      // Vurgulanacak sayı metinden gelir: "Only five navigators" → 5 / 20.
      const hi = spelledNumber(text);
      const total = hi ? Math.max(hi * 4, hi + 4) : null;
      if (hi && total <= 60) p.ratio = {total, highlighted: hi};
      p.headline = shorten(text, 8);
      break;
    }

    case 'data_annotate':
      // Grafik gerçek bir seri istiyor. Anlatıdan seri çıkarılamıyorsa uydurma
      // eğri çizmek YALAN GÖRSEL olur; sözleşme reddeder, başka şablona geçer.
      p.headline = shorten(text, 8);
      p.label = firstYear(text) ?? undefined;
      break;

    case 'stick_beat':
      p.headline = emphasise(shorten(text, 9));
      break;

    case 'wide_establish':
      p.headline = emphasise(shorten(text, 7));
      p.caption = story.subtitle ?? undefined;
      break;

    case 'labeled_diagram': {
      const places = extractPlaces(text);
      if (places.length >= 2) p.sides = [{label: places[0]}, {label: places[1]}];
      p.headline = shorten(text, 6);
      p.label = firstYear(text) ?? undefined;
      p.caption = text.length > 60 ? text : undefined;
      break;
    }

    case 'star_field':
    case 'headline_card':
    case 'hero_cutout':
    default:
      p.headline = emphasise(shorten(text, 8));
      p.label = properNoun(text) ?? firstYear(text) ?? undefined;
      break;
  }

  // Boş anahtarları at: şablonlar undefined'ı tolere ediyor, boş dizeyi etmiyor.
  for (const k of Object.keys(p)) if (p[k] === undefined || p[k] === '') delete p[k];
  return p;
}

/**
 * Başlık için metni kırp.
 *
 * DİKKAT — burada bir kez hata yapıldı: sarkan kelime kuralı yalnızca beat
 * BÖLÜCÜSÜNE konmuştu, bu kırpıcıya konmamıştı. Sonuç render'da göründü:
 * "HE SAILED FROM HAWAI'I TO TAHITI ACROSS", "AND LET THE ISLANDS COME TO",
 * ve "ONLY FIVE NAVIGATORS OF HIS TRADITION WERE STILL" (living düştü).
 * Doğru kural, yanlış katman. Kırpma da geri sarıp temiz kelimede durmalı.
 */
const TRAILING_STOP = new Set([
  'of', 'and', 'or', 'the', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
  'his', 'her', 'their', 'its', 'that', 'which', 'but', 'into', 'onto', 'over', 'under',
  'was', 'were', 'is', 'are', 'had', 'has', 'have', 'still', 'never', 'not',
]);

function shorten(text, maxWords) {
  const w = text.replace(/[."“”]+$/g, '').trim().split(/\s+/);
  if (w.length <= maxWords) return w.join(' ');
  let cut = maxWords;
  // Sarkan kelimede bitmeyecek en yakın kısa noktaya geri sar.
  while (cut > 2) {
    const last = w[cut - 1].toLowerCase().replace(/[^a-z0-9’'-]/g, '');
    if (!TRAILING_STOP.has(last)) break;
    cut -= 1;
  }
  return w.slice(0, cut).join(' ').replace(/[,;:]$/, '');
}

/**
 * Vurgu işaretle: cümlenin en "ağır" kelimesini *yıldız* içine al.
 * Highlight barı bunu okuyacak. Seçim basit ve deterministik: en uzun,
 * dolgu olmayan kelime.
 */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from',
  'that', 'this', 'was', 'were', 'is', 'are', 'had', 'has', 'have', 'his', 'her', 'their', 'its',
  'he', 'she', 'they', 'it', 'by', 'as', 'not', 'no',
]);

function emphasise(text) {
  if (/\*/.test(text)) return text;
  const words = text.split(/\s+/);
  let best = -1;
  let bestLen = 0;
  words.forEach((w, i) => {
    const bare = w.replace(/[^A-Za-z0-9’'-]/g, '');
    if (!bare || STOP.has(bare.toLowerCase())) return;
    if (bare.length > bestLen) {
      bestLen = bare.length;
      best = i;
    }
  });
  if (best < 0 || bestLen < 4) return text;
  words[best] = `*${words[best]}*`;
  return words.join(' ');
}

/** Metindeki ilk sayıyı (rakam ya da yazı) tamsayıya çevir. */
const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

function spelledNumber(text) {
  const d = text.match(/\b(\d{1,2})\b/);
  if (d) return Number(d[1]);
  const w = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty)\b/);
  return w ? WORD_NUM[w[1]] : null;
}

function firstYear(text) {
  const m = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? m[1] : null;
}

function properNoun(text) {
  // İlk kelimeyi atla (cümle başı büyük harfli) ve ardışık büyük harfli
  // kelimeleri isim olarak al.
  const words = text.split(/\s+/).slice(1);
  const run = [];
  for (const w of words) {
    const bare = w.replace(/[^A-Za-z’'-]/g, '');
    if (/^[A-Z][a-z’'-]+$/.test(bare)) run.push(bare);
    else if (run.length) break;
  }
  return run.length ? run.slice(0, 3).join(' ').toUpperCase() : null;
}

function extractPlaces(text) {
  const m = text.match(/\bfrom\s+([A-Z][A-Za-z’'-]+(?:\s[A-Z][A-Za-z’'-]+)?)\s+to\s+([A-Z][A-Za-z’'-]+(?:\s[A-Z][A-Za-z’'-]+)?)/);
  if (m) return [m[1].toUpperCase(), m[2].toUpperCase()];
  const caps = (text.match(/\b[A-Z][A-Za-z’'-]{2,}\b/g) ?? []).slice(1);
  return caps.slice(0, 2).map((s) => s.toUpperCase());
}

function extractSides(text) {
  const m =
    text.match(/\b(?:instead of|rather than|unlike|whereas)\s+([^,.]+?)[,.]?\s*(?:he|she|they|it)?\s*(.*)$/i) ||
    text.match(/\bnot\s+([^,]+?),?\s+but\s+(.+)$/i);
  if (!m) return null;
  const a = m[1]?.trim();
  const b = m[2]?.trim();
  if (!a || !b || a.length < 3 || b.length < 3) return null;
  return [
    {label: shorten(a, 3), detail: a.length > 24 ? a : undefined},
    {label: shorten(b, 3), detail: b.length > 24 ? b : undefined},
  ];
}

function collectYears(narration) {
  const out = [];
  const seen = new Set();
  for (const s of String(narration).split(/(?<=[.!?])\s+/)) {
    const y = firstYear(s);
    if (y && !seen.has(y)) {
      seen.add(y);
      out.push({year: y, text: shorten(s.replace(y, '').trim(), 7)});
    }
  }
  return out;
}

async function main() {
  const storyPath = path.join(ROOT, 'content', 'story.json');
  if (!existsSync(storyPath)) {
    console.error(`content/story.json bulunamadı: ${storyPath}`);
    process.exit(1);
  }
  const story = JSON.parse(await readFile(storyPath, 'utf8'));
  if (!story.narration || !String(story.narration).trim()) {
    console.error('story.json içinde `narration` yok ya da boş.');
    process.exit(1);
  }

  const {beats, totalSeconds, words} = buildBeats(story.narration);

  // Sahne süresi = beat süresi, ama asgari eşik var: 1.2 saniyeden kısa sahne
  // göz tarafından okunmuyor, kesme gürültüsü gibi durur.
  const MIN_SECONDS = 1.2;

  // Şablon seçimi burada KESİNLEŞİR: beats.mjs tür bazlı öneriyi verir, ama
  // hangi şablonun gerçekten çizebileceğini payload belirler. `resolveTemplate`
  // öneri listesinde ilerleyip sözleşmeyi geçen ilkini seçer.
  const recent = [];
  /**
   * Şablon başına kullanım sayacı.
   *
   * NEDEN: sahne şablonlarının yerleşim varyantı, o şablonun KAÇINCI kullanımı
   * olduğuna göre dönmeli. Bileşen içinde sahne SIRASINI (`index`) kullanmak
   * yetmiyor: headline_card sahneleri 3, 7, 11, 16. sıralarda çıkınca `% 2`
   * aynı pariteli sıraları aynı varyanta düşürdü ve dört kullanımdan üçü aynı
   * kompozisyonu aldı. Kullanım sırasını burada saymak rotasyonu garanti eder.
   */
  const useCount = {};
  const scenes = beats.map((b, i) => {
    const {template, payload} = resolveTemplate(b.kind, recent, (t) => payloadForBeat(b, story, t));
    recent.unshift(template);
    const occurrence = useCount[template] ?? 0;
    useCount[template] = occurrence + 1;
    return {
      template,
      payload,
      occurrence,
      durationInFrames: Math.round(Math.max(b.seconds, MIN_SECONDS) * FPS),
      seed: i * 7 + 3,
      // İzlenebilirlik: hangi cümleden hangi sahnenin çıktığı çıktıda kalsın.
      _beat: {text: b.text, kind: b.kind, start: b.start},
    };
  });

  // Hiçbir sahne boş çıkmasın: sözleşme sonrası son bir denetim.
  const empty = scenes.filter((s) => !canRender(s.template, s.payload));
  if (empty.length) {
    console.error(`HATA: ${empty.length} sahne boş render edilirdi: ${empty.map((s) => s.template).join(', ')}`);
    process.exit(1);
  }

  const totalFrames = scenes.reduce((s, x) => s + x.durationInFrames, 0);
  const storyboard = {
    title: story.title ?? 'Untitled',
    scenes,
    totalFrames,
    audio: story.audio ?? undefined,
  };
  if (!storyboard.audio) delete storyboard.audio;

  const outPath = path.join(ROOT, 'content', 'storyboard.json');
  await writeFile(outPath, `${JSON.stringify(storyboard, null, 2)}\n`);

  const check = checkBeatCount(beats, totalSeconds);
  const kinds = beats.reduce((m, b) => ({...m, [b.kind]: (m[b.kind] ?? 0) + 1}), {});
  // DİKKAT: istatistik ÇÖZÜLMÜŞ sahnelerden hesaplanır, beats.mjs'in ilk
  // önerisinden değil. Önce beats'ten hesaplanıyordu ve rapor gerçekte render
  // edilmeyen şablonları listeliyordu (sözleşme onları çoktan reddetmişti).
  const resolved = scenes.map((s) => ({template: s.template}));
  const tpls = resolved.reduce((m, b) => ({...m, [b.template]: (m[b.template] ?? 0) + 1}), {});

  console.log(`storyboard yazıldı: content/storyboard.json`);
  console.log(`  kelime          : ${words}`);
  console.log(`  anlatı süresi   : ${totalSeconds.toFixed(1)} s`);
  console.log(`  video süresi    : ${(totalFrames / FPS).toFixed(1)} s (${totalFrames} kare)`);
  console.log(`  beat            : ${beats.length}  — ${check.message}`);
  console.log(`  beat türleri    : ${Object.entries(kinds).map(([k, v]) => `${k}:${v}`).join(', ')}`);
  console.log(`  şablonlar       : ${Object.entries(tpls).map(([k, v]) => `${k}:${v}`).join(', ')}`);

  // En kısa beat: MIN_WORDS_PER_BEAT tutuyor mu?
  const shortest = beats.reduce((m, b) => (b.words < m.words ? b : m), beats[0]);
  console.log(`  en kısa beat    : ${shortest.words} kelime — ${JSON.stringify(shortest.text)}`);

  const v = templateVariety(resolved);
  const repeats = scenes.filter((s, i) => i > 0 && s.template === scenes[i - 1].template).length;
  console.log(`  ardışık tekrar  : ${repeats}${repeats ? '  ← BEKLENMİYOR' : ''}`);
  console.log(
    `  çeşitlilik      : ${v.distinct} ayrı şablon, en sık olanın payı %${(v.topShare * 100).toFixed(0)}` +
      `, salınım (A,B,A) ${v.alternating}`,
  );
  // Tek şablon sahnelerin üçte birinden fazlasını kaplıyorsa video şablondan
  // çıkmış gibi görünür — "ardışık tekrar 0" bunu yakalamaz.
  if (v.topShare > 0.34) console.log('  ← UYARI: bir şablon fazla baskın');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
