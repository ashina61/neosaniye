import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
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
export async function generateImages(script, opts = {}) {
  const scenes = script.scenes || [];
  if (!scenes.length) throw new Error('script.scenes boş — anlatı sahneleri gerekli.');

  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    style = 'photo', // 'photo' | 'animated' (illüstrasyon)
    sceneSeconds = [], // tahmini sahne süreleri — uzun statikler ikiye bölünür
  } = opts;

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
  let providerDead = provider === 'none' || (provider === 'gemini' && !geminiAI);
  // Motion graphics (sayı kartı) sayacı — video başına üst sınır.
  let gfxCount = 0;
  // Bu videoda kullanılan stok klip URL'leri — aynı klip iki sahnede tekrarlanmaz.
  const usedClips = new Set();
  // Uzun statik sahne bölme sayacı (video başına üst sınır — süre bütçesi).
  let splitCount = 0;

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

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const idx = String(i + 1).padStart(2, '0');
    const prompt = [scene.image_prompt, anchor, styleSuffix]
      .filter(Boolean)
      .join('. ');
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
          const clip = await renderStatCard(scene.stat, dest, { width, height, duration: 8 });
          done = { ...clip, scene: i, source: 'gfx' };
          gfxCount += 1;
          console.log(`[img] sahne ${idx}: sayı kartı (${scene.stat.value} ${scene.stat.unit || ''})`);
        } else if (isUsableDiagram(scene.diagram)) {
          const dest = path.join(mediaDir, `${idx}-gfx.mp4`);
          const clip = await renderStepsCard(scene.diagram, dest, { width, height, duration: 8 });
          done = { ...clip, scene: i, source: 'gfx' };
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
    if (!done && scene.real_subject) {
      const hit = await fetchArchiveImage(scene.real_subject, path.join(mediaDir, `${idx}-archive.jpg`))
        .catch(() => null);
      if (hit) {
        done = { ...hit, scene: i, source: 'archive' };
        console.log(`[img] sahne ${idx}: GERÇEK arşiv (${hit.provider}, ${hit.license}) — "${scene.real_subject}"`);
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
          if (rel.accepted) done = { ...hit, scene: i, source: 'stock' };
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
            await fetchPollinations(prompt, dest, { width, height, seed: videoSeed });
            done = { path: dest, type: 'photo', scene: i, source: 'ai' };
          } else if (provider === 'gemini') {
            const dest = path.join(mediaDir, `${idx}-ai.png`);
            const buf = await generateOne(geminiAI, prompt);
            await writeFile(dest, buf);
            done = { path: dest, type: 'photo', scene: i, source: 'ai' };
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
        if (hit) done = { ...hit, scene: i, source: 'pexels' };
      } catch (err) {
        console.warn(`[img] sahne ${idx}: Pexels yedeği başarısız (${err.message}).`);
      }
    }

    // 3) Placeholder — asla kırılma.
    if (!done) {
      const destPh = path.join(mediaDir, `${idx}-bg.png`);
      await makePlaceholder(destPh, i + 1);
      done = { path: destPh, type: 'photo', scene: i, source: 'placeholder' };
    }

    sources[done.source] += 1;
    items.push(done);
    console.log(`[img] sahne ${idx}/${scenes.length}: ${done.source} (${done.type})`);

    // TEMPO BÖLMESİ: 4.3sn'yi aşan STATİK AI sahnesi ikinci bir kadraj alır
    // (farklı seed = farklı kompozisyon; Ken Burns yönü de plan indeksiyle
    // değiştiği için iki parça gerçekten iki ayrı plan gibi durur).
    const estSec = Number(sceneSeconds[i] || 0);
    if (done.source === 'ai' && provider === 'pollinations' && estSec > 4.3 && splitCount < 3) {
      try {
        const dest2 = path.join(mediaDir, `${idx}b-ai.jpg`);
        await fetchPollinations(prompt, dest2, { width, height, seed: videoSeed + 977 + i });
        items.push({ path: dest2, type: 'photo', scene: i, source: 'ai', part: 2 });
        sources.ai += 1;
        splitCount += 1;
        console.log(`[img] sahne ${idx}: uzun statik (${estSec.toFixed(1)}s) -> 2 plana bölündü`);
      } catch {
        /* bölme başarısızsa tek planla devam — kırılma yok */
      }
    }
  }

  return { mediaDir, items, sources };
}
