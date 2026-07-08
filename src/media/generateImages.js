import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { fetchOneForKeywords } from './fetchMedia.js';

const run = promisify(execFile);

/**
 * Faz 3 (yeni) — Sahne başına AI görsel üretimi (Google Gemini görsel modeli).
 *
 * Her sahne için `image_prompt` + ortak sinematik stille bir dikey görsel üretir.
 * Üretim başarısız olursa (kota/hata) Pexels stok görseline, o da olmazsa koyu
 * bir sinematik zemine (placeholder) düşer. Böylece boru hattı asla kırılmaz.
 */

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

  const useAI = config.images.enabled && config.gemini.apiKey;
  const ai = useAI ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

  const items = [];
  const sources = { ai: 0, pexels: 0, placeholder: 0 };
  let quotaHit = false;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const idx = String(i + 1).padStart(2, '0');
    const destPng = path.join(mediaDir, `${idx}-ai.png`);
    const prompt = `${scene.image_prompt}. ${config.images.styleSuffix}`;
    let done = null;

    // 1) AI görsel (kota dolduysa sonraki sahnelerde denemeyi bırak).
    if (ai && !quotaHit) {
      for (let attempt = 0; attempt <= config.images.retries && !done; attempt += 1) {
        try {
          const buf = await generateOne(ai, prompt);
          await writeFile(destPng, buf);
          done = { path: destPng, type: 'photo', scene: i, source: 'ai' };
        } catch (err) {
          const msg = String(err?.message || err);
          if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) {
            quotaHit = true;
            console.warn(`[img] sahne ${idx}: Gemini kotası doldu, yedeklere geçiliyor.`);
            break;
          }
          if (attempt === config.images.retries) {
            console.warn(`[img] sahne ${idx}: AI görsel başarısız (${msg.slice(0, 120)}).`);
          }
        }
      }
    }

    // 2) Pexels stok yedeği — video da foto da olabilir (tür korunur).
    if (!done && config.images.pexelsFallback && config.pexels.apiKey) {
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
