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

const run = promisify(execFile);

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
async function fetchPollinations(prompt, dest, { width, height, seed }) {
  const model = config.images.pollinationsModel;
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true`;
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
  // GÖRSEL TUTARLILIK: sabit seed modunda TÜM sahneler aynı seed'i kullanır
  // (aynı estetik/karakter/dönem/ışık). Kapalıysa her sahne farklı seed.
  const useFixedSeed = config.images.fixedSeed !== false;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const idx = String(i + 1).padStart(2, '0');
    const prompt = [stylePrefix, scene.image_prompt, anchor, styleSuffix]
      .filter(Boolean)
      .join('. ');
    // Sahne seed'i: sabit modda tek video seed'i (tutarlılık); değilse eski
    // sahne-başı türetme (çeşitlilik).
    const sceneSeed = useFixedSeed ? videoSeed : videoSeed + i * 997;
    let done = null;

    // 0.gfx) MOTION GRAPHICS kartları: sayı sayacı (stat) veya "how it works"
    // adım kartı (diagram). Guard: video başına üst sınır + sahne-1 hariç +
    // stat için anti-halüsinasyon (isUsableStat). Hata → normal görsel zinciri.
    if (config.video.gfx && gfxCount < config.video.gfxMaxPerVideo && i > 0) {
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
            await fetchPollinations(prompt, bgDest, { width, height, seed: sceneSeed });
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
    if (!done && !scene.real_subject && archiveFbAttempts < 3 && sources.archive < 2) {
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
      for (let attempt = 0; attempt <= config.images.retries && !done; attempt += 1) {
        try {
          if (provider === 'pollinations') {
            const dest = path.join(mediaDir, `${idx}-ai.jpg`);
            await fetchPollinations(prompt, dest, { width, height, seed: sceneSeed });
            done = { path: dest, type: 'photo', scene: i, source: 'ai', provider: 'pollinations', assetId: `${script.normalizedTopic}:${i}:${sceneSeed}`, query: prompt, model: config.images.pollinationsModel, generatedAt: new Date().toISOString(), rightsClass: 'ai-generated', license: null, licenseEvidence: null };
          } else if (provider === 'gemini') {
            const dest = path.join(mediaDir, `${idx}-ai.png`);
            const buf = await generateOne(geminiAI, prompt);
            await writeFile(dest, buf);
            done = { path: dest, type: 'photo', scene: i, source: 'ai', provider: 'gemini', assetId: `${script.normalizedTopic}:${i}:${videoSeed}`, query: prompt, model: config.images.model, generatedAt: new Date().toISOString(), rightsClass: 'ai-generated', license: null, licenseEvidence: null };
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

    // TEMPO BÖLME: uzun statik foto sahnesini İKİ alt-çekime böl — part0 geniş,
    // part1 GERÇEK yakın kadraj (merkez crop). Sert kesme + yakınlaşma = Shorts
    // retention. Aynı görsel, ekstra API yok. Video/gfx/placeholder ve hook(0)
    // bölünmez. part1 ayrı assetId → QC 'asset repeated' yanlış-tetiklenmesin.
    if (SPLIT_ENABLED && i > 0 && done.type === 'photo'
        && done.source !== 'gfx' && done.source !== 'placeholder'
        && (sceneSeconds[i] || 0) > SPLIT_SEC && existsSync(done.path)) {
      try {
        const cropDest = path.join(mediaDir, `${idx}-b.jpg`);
        // Merkezden ~%66 crop + tam boyuta ölçekle → belirgin daha yakın çekim.
        await run('ffmpeg', ['-y', '-v', 'error', '-i', done.path,
          '-vf', `crop=iw*0.66:ih*0.66,scale=${width}:${height}:flags=lanczos`, cropDest],
          { maxBuffer: 20 * 1024 * 1024 });
        if (existsSync(cropDest)) {
          done.part = 0;
          const partB = {
            ...done, path: cropDest, part: 1, subShot: true,
            motionHint: 'detail-zoom', assetId: `${done.assetId}#b`,
          };
          items.push(partB);
          console.log(`[img] sahne ${idx}: tempo bölme → 2 alt-çekim (${sceneSeconds[i].toFixed(1)}s, punch-in)`);
        }
      } catch { /* bölme best-effort — olmazsa tek çekim kalır */ }
    }

  }

  return { mediaDir, items, sources };
}
