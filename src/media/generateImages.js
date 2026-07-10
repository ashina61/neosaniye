import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { fetchOneForKeywords, fetchStockVideoForKeywords } from './fetchMedia.js';

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
  const sources = { ai: 0, stock: 0, pexels: 0, placeholder: 0 };
  let providerDead = provider === 'none' || (provider === 'gemini' && !geminiAI);

  // Hareketli sahne planı: Görüntü Yönetmeni sahneleri işaretlediyse (motion)
  // onlar; yoksa mekanik "her N. sahne". İlk sahne her zaman hariç (hook kapağı).
  const motionEvery = Math.max(0, config.images.motionEvery || 0);
  const hasStockKey = Boolean(config.pexels.apiKey || config.pixabay.apiKey);
  const canMotion = motionEvery > 0 && hasStockKey;
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

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const idx = String(i + 1).padStart(2, '0');
    const prompt = [scene.image_prompt, anchor, config.images.styleSuffix]
      .filter(Boolean)
      .join('. ');
    let done = null;

    // 0) Hareketli sahne: stok video dene (bulunamazsa AI görsele devam).
    const motionSlot = dpFlags ? scene.motion === true : i > 0 && i % motionEvery === 1;
    if (canMotion && i > 0 && motionSlot) {
      try {
        const hit = await fetchStockVideoForKeywords(
          scene.stock_keywords || scene.keywords,
          path.join(mediaDir, `${idx}-motion`),
        );
        if (hit) done = { ...hit, scene: i, source: 'stock' };
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
  }

  return { mediaDir, items, sources };
}
