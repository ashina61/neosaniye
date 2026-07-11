import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import { softenAdText } from '../lib/adSafe.js';

/**
 * Faz 6 — Script'ten YouTube Shorts meta verisi (başlık/açıklama/tag) üretir.
 * Gemini + structured output kullanır. #Shorts her zaman garanti edilir.
 */

const META_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Merak uyandıran YouTube Shorts başlığı, en fazla 90 karakter',
    },
    description: {
      type: Type.STRING,
      description:
        '2-4 satır açıklama: kancayı yeniden ifade et, değer ver, kısa bir CTA ekle',
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '8-15 alakalı İngilizce etiket (hashtag işareti olmadan)',
    },
  },
  required: ['title', 'description', 'tags'],
  propertyOrdering: ['title', 'description', 'tags'],
};

const SYSTEM = `You write high-CTR YouTube Shorts metadata in English for a faceless "interesting facts / how it works / how to" channel.
Rules:
- title: curiosity-driven, <= 90 chars, no clickbait lies, no emojis.
- ADVERTISER-SAFE TITLE: never put explicit words of violence, death, drugs, weapons, or any
  profanity in the title (e.g. "killed", "murder", "dead", "suicide", "blood", "drugs", "gun")
  — these limit ads (yellow $). Use curiosity and intrigue instead ("vanished", "the end came",
  "never returned", "what really happened").
- description: 2-4 short lines; restate the hook, add value, end with a soft CTA. Plain text.
- tags: 8-15 relevant lowercase English keywords, no "#" prefix, no spaces-only entries.
Do not include markdown.`;

/** YouTube başlık/açıklama sınırlarına göre kırpar ve #Shorts ekler. */
function finalize(meta, script) {
  // Reklam-dostu güvenlik ağı: başlıktaki riskli kelimeleri yumuşat (sarı $ önlemi).
  let title = softenAdText((meta.title || script.topic || '').trim(), 'başlık').slice(0, 95);
  if (!/#shorts/i.test(title) && title.length <= 88) title += ' #Shorts';

  const hashtags = (meta.tags || [])
    .slice(0, 5)
    .map((t) => '#' + t.replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length > 1)
    .join(' ');
  let description = (meta.description || '').trim();
  description += `\n\n${hashtags} #Shorts`.trimEnd();
  description = description.slice(0, 4900); // YouTube limiti 5000

  const tags = Array.from(new Set([...(meta.tags || []), 'shorts']))
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 15);

  return { title, description, tags };
}

/** Anlatı script'ini tek düz metne çevirir (scenes -> narration). */
function scriptBody(script) {
  if (Array.isArray(script.scenes) && script.scenes.length) {
    return script.scenes.map((s) => s.narration).filter(Boolean).join(' ');
  }
  return script.body || '';
}

/** Gemini erişilemezse (kota/hata) script'ten makul bir meta veri üretir. */
function fallbackMeta(script) {
  const stop = new Set(
    ('the a an and or of to in on for with how why what is are this that it its ' +
      'your you we do does can will from at by as be').split(' '),
  );
  const body = scriptBody(script);
  const sceneKeywords = (script.scenes || []).flatMap((s) => s.keywords || []);
  const words = `${script.topic} ${body}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const tags = Array.from(new Set([...sceneKeywords, ...words])).slice(0, 12);
  const hook = (script.scenes?.[0]?.narration) || script.hook || script.topic;
  const description = [hook, '', script.cta || 'Follow for more!'].join('\n');
  return finalize({ title: script.title || script.topic, description, tags }, script);
}

/**
 * @param {object} script - generateScript çıktısı.
 * @returns {Promise<{title:string, description:string, tags:string[]}>}
 */
export async function buildMetadata(script) {
  // Gemini yoksa/kota dolduysa upload'ı düşürme — script'ten üret.
  if (!config.gemini.apiKey) return fallbackMeta(script);
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const prompt = `Topic: ${script.topic}
Working title: ${script.title || script.topic}
Story narration: ${scriptBody(script)}
CTA: ${script.cta}

Produce the metadata.`;

  try {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: META_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini meta verisi boş döndü.');
    return finalize(JSON.parse(text), script);
  } catch (err) {
    // Kota (429) veya geçici hata: video zaten hazır, basit meta ile yine yükle.
    console.warn(
      `[meta] Gemini meta verisi alınamadı (${err?.message || err}). ` +
        'Script tabanlı yedek meta kullanılıyor.',
    );
    return fallbackMeta(script);
  }
}
