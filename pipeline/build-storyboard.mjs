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
import {breaksChain, buildBeats, canRender, checkBeatCount, danglesBetween, resolveTemplate, templateVariety, wordCount} from './beats.mjs';
import {isNegated, nounFor, searchFor, shapeFor, shapesFor} from './subject.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FPS = 30;

/**
 * Tek bir nesne cutout'u çizen şablonlar.
 *
 * `payload.shape` ve `payload.negated` yalnızca bunlarda görünür. Listede
 * olmayanlar (stick_beat, map_route, archival_timeline, data_annotate,
 * grid_scale) kendi grafiklerini çiziyor ve verilen nesneyi göstermiyor.
 */
const DRAWS_OBJECT = new Set([
  'hero_cutout',
  'wide_establish',
  'headline_card',
  'star_field',
  'labeled_diagram',
  'pull_quote',
]);

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
      else p.headline = shorten(text, 6);
      break;
    }

    case 'archival_timeline': {
      // Anlatının tamamından yıl geçen cümleleri topla.
      const rows = collectYears(story.narration);
      if (rows.length >= 2) p.timeline = rows.slice(0, 4);
      else p.headline = shorten(text, 6);
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
      p.headline = shorten(text, 6);
      break;
    }

    case 'grid_scale': {
      // Vurgulanacak sayı metinden gelir: "Only five navigators" → 5 / 20.
      const hi = spelledNumber(text);
      const total = hi ? Math.max(hi * 4, hi + 4) : null;
      if (hi && total <= 60) p.ratio = {total, highlighted: hi};
      p.headline = shorten(text, 6);
      break;
    }

    case 'data_annotate':
      // Grafik gerçek bir seri istiyor. Anlatıdan seri çıkarılamıyorsa uydurma
      // eğri çizmek YALAN GÖRSEL olur; sözleşme reddeder, başka şablona geçer.
      p.headline = shorten(text, 6);
      p.label = firstYear(text) ?? undefined;
      break;

    case 'stick_beat':
      p.headline = emphasise(shorten(text, 7), nounFor(text));
      break;

    case 'wide_establish':
      p.headline = emphasise(shorten(text, 5), nounFor(text));
      p.caption = story.subtitle ?? undefined;
      break;

    case 'labeled_diagram': {
      const places = extractPlaces(text);
      if (places.length >= 2) p.sides = [{label: places[0]}, {label: places[1]}];
      p.headline = shorten(text, 5);
      p.label = firstYear(text) ?? undefined;
      /**
       * Alt şerit yalnızca BAŞLIK KIRPILMIŞSA konur.
       *
       * Render'da şerit başlığın birebir aynısını yazıyordu: üstte
       * "THE AIRCRAFT TOOK OFF AGAIN", altta "The aircraft took off again".
       * Karakter uzunluğuna bakan eski koşul (>60) kırpılıp kırpılmadığını
       * ölçmüyordu. Şeridin işi tamamlamak; tekrar etmek değil.
       */
      p.caption = wordCount(text) > wordCount(p.headline) ? text : undefined;
      break;
    }

    case 'star_field':
    case 'headline_card':
    case 'hero_cutout':
    default:
      p.headline = emphasise(shorten(text, 6), nounFor(text));
      p.label = properNoun(text) ?? firstYear(text) ?? undefined;
      break;
  }

  /**
   * ÇİZİLECEK NESNE — şablondan BAĞIMSIZ karar.
   *
   * Şablon "bu beat ne TÜR" sorusunu cevaplıyor (olgu mu, yer mi, ölçek mi).
   * Bu satır "içine ne çizilecek" sorusunu cevaplıyor. İkinci soru daha önce
   * hiç sorulmamıştı, o yüzden her şablon kendi sabit şeklini çiziyordu ve
   * cümleyle ilgisi yoktu.
   *
   * Cümlede somut nesne yoksa `undefined` kalır ve şablon varsayılanına düşer;
   * uydurma bir nesne çizmek yalan görsel olur.
   */
  const shape = shapeFor(text);
  if (shape) p.shape = shape;
  // İki nesne çizen şablonlar (labeled_diagram, split_compare) için ikincil
  // şekil. Yoksa şablon ikinci kutusunu birincil şekle göre seçer.
  const second = shapesFor(text, 2)[1];
  if (second) p.shape2 = second;
  // Nesne çizilecekse ve cümle onun yokluğunu söylüyorsa üstü çizilir.
  if (shape && isNegated(text)) p.negated = true;

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
/**
 * Kırpıcının kendi sarkan kelime listesi YOK. Kural `beats.mjs`'teki
 * `danglesBetween` yükleminde ve iki taraf da onu çağırıyor — bkz. oradaki
 * yorumda sayılan dört ayrı kaçak.
 */

function shorten(text, maxWords) {
  const w = text.replace(/[."“”]+$/g, '').trim().split(/\s+/);
  if (w.length <= maxWords) return w.join(' ');
  let cut = maxWords;

  /**
   * ZİNCİR KIRILIYORSA ÖNCE İLERİ UZAT, SONRA GERİ SAR.
   *
   * ÖLÇÜLEN KUSUR: kırpıcı sayı ve tarih zincirlerini ortadan kesiyordu —
   *   "He asked for two hundred"   (thousand dollars kayıp)
   *   "On the night of 24"         (November 1971 kayıp)
   * Kural beat bölücüsünde vardı, burada yoktu. Doğru kural, yanlış katman;
   * bu dosyada sarkan kelime kuralında da aynısı olmuştu.
   *
   * NEDEN GERİ SARMAK TEK BAŞINA YETMİYOR: "On the night of 24 November 1971"
   * cümlesinde geri sarmak sırayla 24'ü, sonra "of"u atar ve elde "On the
   * night" kalır — tarih tamamen kaybolur. Oysa cold open'ın TAŞIDIĞI bilgi
   * tarihtir. Doğru hamle zinciri tamamlayacak kadar İLERİ gitmek.
   *
   * Uzatma sınırlı (+3 kelime): sınırsız uzatma "kısa başlık" kuralını yok eder.
   */
  const MAX_EXTEND = 3;
  let extended = 0;
  while (extended < MAX_EXTEND && cut < w.length && breaksChain(w[cut - 1], w[cut])) {
    cut += 1;
    extended += 1;
  }
  // Zincir bittikten sonra ölçü birimi geliyorsa onu da al: "two hundred
  // thousand" tek başına eksik bir nicelik, "…dollars" ile tamam olur.
  if (extended > 0 && extended < MAX_EXTEND && cut < w.length && !danglesBetween(w[cut], w[cut + 1])) {
    cut += 1;
  }

  // Metni bozacak bir noktada bitmeyecek en yakın yere geri sar.
  while (cut > 2 && danglesBetween(w[cut - 1], w[cut])) cut -= 1;

  /**
   * BELİRTEÇ KURALI KIRPMADA DA UYGULANIR — AMA BÜTÇELİ.
   *
   * "Somewhere over southern Washington he lowered" bir kırpma olarak bile kötü:
   * nesnesiz geçişli fiil. Ama kuralı sınırsız uygulamak başlıkları ikiye
   * indirmişti ("He handed"). İkisinin ortası: en fazla iki kelime geri sar ve
   * dört kelimenin altına düşme.
   *
   *   "…Washington he lowered"        → "Somewhere over southern Washington" ✓
   *   "He handed the attendant a"     → "He handed the attendant"            ✓
   */
  let budget = 2;
  while (budget > 0 && cut > 4 && danglesBetween(w[cut - 1], w[cut], {splitPoint: true})) {
    cut -= 1;
    budget -= 1;
  }
  while (cut > 2 && danglesBetween(w[cut - 1], w[cut])) cut -= 1;
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

function emphasise(text, prefer) {
  if (/\*/.test(text)) return text;
  const words = text.split(/\s+/);

  /**
   * ÖNCE ANLAM, SONRA UZUNLUK.
   *
   * `prefer` cümlenin somut nesnesi (subject.mjs'in bulduğu kelime). Varsa
   * vurgu ona gider. Yoksa eski kural (en uzun dolgu olmayan kelime) devreye
   * girer — o kural bir yedek, birincil ölçüt değil.
   */
  if (prefer) {
    const i = words.findIndex((w) => w.replace(/[^A-Za-z0-9’'-]/g, '').toLowerCase() === prefer.toLowerCase());
    if (i >= 0) {
      words[i] = `*${words[i]}*`;
      return words.join(' ');
    }
  }

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
  /**
   * KONU DOSYASI ARGÜMANLA VERİLEBİLİR.
   *
   *   npm run beats                          → content/story.json
   *   npm run beats -- content/story-x.json  → o dosya
   *
   * Neden: kullanıcı "başka bir konu için run almak istiyorum" dedi ve tek yol
   * content/story.json'ı ELLE ÜZERİNE YAZMAKTI. Üzerine yazmak eski konuyu
   * siler, yani her yeni konu bir öncekini yok eder ve karşılaştırma imkânı
   * kalmaz. Konular yan yana durabilmeli.
   */
  const argPath = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const storyPath = argPath ? path.resolve(ROOT, argPath) : path.join(ROOT, 'content', 'story.json');
  if (!existsSync(storyPath)) {
    console.error(`konu dosyası bulunamadı: ${storyPath}`);
    process.exit(1);
  }
  const story = JSON.parse(await readFile(storyPath, 'utf8'));
  if (!story.narration || !String(story.narration).trim()) {
    console.error(`${path.basename(storyPath)} içinde \`narration\` yok ya da boş.`);
    process.exit(1);
  }

  const {beats, totalSeconds, words} = buildBeats(story.narration);

  // Sahne süresi = beat süresi, ama asgari eşik var: 1.2 saniyeden kısa sahne
  // göz tarafından okunmuyor, kesme gürültüsü gibi durur.
  /**
   * SAHNE TABANI — kullanıcı iki kez "değişim çok hızlı" dedi.
   *
   * 1.2 saniye, kesmenin göz tarafından "gürültü" olarak okunmadığı ALT SINIRDI;
   * yani teknik bir taban, editoryal bir tercih değil. Ölçülen storyboard'da
   * sahnelerin dörtte biri 2.0-2.5 saniyeydi ve hızlı gelen kesmeler onlardı.
   *
   * Seslendirme yokken izleyici hem OKUYOR hem bakıyor: 6 kelimelik bir başlık
   * ~1.5 saniye okuma demek, üstüne görsele bakacak zaman gerekiyor. 3.0 saniye
   * ikisine birden yer bırakan taban.
   *
   * Seslendirme eklendiğinde bu taban düşürülebilir — o zaman okuma yükü ortadan
   * kalkar ve kesme temposu sesin temposuna bağlanır.
   */
  const MIN_SECONDS = 3.6;

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
    let {template, payload} = resolveTemplate(b.kind, recent, (t) => payloadForBeat(b, story, t));

    /**
     * ÜSTÜ ÇİZİLECEK NESNE, ONU ÇİZEN BİR ŞABLONA DÜŞMEK ZORUNDA.
     *
     * "He carried no compass" beat'i `absence` sınıfına giriyor ve o sınıfın
     * şablon listesinde `stick_beat` var. Ama stick_beat tek bir çöp adam
     * çiziyor — pusulayı hiç çizmiyor, dolayısıyla üstünü de çizemiyor ve
     * cümlenin görsel karşılığı kayboluyor.
     *
     * Beat SINIFI doğru ("yokluk"), yanlış olan şablonun o yokluğu
     * gösterememesi. Nesneyi çizen bir şablona geçiyoruz.
     */
    if (payload.negated && !DRAWS_OBJECT.has(template)) {
      /**
       * TEKRAR TUZAĞI — ilk sürümde buraya doğrudan 'hero_cutout' yazdım ve
       * ölçüm anında yakaladı: 2., 3. ve 4. sahne üst üste hero_cutout oldu,
       * "ardışık tekrar: 2 ← BEKLENMİYOR" uyarısı çıktı ve çeşitlilik 9
       * şablondan 8'e düştü.
       *
       * Bir kusuru düzeltirken başka bir kuralı ezmek; bu depoda daha önce de
       * yaptığım hata. Değişim `recent`e saygı duymak zorunda.
       */
      const swap = ['hero_cutout', 'headline_card', 'wide_establish', 'star_field'].find(
        (t) => !recent.slice(0, 2).includes(t),
      );
      template = swap ?? 'hero_cutout';
      payload = payloadForBeat(b, story, template);
    }

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

  /**
   * SEMANTİK KAPSAMA — SESSİZ BOZULMAYA KARŞI TEK SAVUNMA
   *
   * NEDEN BU RAPOR VAR
   * Sözlük bir kez tek bir konuya (Pasifik seyrüseferi) göre yazılmıştı. Farklı
   * bir konu verildiğinde ÖLÇÜLDÜ Kİ 19 sahnenin 19'unda şekil bulunamıyor —
   * ve hiçbir hata çıkmıyor, hiçbir uyarı verilmiyordu. Video render ediliyor,
   * testler geçiyor, doğrulayıcı "TÜM ÖLÇÜMLER GEÇTİ" diyor; tek fark ekrandaki
   * her şeyin anlatımla ilgisiz jenerik siluete dönmesi.
   *
   * Bu, bu projede daha önce de görülen en tehlikeli hata sınıfı: ölçüm, ölçtüğü
   * şeyin YOKLUĞUNU başarı sanıyor. Kapsama artık her derlemede yazılıyor ve
   * düşükse yüksek sesle uyarıyor.
   */
  const shaped = scenes.filter((s) => s.payload.shape).length;
  const searchable = scenes.filter((s) => searchFor(s._beat.text)).length;
  const coverage = shaped / Math.max(scenes.length, 1);
  console.log(
    `  semantik kapsama: ${shaped}/${scenes.length} sahnede çizilecek nesne bulundu ` +
      `(%${(coverage * 100).toFixed(0)}), ${searchable} sahne için arşiv sorgusu var`,
  );
  if (coverage < 0.4) {
    console.log('  ← UYARI: kapsama DÜŞÜK. Sahnelerin çoğu şablonun jenerik siluetine düşecek,');
    console.log('    yani çizimler anlatımla ilgisiz olacak. Anlatıda somut nesne adı geçmiyor');
    console.log('    ya da bu konunun nesneleri pipeline/subject.mjs sözlüğünde yok.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
