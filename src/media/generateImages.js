import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { fetchOneForKeywords, fetchStockVideoForKeywords } from './fetchMedia.js';
import { renderStatCard, isUsableStat, renderStepsCard, isUsableDiagram } from './renderTemplate.js';
import { fetchArchiveImage } from './fetchArchive.js';
import { isAssetRelevant } from './semanticRelevance.js';
import { perceptualHash, isTooSimilar, hammingDistance } from './imageHash.js';
import { classifyBeat } from '../visual/semanticDirector.js';

const run = promisify(execFile);

/**
 * KADRAJ ROTASYONU — her sahneye FARKLI bir kompozisyon dayatır.
 * Sahne promptları tek başına yeterince ayrışmıyor (hepsi aynı konuyu anlatır);
 * bu liste sırayla uygulanarak her 3sn'lik bloğun ayrı bir görsel kompozisyon
 * almasını garantiler. Gerçek koşuda 14 karenin 14'ü aynı kadrajdı.
 */
const SHOT_VARIATIONS = [
  'extreme wide establishing shot, subject small in frame, vast environment',
  'tight macro close-up, shallow depth of field, texture filling the frame',
  'low angle looking upward, dramatic perspective',
  'overhead top-down bird view, flat lay geometry',
  'medium shot from the side, profile silhouette against light',
  'over-the-shoulder point-of-view, foreground element framing the subject',
  'extreme close-up detail insert, single isolated element',
  'high angle wide shot, diagonal composition, strong leading lines',
  'backlit rim-light shot, subject as dark shape against bright background',
  'dutch tilted angle, off-center subject, negative space on one side',
  'ground level worm-eye view, foreground blur in front of subject',
  'symmetrical centered composition, subject dead center, mirrored surroundings',
];

/**
 * MİKRO PLAN MERDİVENİ — aynı görselden farklı kadrajlar (V3 Faz 4).
 *
 * "20-25 farklı görsel üretmek anlamına gelmiyor; aynı görsel yakın plan,
 * detay planı, farklı crop ile tekrar kullanılabilir." (26 Tem audit)
 *
 * Kadrajın NEREDEN alınacağı hikâye şablonuna bağlıdır:
 *   mechanism/chain → merkez detay (yapı okunmalı)
 *   flow            → sağ ve sol yarım (özne yol boyunca ilerliyor)
 *   scale/quantity  → geniş kalır, sadece hafif detay (miktar hissi kaybolmasın)
 *   search_reveal   → sıkı detay (hedefe kilitlenme)
 *
 * z = kırpma oranı (1 = tam kadraj), x/y = kırpma başlangıcı (0..1-z).
 */
export function shotLadder(template, seconds) {
  const LONG = seconds >= 5.2;   // uzun sahne 2 ek kadraj taşır
  switch (template) {
    case 'flow':
    case 'navigation':
      // Rota anlatan sahne: kadraj yolun İKİ UCUNU ayrı ayrı gösterir.
      return LONG
        ? [{ tag: 'b', z: 0.62, x: 0.04, y: 0.20, motion: 'pan-left-to-right' },
          { tag: 'c', z: 0.58, x: 0.38, y: 0.24, motion: 'detail-zoom' }]
        : [{ tag: 'b', z: 0.62, x: 0.30, y: 0.22, motion: 'pan-left-to-right' }];
    case 'communication':
      // Kaynak → alıcı: önce kaynağa yaklaş, sonra karşı tarafa geç.
      return LONG
        ? [{ tag: 'b', z: 0.55, x: 0.08, y: 0.22, motion: 'detail-zoom' },
          { tag: 'c', z: 0.55, x: 0.37, y: 0.26, motion: 'pan-right-to-left' }]
        : [{ tag: 'b', z: 0.58, x: 0.22, y: 0.24, motion: 'detail-zoom' }];
    case 'chain_reaction':
      // Yayılım: dar başlangıçtan geniş kadraja — büyüme kadrajda da olsun.
      return LONG
        ? [{ tag: 'b', z: 0.42, x: 0.29, y: 0.30, motion: 'detail-zoom' },
          { tag: 'c', z: 0.84, x: 0.08, y: 0.08, motion: 'slow-pull-out' }]
        : [{ tag: 'b', z: 0.46, x: 0.27, y: 0.28, motion: 'detail-zoom' }];
    case 'cause_effect':
    case 'problem_solution':
      // Tetik/engel sıkı, sonuç geniş.
      return LONG
        ? [{ tag: 'b', z: 0.44, x: 0.28, y: 0.26, motion: 'detail-zoom' },
          { tag: 'c', z: 0.80, x: 0.10, y: 0.12, motion: 'slow-pull-out' }]
        : [{ tag: 'b', z: 0.48, x: 0.26, y: 0.26, motion: 'detail-zoom' }];
    case 'timeline':
      // Eksen alt üçlükte yaşıyor: kadraj SABİT kalsın, yalnızca hafif yakınlaş.
      return [{ tag: 'b', z: 0.78, x: 0.11, y: 0.08, motion: 'static-hold' }];
    case 'search_reveal':
      return LONG
        ? [{ tag: 'b', z: 0.70, x: 0.15, y: 0.15, motion: 'slow-push-in' },
          { tag: 'c', z: 0.45, x: 0.28, y: 0.28, motion: 'detail-zoom' }]
        : [{ tag: 'b', z: 0.50, x: 0.25, y: 0.25, motion: 'detail-zoom' }];
    case 'scale':
    case 'quantity':
      // Miktar/ölçek geniş kadrajda okunur → yalnızca hafif yakınlaşma.
      return [{ tag: 'b', z: 0.80, x: 0.10, y: 0.10, motion: 'slow-pull-out' }];
    case 'mechanism':
    case 'chain':
      return LONG
        ? [{ tag: 'b', z: 0.66, x: 0.17, y: 0.17, motion: 'detail-zoom' },
          { tag: 'c', z: 0.48, x: 0.26, y: 0.30, motion: 'static-hold' }]
        : [{ tag: 'b', z: 0.66, x: 0.17, y: 0.17, motion: 'detail-zoom' }];
    default:
      return LONG
        ? [{ tag: 'b', z: 0.66, x: 0.17, y: 0.17, motion: 'detail-zoom' },
          { tag: 'c', z: 0.52, x: 0.30, y: 0.20, motion: 'slow-push-in' }]
        : [{ tag: 'b', z: 0.66, x: 0.17, y: 0.17, motion: 'detail-zoom' }];
  }
}

/**
 * Faz 3 (yeni) — Sahne başına AI görsel üretimi.
 *
 * Sağlayıcı (config.images.provider):
 *   - 'pollinations' : ÜCRETSİZ, anahtar gerekmez, FLUX tabanlı, konuya bağlı görsel.
 *   - 'gemini'       : gemini-2.5-flash-image (genelde ücretli/kotalı).
 * Üretim başarısızsa Pexels stok (video/foto) yedeğine, o da olmazsa koyu
 * sinematik zemine (placeholder) düşer. Böylece boru hattı asla kırılmaz.
 */

/** Pollinations.ai (ücretsiz, FLUX) — promptu dikey bir görsele çevirir. */
async function fetchPollinations(prompt, dest, { width, height, seed, negative }) {
  const model = config.images.pollinationsModel;
  // NEGATİF PROMPT gerçekten İSTEĞE girer. Pollinations gövde parametresi
  // almaz; hem sorgu parametresi olarak hem de prompt içi dışlama cümlesi
  // olarak gönderilir. (Sadece üretip loglamak, 26 Tem'de yanlış hayvanları
  // engellemedi — kısıt isteğe ulaşmalı.)
  const full = negative ? `${prompt} Absolutely not: ${negative}.` : prompt;
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}` +
    `?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true` +
    (negative ? `&negative=${encodeURIComponent(negative)}` : '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.images.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`pollinations HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error('pollinations boş/geçersiz görsel');
    await writeFile(dest, buf);
    return dest;
  } finally {
    clearTimeout(timer);
  }
}

/** Bu koşuda tükenmiş görsel sağlayıcıları (kota/anahtar) — tekrar denenmez. */
const deadImageProviders = new Set();

/** Koşular arası durum sızmasın (test + uzun süreçler için). */
export function resetImageProviders() { deadImageProviders.clear(); }

/** Cloudflare Workers AI (FLUX) — metin tarafıyla AYNI kimlik bilgileri. */
async function fetchCloudflareImage(prompt, dest, { width, height, seed, negative }) {
  const { apiKey, accountId } = config.cloudflareAi;
  if (!apiKey || !accountId) throw new Error('cloudflare kimlik bilgisi yok');
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${config.images.cloudflareModel}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.images.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, width, height, seed, ...(negative ? { negative_prompt: negative } : {}) }),
    });
    if (!res.ok) throw new Error(`cloudflare HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    // Model ya doğrudan ikili görsel ya da {result:{image:base64}} döner.
    let buf;
    if (ct.includes('application/json')) {
      const data = await res.json();
      const b64 = data?.result?.image;
      if (!b64) throw new Error('cloudflare görsel içermeyen yanıt');
      buf = Buffer.from(b64, 'base64');
    } else {
      buf = Buffer.from(await res.arrayBuffer());
    }
    if (buf.length < 3000) throw new Error('cloudflare boş/geçersiz görsel');
    await writeFile(dest, buf);
    return dest;
  } finally { clearTimeout(timer); }
}

/** Together AI — FLUX.1-schnell-Free (ücretsiz uç). */
async function fetchTogetherImage(prompt, dest, { width, height, seed, negative }) {
  const { apiKey, model } = config.images.together;
  if (!apiKey) throw new Error('together anahtarı yok');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.images.timeoutMs);
  try {
    const res = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, width, height, seed, n: 1, response_format: 'b64_json',
        ...(negative ? { negative_prompt: negative } : {}) }),
    });
    if (!res.ok) throw new Error(`together HTTP ${res.status}`);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('together görsel içermeyen yanıt');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 3000) throw new Error('together boş/geçersiz görsel');
    await writeFile(dest, buf);
    return dest;
  } finally { clearTimeout(timer); }
}

/** Hugging Face Inference API (ücretsiz katman) — ham görsel döner. */
async function fetchHuggingFaceImage(prompt, dest, { negative } = {}) {
  const { apiKey, model } = config.images.huggingface;
  if (!apiKey) throw new Error('huggingface anahtarı yok');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.images.timeoutMs);
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: prompt,
        ...(negative ? { parameters: { negative_prompt: negative } } : {}) }),
    });
    if (!res.ok) throw new Error(`huggingface HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error('huggingface boş/geçersiz görsel');
    await writeFile(dest, buf);
    return dest;
  } finally { clearTimeout(timer); }
}

/**
 * BİRLEŞİK AI GÖRSEL ÜRETİCİ — sağlayıcı zincirini sırayla dener.
 *
 * Tek ücretsiz sağlayıcıya bağlı kalmak kırılgandı: Pollinations düşünce
 * bütün sahneler stok görsele düşüyor ve slayt hissi geri geliyordu. Artık
 * biri düşerse sıradaki denenir; hepsi düşerse çağıran yedek zincirine iner.
 *
 * @returns {Promise<{path:string, provider:string}>}
 */
export async function generateAiImage(prompt, dest, opts) {
  const chain = config.images.fallbackChain;
  const errors = [];
  for (const name of chain) {
    if (deadImageProviders.has(name)) continue;
    try {
      if (name === 'pollinations') await fetchPollinations(prompt, dest, opts);
      else if (name === 'cloudflare') await fetchCloudflareImage(prompt, dest, opts);
      else if (name === 'together') await fetchTogetherImage(prompt, dest, opts);
      else if (name === 'huggingface') await fetchHuggingFaceImage(prompt, dest, opts);
      else continue;
      if (name !== chain[0]) console.log(`[img] sağlayıcı yedeği: ${name}`);
      return { path: dest, provider: name };
    } catch (err) {
      const msg = String(err?.message || err);
      errors.push(`${name}: ${msg.slice(0, 60)}`);
      // Anahtarsız/kota dolmuş sağlayıcıyı bu koşuda bir daha deneme.
      if (/anahtar|kimlik|401|403|429|payment/i.test(msg)) deadImageProviders.add(name);
    }
  }
  throw new Error(`tüm görsel sağlayıcıları düştü (${errors.join(' | ')})`);
}

/** Gemini yanıtından ilk gömülü (inline) görseli çıkarır. */
function extractInlineImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  return img ? Buffer.from(img.inlineData.data, 'base64') : null;
}

/** Tek bir promptu Gemini görsel modeline gönderip PNG buffer döndürür. */
async function generateOne(ai, prompt) {
  // Bazı SDK/model sürümleri görseli varsayılan döndürür; bazıları
  // responseModalities ister. Önce sade, olmazsa modalite belirterek dene.
  const attempts = [
    { model: config.images.model, contents: prompt },
    {
      model: config.images.model,
      contents: prompt,
      config: { responseModalities: ['IMAGE'] },
    },
  ];
  let lastErr = null;
  for (const req of attempts) {
    try {
      const response = await ai.models.generateContent(req);
      const buf = extractInlineImage(response);
      if (buf) return buf;
      lastErr = new Error('görsel içermeyen yanıt');
    } catch (err) {
      lastErr = err;
      // Kota/erişim hatasında ikinci varyantı denemek anlamsız.
      if (/quota|RESOURCE_EXHAUSTED|429|permission|API key/i.test(String(err?.message))) break;
    }
  }
  throw lastErr || new Error('görsel üretilemedi');
}

/** Koyu, sinematik bir yedek zemin (placeholder) üretir — üzerinde yazı yok. */
async function makePlaceholder(destPath, seed = 0) {
  const hue = (seed * 47) % 360;
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `gradients=s=1080x1920:c0=0x0d1117:c1=0x1b2735:x0=0:y0=0:x1=1080:y1=1920:d=1`,
    '-vf', `hue=h=${hue},vignette=PI/4,format=yuv420p`,
    '-frames:v', '1',
    destPath,
  ], { maxBuffer: 20 * 1024 * 1024 }).catch(async () => {
    // gradients kaynağı yoksa düz koyu renk.
    await run('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=0x11161f:s=1080x1920',
      '-frames:v', '1', destPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
  });
}

/**
 * @param {object} script - generateScript çıktısı (scenes içermeli).
 * @param {object} [opts] - { outDir='output', basename }
 * @returns {Promise<{mediaDir:string, items:Array, sources:object}>}
 *   items: [{ path, type:'photo', scene, source:'ai'|'pexels'|'placeholder' }]
 */
// Cümle başı OLMAYAN büyük harfli kelimeler İngilizce'de güçlü özel-isim
// sinyalidir. Görüntü Yönetmeni real_subject vermezse, anlatımdaki adlı gerçek
// varlığı (Sümela Monastery, Giza, Rasputin...) yakalayıp GERÇEK arşiv fotoğrafı
// tetiklemek için deterministik yedek. LLM'e bağımlı değil → her zaman çalışır.
const SUBJECT_STOP = new Set(['The', 'A', 'An', 'This', 'That', 'These', 'Those', 'I', 'You', 'He', 'She',
  'It', 'We', 'They', 'But', 'And', 'Or', 'So', 'If', 'When', 'Why', 'How', 'What', 'Who', 'Where',
  'Their', 'His', 'Her', 'Its', 'Our', 'Your', 'In', 'On', 'At', 'For', 'To', 'Of', 'As', 'By', 'Then',
  'Now', 'Here', 'There', 'Yet', 'Still', 'Every', 'Some', 'Most', 'Many', 'One', 'Two', 'Three']);
const CONNECT = /^(of|the|and|de|la|von|van|del|di)$/i;
function detectRealSubject(text) {
  const s = String(text || '');
  if (!s) return null;
  let best = null;
  for (const sent of s.split(/(?<=[.!?])\s+/)) {
    const toks = sent.trim().split(/\s+/);
    let i = 1; // cümlenin İLK kelimesini atla (baştaki büyük harf sinyal değil)
    while (i < toks.length) {
      const clean = toks[i].replace(/[^\p{L}\p{N}''-]/gu, '');
      if (/^\p{Lu}[\p{L}''-]{2,}$/u.test(clean) && !SUBJECT_STOP.has(clean)) {
        const phrase = [clean];
        let j = i + 1;
        while (j < toks.length) {
          const c2 = toks[j].replace(/[^\p{L}\p{N}''-]/gu, '');
          if (CONNECT.test(c2)) { phrase.push(c2); j += 1; continue; }
          if (/^\p{Lu}[\p{L}''-]{1,}$/u.test(c2) && !SUBJECT_STOP.has(c2)) { phrase.push(c2); j += 1; continue; }
          break;
        }
        while (phrase.length && CONNECT.test(phrase[phrase.length - 1])) phrase.pop();
        const p = phrase.join(' ');
        if (p.length >= 4 && (!best || p.length > best.length)) best = p;
        i = j;
      } else i += 1;
    }
  }
  return best;
}

export async function generateImages(script, opts = {}) {
  const scenes = script.scenes || [];
  if (!scenes.length) throw new Error('script.scenes boş — anlatı sahneleri gerekli.');

  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    style = 'photo', // 'photo' | 'animated' (illüstrasyon)
    avoidAssetIds = [],
    sceneSeconds = [], // sahne başı süre (uzun sahneyi tempo için bölmek üzere)
  } = opts;
  // TEMPO: bu saniyeyi aşan statik foto sahnesi 2 alt-çekime bölünür (geniş →
  // punch-in). Shorts retention'ının #1 kaldıracı: göz akışını canlı tut.
  const SPLIT_SEC = Number(process.env.SCENE_SPLIT_SEC || 3.6);
  const SPLIT_ENABLED = process.env.SCENE_SPLIT !== '0';

  const mediaDir = path.join(outDir, basename, 'media');
  await mkdir(mediaDir, { recursive: true });

  const provider = config.images.enabled ? config.images.provider : 'none';
  const geminiAI =
    provider === 'gemini' && config.gemini.apiKey
      ? new GoogleGenAI({ apiKey: config.gemini.apiKey })
      : null;
  const { width, height } = config.images;

  const items = [];
  const sources = { ai: 0, stock: 0, pexels: 0, placeholder: 0, gfx: 0, archive: 0 };
  let archiveFbAttempts = 0; // DP real_subject vermediğinde deterministik yedek denemeleri
  let providerDead = provider === 'none' || (provider === 'gemini' && !geminiAI);
  // Motion graphics (sayı kartı) sayacı — video başına üst sınır.
  let gfxCount = 0;
  // Bu videoda kullanılan stok klip URL'leri — aynı klip iki sahnede tekrarlanmaz.
  const usedClips = new Set();
  const usedAssets = new Set(avoidAssetIds.map(String));

  // Hareketli sahne planı: Görüntü Yönetmeni sahneleri işaretlediyse (motion)
  // onlar; yoksa mekanik "her N. sahne". İlk sahne her zaman hariç (hook kapağı).
  const motionEvery = Math.max(0, config.images.motionEvery || 0);
  const hasStockKey = Boolean(config.pexels.apiKey || config.pixabay.apiKey);
  // process formatı: GERÇEK görüntü öncelikli — HER sahne (ilki dahil) önce
  // stok video dener; AI görsel sadece klip bulunamayan sahneleri doldurur.
  const processMode = script.format === 'process' && hasStockKey;
  // Animasyonlu (illüstrasyon) stilde stok video KARIŞMAZ — gerçek çekim +
  // çizim karışımı canlıda "yarı belgesel yarı çizgi film" çorbası yaptı.
  const canMotion = (motionEvery > 0 || processMode) && hasStockKey && style !== 'animated';
  const dpFlags = scenes.some((s) => s.motion === true);

  // Görsel süreklilik: video başına SABİT seed (konudan türetilir) + her sahne
  // promptuna "görsel çapa" eklenir → aynı karakter/dönem/ışık, tek film hissi.
  const anchor = String(script.visual_anchor || '').trim();
  let videoSeed = 0;
  const seedSrc = String(script.normalizedTopic || script.topic || 'ns');
  for (let c = 0; c < seedSrc.length; c += 1) {
    videoSeed = (videoSeed * 31 + seedSrc.charCodeAt(c)) % 999983;
  }
  videoSeed = videoSeed + 7;

  // Stil paketi: fotogerçekçi belgesel (varsayılan) ya da illüstrasyon.
  const styleSuffix =
    style === 'animated' ? config.images.animatedStyleSuffix : config.images.styleSuffix;
  // Ortak kalite prefix'i (en yüksek öncelikli stil sinyali, promptun başında).
  const stylePrefix = String(config.images.stylePrefix || '').trim();
  // GÖRSEL TUTARLILIK: sabit seed modunda TÜM sahneler aynı seed'i kullanır.
  // ARTIK VARSAYILAN KAPALI — açıkken her sahne aynı görseli üretti (bkz.
  // config.images.fixedSeed yorumu). Tutarlılığı anchor + stil paketi taşır.
  const useFixedSeed = config.images.fixedSeed === true;
  // Üretilen AI karelerinin algısal parmak izleri (aynı kare tekrarını yakalar).
  const aiHashes = [];
  // Kaç hareket dizisi üretildi (video başına üst sınır için).
  let sequenceCount = 0;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const idx = String(i + 1).padStart(2, '0');
    // ÖZNE KİMLİĞİ: yasaklı anatomi listesi sahnede taşınır ve HER üretim
    // çağrısına (ilk deneme, yeniden deneme, dizi kareleri) verilir. Sadece
    // ilk çağrıda uygulanan bir kısıt, yeniden üretimde kaybolurdu — canlıda
    // aynı videoda dört farklı hayvan çıkmasının sebeplerinden biri buydu.
    const negative = scene.negative_prompt || '';
    // PROMPT SIRASI KRİTİK: üreticiler baştaki kelimelere daha çok ağırlık verir.
    // Eskiden sıra [ortak stil, sahne, anchor, ortak stil] idi → sahneyi ayıran
    // tek parça devasa ortak metnin içinde boğuluyor, her sahne aynı çıkıyordu.
    // Artık SAHNE ÖNCE, ardından kadraj varyasyonu, sonra ortak stil.
    const framing = SHOT_VARIATIONS[i % SHOT_VARIATIONS.length];
    const prompt = [scene.image_prompt, framing, anchor, stylePrefix, styleSuffix]
      .filter(Boolean)
      .join('. ');
    // Sahne seed'i: her sahne FARKLI (benzersiz kompozisyon). Sabit mod opt-in.
    const sceneSeed = useFixedSeed ? videoSeed : videoSeed + i * 9973;
    let done = null;

    // 0.gfx) MOTION GRAPHICS kartları: sayı sayacı (stat) veya "how it works"
    // adım kartı (diagram). Guard: video başına üst sınır + sahne-1 hariç +
    // stat için anti-halüsinasyon (isUsableStat). Hata → normal görsel zinciri.
    // SON sahne gfx kartı ALMAZ: loop kapanışı son planın düz bir görsel
    // olmasını gerektiriyor (kart kendi grafiğini taşır, ilk kareyle eşleşemez).
    const isLastScene = i === scenes.length - 1;
    if (config.video.gfx && gfxCount < config.video.gfxMaxPerVideo && i > 0 && !isLastScene) {
      if (scene.stat && !isUsableStat(scene.stat, scene.narration)) {
        // Görünürlük: DP stat verdi ama sayı anlatımda birebir yok — sessiz
        // kalmak teşhisi imkânsız kılıyordu (6 videoda gfx:0 kör noktası).
        console.warn(`[img] sahne ${idx}: stat guard reddetti (value=${scene.stat.value} anlatımda geçmiyor).`);
      }
      try {
        if (isUsableStat(scene.stat, scene.narration)) {
          const dest = path.join(mediaDir, `${idx}-gfx.mp4`);
          // AKIŞI KORU: sayıyı sahnenin gerçek görseli ÜZERİNE bindir (düz kara
          // kart akışı kesiyordu — kullanıcı geri bildirimi). Arka planı ÜCRETSİZ/
          // anahtarsız Pollinations üretir (Gemini kotası yakmaz); olmazsa marka
          // gradyanına düşer.
          let statBg = null;
          try {
            const bgDest = path.join(mediaDir, `${idx}-statbg.jpg`);
            await generateAiImage(prompt, bgDest, { width, height, seed: sceneSeed });
            if (existsSync(bgDest)) statBg = bgDest;
          } catch { /* düz karta düş */ }
          const clip = await renderStatCard(scene.stat, dest, { width, height, duration: 8, bgImage: statBg });
          done = { ...clip, scene: i, source: 'gfx', provider: 'neosaniye-renderTemplate', license: 'proprietary-original', licenseEvidence: 'src/media/renderTemplate.js', statBg: Boolean(statBg) };
          gfxCount += 1;
          console.log(`[img] sahne ${idx}: sayı kartı (${scene.stat.value} ${scene.stat.unit || ''})${statBg ? ' [görsel zemin]' : ''}`);
        } else if (isUsableDiagram(scene.diagram)) {
          const dest = path.join(mediaDir, `${idx}-gfx.mp4`);
          const clip = await renderStepsCard(scene.diagram, dest, { width, height, duration: 8 });
          done = { ...clip, scene: i, source: 'gfx', provider: 'neosaniye-renderTemplate', license: 'proprietary-original', licenseEvidence: 'src/media/renderTemplate.js' };
          gfxCount += 1;
          console.log(`[img] sahne ${idx}: adım kartı ("${scene.diagram.title}", ${scene.diagram.steps.length} adım)`);
        }
      } catch (err) {
        console.warn(`[img] sahne ${idx}: gfx kartı üretilemedi (${String(err.message).slice(0, 90)}).`);
      }
    }

    // 0.arc) GERÇEK ARŞİV: sahne gerçek/adlı bir nesneyi gösteriyorsa önce
    // Wikimedia Commons / Met Museum'dan GERÇEK fotoğraf denenir — AI'nın
    // uydurduğu rekonstrüksiyon yerine gerçek eser (belgesel güvenilirliği).
    // DP real_subject vermediyse: anlatımdaki adlı gerçek varlığı deterministik
    // yakala (Sümela Monastery gibi). Video başına ≤2 arşiv görseli hedefle
    // (çeşitlilik korunsun, QC "hep aynı kaynak" cezasına düşmesin) → ≤3 deneme.
    if (!done && !scene.real_subject && archiveFbAttempts < 4 && sources.archive < 3) {
      const sub = detectRealSubject(scene.narration);
      if (sub) { scene.real_subject = sub; archiveFbAttempts += 1; }
    }

    if (!done && scene.real_subject) {
      const hit = await fetchArchiveImage(scene.real_subject, path.join(mediaDir, `${idx}-archive.jpg`))
        .catch(() => null);
      if (hit) {
        const identity = String(hit.assetId || hit.sourceUrl);
        if (!usedAssets.has(identity)) {
          usedAssets.add(identity);
          done = { ...hit, scene: i, source: 'archive' };
          console.log(`[img] sahne ${idx}: GERÇEK arşiv (${hit.provider}, ${hit.license}) — "${scene.real_subject}"`);
        }
      }
    }

    // 0) Hareketli sahne: stok video dene (bulunamazsa AI görsele devam).
    const motionSlot = processMode
      ? true
      : isLastScene ? false   // son plan düz görsel kalsın (loop kapanışı)
        : dpFlags ? scene.motion === true : i > 0 && i % motionEvery === 1;
    if (!done && canMotion && (processMode || i > 0) && motionSlot) {
      try {
        const hit = await fetchStockVideoForKeywords(
          scene.stock_keywords || scene.keywords,
          path.join(mediaDir, `${idx}-motion`),
          usedClips,
        );
        // Semantik alaka guard: stok klip anlatımla alakasız (yasak-uyumsuzluk
        // veya çok düşük örtüşme) ise KULLANMA — konuyla ilgisiz görsel
        // "bulundu diye" seçilmez; sahne AI/arşiv zincirine düşer.
        if (hit) {
          const rel = isAssetRelevant(scene.narration, hit.keyword, {
            minScore: config.retention.minSemanticRelevance,
            forbiddenMismatches: scene.forbidden_mismatches || [],
          });
          const identity = String(hit.assetId || hit.sourceUrl || hit.downloadUrl);
          if (rel.accepted && !usedAssets.has(identity)) {
            usedAssets.add(identity);
            done = { ...hit, scene: i, source: 'stock' };
          }
          else console.warn(`[img] sahne ${idx}: stok "${hit.keyword}" alakasız (skor ${rel.score}${rel.mismatch ? ', yasak-uyumsuzluk' : ''}) — atlandı.`);
        }
      } catch (err) {
        console.warn(`[img] sahne ${idx}: stok video hatası (${err.message}).`);
      }
    }

    // 1) AI görsel. Gemini kota dolarsa kalan sahnelerde denemez; Pollinations
    //    her sahnede tekrar dener (geçici hatalarda o sahne yedeğe düşer).
    if (!providerDead) {
      // BENZERSİZLİK KAPISI: üretilen kare önceki sahnelerden birine algısal
      // olarak çok benziyorsa (dHash) at ve farklı seed + kadraj zorlamasıyla
      // yeniden üret. Bu kapı olmadan FLUX aynı konuda hep aynı kareyi verdi.
      const uniqTries = Math.max(0, config.images.uniquenessRetries || 0);
      for (let uniq = 0; uniq <= uniqTries && !done; uniq += 1) {
        // Her benzersizlik turunda seed'i belirgin kaydır + ek kadraj direktifi.
        const trySeed = sceneSeed + uniq * 104729;
        const tryPrompt = uniq === 0
          ? prompt
          : [prompt, SHOT_VARIATIONS[(i + uniq * 5) % SHOT_VARIATIONS.length],
            'completely different composition, different angle, different framing'].join('. ');
        let candidate = null;

        for (let attempt = 0; attempt <= config.images.retries && !candidate; attempt += 1) {
          try {
            if (provider === 'pollinations') {
              const dest = path.join(mediaDir, `${idx}-ai.jpg`);
              const made = await generateAiImage(tryPrompt, dest, { width, height, seed: trySeed, negative });
              // PROVENANCE: kendi ürettiğimiz görselin "lisansı" bir üçüncü taraf
              // belgesi değil, üretim kaydıdır — sağlayıcı + model + prompt +
              // zaman. Bu alanlar null bırakıldığı için acil kalite kapısı her
              // videoda 20 kez ASSET_RIGHTS_EVIDENCE_MISSING veriyordu; sürekli
              // öten bir alarm, kapalı bir kapıyla aynı şey.
              candidate = { path: dest, type: 'photo', scene: i, source: 'ai', provider: made.provider, assetId: `${script.normalizedTopic}:${i}:${trySeed}`, query: tryPrompt, model: config.images.pollinationsModel, generatedAt: new Date().toISOString(), rightsClass: 'ai-generated', license: 'ai-generated-output', licenseEvidence: `${made.provider}:${config.images.pollinationsModel}` };
            } else if (provider === 'gemini') {
              const dest = path.join(mediaDir, `${idx}-ai.png`);
              const buf = await generateOne(geminiAI, tryPrompt);
              await writeFile(dest, buf);
              candidate = { path: dest, type: 'photo', scene: i, source: 'ai', provider: 'gemini', assetId: `${script.normalizedTopic}:${i}:${trySeed}`, query: tryPrompt, model: config.images.model, generatedAt: new Date().toISOString(), rightsClass: 'ai-generated', license: 'ai-generated-output', licenseEvidence: `gemini:${config.images.model}` };
            }
          } catch (err) {
            const msg = String(err?.message || err);
            if (provider === 'gemini' && /quota|RESOURCE_EXHAUSTED|429/i.test(msg)) {
              providerDead = true;
              console.warn(`[img] sahne ${idx}: Gemini kotası doldu, yedeklere geçiliyor.`);
              break;
            }
            if (attempt === config.images.retries) {
              console.warn(`[img] sahne ${idx}: AI görsel başarısız (${msg.slice(0, 120)}).`);
            }
          }
        }
        if (providerDead) break;
        if (!candidate) break; // üretim tamamen başarısız → yedek zincirine düş

        const hash = await perceptualHash(candidate.path);
        const { tooSimilar, nearest } = isTooSimilar(hash, aiHashes, config.images.minHashDistance);
        // Son turda benzer bile olsa kabul et (hiç görselsiz kalmaktan iyi).
        if (tooSimilar && uniq < uniqTries) {
          console.warn(`[img] sahne ${idx}: önceki kareye çok benziyor (mesafe ${nearest}) — yeniden üretiliyor.`);
          continue;
        }
        if (tooSimilar) {
          console.warn(`[img] sahne ${idx}: benzersizlik sağlanamadı (mesafe ${nearest}), kabul edildi.`);
        }
        if (hash != null) aiHashes.push(hash);
        candidate.visualHash = hash == null ? null : hash.toString(16);
        candidate.hashDistance = nearest;
        done = candidate;
      }
    }

    // 2) Stok yedeği (Pexels -> Pixabay) — video da foto da olabilir (tür korunur).
    if (!done && config.images.pexelsFallback && hasStockKey) {
      const destBase = path.join(mediaDir, `${idx}-stock`);
      try {
        const hit = await fetchOneForKeywords(scene.keywords, destBase);
        // hit.type: 'video' | 'photo' → normalizeClip buna göre işler.
        if (hit && !usedAssets.has(hit.assetId || hit.sourceUrl)) {
          usedAssets.add(hit.assetId || hit.sourceUrl);
          done = { ...hit, scene: i, source: 'pexels' };
        }
      } catch (err) {
        console.warn(`[img] sahne ${idx}: Pexels yedeği başarısız (${err.message}).`);
      }
    }

    // 3) Placeholder — asla kırılma.
    if (!done) {
      const destPh = path.join(mediaDir, `${idx}-bg.png`);
      await makePlaceholder(destPh, i + 1);
      done = { path: destPh, type: 'photo', scene: i, source: 'placeholder', provider: 'neosaniye-ffmpeg', assetId: `placeholder:${videoSeed}:${i}`, query: 'approved generated fallback background', generatedAt: new Date().toISOString(), rightsClass: 'repository-owned', license: 'proprietary-original', licenseEvidence: 'src/media/generateImages.js' };
    }

    done.query ||= scene.visual_query || scene.keywords?.join(' ') || scene.image_prompt || null;
    done.assetId ||= done.sourceUrl || `${done.provider || done.source}:${script.normalizedTopic || basename}:${i}`;
    done.retrievedAt ||= done.generatedAt || new Date().toISOString();
    done.rightsClass ||= done.source === 'ai'
      ? 'ai-generated'
      : done.source === 'gfx' || done.source === 'placeholder' ? 'repository-owned'
        : /^(CC0|public domain)$/i.test(done.license || '') ? 'cc0-public-domain'
          : done.attribution ? 'attribution-required' : 'externally-licensed';
    sources[done.source] += 1;
    items.push(done);
    console.log(`[img] sahne ${idx}/${scenes.length}: ${done.source} (${done.type})`);

    // HAREKET DİZİSİ: sahne canlı bir DAVRANIŞ anlatıyorsa ("balık yön
    // değiştirir") tek durağan kare o eylemi gösteremez — izleyici hareketi
    // görmeli. Eylemin ardışık anları üretilip aralarına sert kesme konur.
    // AYNI SEED kasıtlı: özne/kadraj sabit kalsın, değişen tek şey eylemin anı.
    const seqCfg = config.images.actionSequence;
    if (seqCfg?.enabled && sequenceCount < seqCfg.maxPerVideo && i > 0
        && done.type === 'photo' && done.source === 'ai'
        && (sceneSeconds[i] || 0) >= seqCfg.minSceneSeconds
        && !providerDead && classifyBeat(scene.narration)?.kind === 'behavior') {
      const phases = [
        'the instant BEFORE the action starts, subject still, tension held',
        'MID-ACTION: the movement is happening right now, motion blur on the moving part, body committed to the move',
        'immediately AFTER the action, subject in the new position, disturbed water and settling motion trails',
      ].slice(0, seqCfg.frames);
      // SÜREKLİLİK KAPISI. Dizinin dayanağı "aynı seed + faz promptu → aynı
      // sahne, değişen eylem" varsayımıdır. Bu varsayım her konuda tutmayabilir,
      // o yüzden VARSAYILMAZ, ÖLÇÜLÜR:
      //   çok benzer (mesafe < min) → kesme hiçbir şey göstermez, boşuna
      //   çok farklı (mesafe > max) → başka bir sahneye atlamış olur, kopukluk
      // İkisinde de kare atılır; hiç dizi kalmazsa sahne tek çekim olarak sürer.
      const baseHash = await perceptualHash(done.path);
      const SEQ_MIN = seqCfg.minChange ?? 3;
      const SEQ_MAX = seqCfg.maxChange ?? 26;
      const extra = [];
      for (let f = 1; f < phases.length; f += 1) {
        try {
          const dest = path.join(mediaDir, `${idx}-seq${f}.jpg`);
          const seqPrompt = [scene.image_prompt, phases[f], framing, anchor, stylePrefix, styleSuffix]
            .filter(Boolean).join('. ');
          await generateAiImage(seqPrompt, dest, { width, height, seed: sceneSeed, negative });
          if (!existsSync(dest)) break;
          const h = await perceptualHash(dest);
          const d = hammingDistance(baseHash, h);
          if (baseHash != null && h != null && (d < SEQ_MIN || d > SEQ_MAX)) {
            console.warn(`[img] sahne ${idx}: dizi karesi ${f} elendi (fark ${d}, ` +
              `${d < SEQ_MIN ? 'gözle görülür değişim yok' : 'sahne kopuyor'}).`);
            continue;
          }
          extra.push({
            ...done,
            path: dest,
            part: f,
            sequence: true,          // QC: dizi kareleri kasıtlı benzer, kopya sayılmaz
            motionHint: null,        // hareket KESMEDEN gelir, zoom'dan değil
            assetId: `${done.assetId}#seq${f}`,
            query: seqPrompt,
            seqDelta: d,
          });
        } catch (err) {
          console.warn(`[img] sahne ${idx}: dizi karesi ${f} üretilemedi (${String(err.message).slice(0, 70)}).`);
          break;
        }
      }
      // Kareler sırayla numaralansın (aradan eleme olmuş olabilir).
      extra.forEach((it, k) => { it.part = k + 1; });
      if (extra.length) {
        done.part = 0;
        done.sequence = true;
        done.motionHint = null;
        items.push(...extra);
        sequenceCount += 1;
        console.log(`[img] sahne ${idx}: HAREKET DİZİSİ → ${extra.length + 1} kare (${(sceneSeconds[i] / (extra.length + 1)).toFixed(1)}s/kare, sert kesme)`);
        continue; // dizi varken ayrıca tempo bölme yapma (ritim bozulmasın)
      }
    }

    // TEMPO BÖLME: uzun statik foto sahnesini İKİ alt-çekime böl — part0 geniş,
    // part1 GERÇEK yakın kadraj (merkez crop). Sert kesme + yakınlaşma = Shorts
    // retention. Aynı görsel, ekstra API yok. Video/gfx/placeholder ve hook(0)
    // bölünmez. part1 ayrı assetId → QC 'asset repeated' yanlış-tetiklenmesin.
    if (SPLIT_ENABLED && i > 0 && done.type === 'photo'
        && done.source !== 'gfx' && done.source !== 'placeholder'
        && (sceneSeconds[i] || 0) > SPLIT_SEC && existsSync(done.path)) {
      try {
        // MİKRO PLAN MERDİVENİ (V3 Faz 4). Eskiden tek bir "%66 merkez crop"
        // vardı ve video 10-13 planda kalıyordu (hedef 20-25). Artık sahne
        // süresine göre 1-2 EK kadraj üretilir; kadrajın NEREDEN alınacağını
        // hikâye şablonu belirler. Ekstra API maliyeti YOK — aynı görselden
        // farklı kesitler alınıyor.
        const secs = sceneSeconds[i] || 0;
        const ladder = shotLadder(scene.story_template, secs);
        let made = 0;
        for (const step of ladder) {
          const cropDest = path.join(mediaDir, `${idx}-${step.tag}.jpg`);
          await run('ffmpeg', ['-y', '-v', 'error', '-i', done.path,
            '-vf', `crop=iw*${step.z}:ih*${step.z}:iw*${step.x}:ih*${step.y},`
              + `scale=${width}:${height}:flags=lanczos`, cropDest],
          { maxBuffer: 20 * 1024 * 1024 });
          if (!existsSync(cropDest)) continue;
          made += 1;
          items.push({
            ...done, path: cropDest, part: made, subShot: true,
            motionHint: step.motion, assetId: `${done.assetId}#${step.tag}`,
          });
        }
        if (made) {
          done.part = 0;
          console.log(`[img] sahne ${idx}: mikro plan merdiveni → ${made + 1} kadraj `
            + `(${secs.toFixed(1)}s, ${scene.story_template || 'varsayılan'})`);
        }
      } catch { /* bölme best-effort — olmazsa tek çekim kalır */ }
    }

  }

  // LOOP KAPANIŞI: son plan, İLK planın görselini tekrar kullanır. Shorts'ta
  // video başa sarınca son kare ile ilk kare aynıysa dikiş görünmez ve izleyici
  // farkında olmadan tekrar izler (replay = Shorts görüntülenme motoru).
  // Canlıda ilk/son kare tamamen farklıydı (algısal mesafe 24) ve döngü kopuyordu.
  if (config.video.loopClosure !== false && items.length >= 4) {
    const first = items[0];
    const last = items[items.length - 1];
    // Yalnızca ikisi de düz görselse yap: gfx kartı ya da stok video olan bir
    // finali ezmek anlatıyı bozar (kart bilgi taşır, video kendi hareketini).
    const eligible = first?.type === 'photo' && last?.type === 'photo'
      && first.source !== 'gfx' && last.source !== 'gfx'
      && existsSync(first.path);
    if (eligible && first.path !== last.path) {
      items[items.length - 1] = {
        ...last,
        path: first.path,
        loopEcho: true,               // QC: kasıtlı tekrar, "kopya" sayılmaz
        motionHint: null,
        assetId: `${first.assetId}#loop`,
        query: first.query,
      };
      console.log('[img] loop kapanışı: son plan ilk görsele döndürüldü.');
    } else if (!eligible) {
      // Sessiz atlama teşhisi imkânsız kılıyordu ("yine loop yok").
      console.warn('[img] loop kapanışı ATLANDI — son plan uygun değil ' +
        `(tip=${last?.type}, kaynak=${last?.source}; ilk: tip=${first?.type}, kaynak=${first?.source}).`);
    }
  }

  return { mediaDir, items, sources };
}
