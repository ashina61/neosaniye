import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';

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
- description: 2-4 short lines; restate the hook, add value, end with a soft CTA. Plain text.
- tags: 8-15 relevant lowercase English keywords, no "#" prefix, no spaces-only entries.
Do not include markdown.`;

/** YouTube başlık/açıklama sınırlarına göre kırpar ve #Shorts ekler. */
function finalize(meta, script) {
  let title = (meta.title || script.topic || '').trim().slice(0, 95);
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

/**
 * @param {object} script - generateScript çıktısı.
 * @returns {Promise<{title:string, description:string, tags:string[]}>}
 */
export async function buildMetadata(script) {
  assertGemini();
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const prompt = `Topic: ${script.topic}
Hook: ${script.hook}
Body: ${script.body}
CTA: ${script.cta}

Produce the metadata.`;

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
}
