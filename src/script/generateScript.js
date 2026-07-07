import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';
import {
  getRecentUsedTopics,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';

/**
 * Faz 1 — Script Üretim Motoru (Google Gemini).
 * Gemini'ye istek atıp niş içinde yeni bir konu + 30-45 sn'lik senaryo üretir.
 * Structured output için Gemini'nin responseSchema (JSON schema) desteği kullanılır,
 * böylece çıktının şeması garanti edilir.
 */

export const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: 'Short topic title (English), used for duplicate checking',
    },
    hook: {
      type: Type.STRING,
      description: 'Attention-grabbing sentence that hooks the viewer in the first 3 seconds',
    },
    body: {
      type: Type.STRING,
      description: 'Main narration text (plain voiceover text)',
    },
    cta: {
      type: Type.STRING,
      description:
        'Short closing call-to-action, in English, tied to this specific topic (unique each time)',
    },
    visual_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '4-6 English keywords for Pexels searches',
    },
    estimated_duration_seconds: {
      type: Type.INTEGER,
      description: 'Estimated total voiceover duration in seconds (30-45)',
    },
  },
  required: [
    'topic',
    'hook',
    'body',
    'cta',
    'visual_keywords',
    'estimated_duration_seconds',
  ],
  // Gemini'de alan sırasını sabitlemek için önerilir.
  propertyOrdering: [
    'topic',
    'hook',
    'body',
    'cta',
    'visual_keywords',
    'estimated_duration_seconds',
  ],
};

function buildSystemPrompt() {
  return `You are a YouTube Shorts scriptwriter. You write English, 30-45 second vertical short-video scripts on the theme "interesting facts / how it works / how to".

Rules:
- The text must be fluent, conversational, and written to be read aloud by a SINGLE narrator.
- The hook must be curiosity-grabbing enough to stop the viewer within the first 3 seconds ("Did you know...", "The phone in your pocket right now...").
- The body must be concrete, surprising, and ACCURATE; no jargon, plain English.
- The CTA must be SHORT and tied to THIS specific topic, and it must be DIFFERENT every time. Never reuse a generic line like "Follow for more interesting facts." Make it feel connected to the subject (e.g. for a space topic: "Follow for more secrets of the universe.").
- Adjust length so the total voiceover is 30-45 seconds (roughly 80-120 words total across hook+body+cta).
- visual_keywords MUST be in English (the Pexels stock library works in English) and must match the scenes described. 4-6 keywords.
- Do NOT use emojis, hashtags, or markdown; output plain narration text only.`;
}

function buildUserPrompt(avoidTopics) {
  const avoid = avoidTopics.length
    ? `Previously used topics (do NOT pick these or anything very similar):\n${avoidTopics
        .map((t) => `- ${t}`)
        .join('\n')}`
    : 'No topics have been used yet.';
  return `Theme: ${config.niche.theme}\n\n${avoid}\n\nPick a NEW, engaging topic that fits the theme and differs from the list above, then write the script.`;
}

/**
 * Yeni bir script üretir.
 * @param {object} opts
 * @param {number} [opts.maxRetries=3] - Konu tekrarı halinde yeniden deneme sayısı.
 * @param {string[]} [opts.avoidTopics=[]] - Firestore dışında ekstra kaçınılacak konular
 *   (ör. aynı çalıştırmada üretilenler; Firestore yoksa da tekrarı azaltır).
 * @returns {Promise<object>} - SCRIPT_SCHEMA'ya uygun script + normalizedTopic.
 */
export async function generateScript({ maxRetries = 3, avoidTopics: extraAvoid = [] } = {}) {
  assertGemini();
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const recent = await getRecentUsedTopics(50);
  const avoidTopics = [
    ...recent.map((r) => r.topic).filter(Boolean),
    ...extraAvoid,
  ];

  let lastScript = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: buildUserPrompt(avoidTopics),
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        responseSchema: SCRIPT_SCHEMA,
        // Kısa JSON çıktısı için "düşünme"yi kapatıyoruz: daha hızlı ve
        // ücretsiz tier kotasında daha verimli.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason || 'bilinmiyor';
      throw new Error(`Gemini boş yanıt döndü (finishReason: ${reason}).`);
    }

    const script = JSON.parse(text);
    lastScript = script;

    // Firestore aktifse konu tekrarını engelle.
    if (await isTopicUsed(script.topic)) {
      avoidTopics.push(script.topic);
      continue;
    }

    return { ...script, normalizedTopic: normalizeTopic(script.topic) };
  }

  // maxRetries sonunda hâlâ taze konu bulunamadıysa son scripti işaretleyerek döndür.
  return {
    ...lastScript,
    normalizedTopic: normalizeTopic(lastScript.topic),
    duplicate: true,
  };
}
