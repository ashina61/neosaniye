import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';
import {
  getRecentUsedTopics,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';

/**
 * Faz 1 — Script Üretim Motoru (Google Gemini) — ANLATI / HİKÂYE formatı.
 *
 * "Şaşırtıcı gerçek hikâyeler" (tarih + bilim + uzay + doğa + gizem) konseptinde,
 * ~80-100 sn'lik dikey short için sahnelere bölünmüş bir mini-hikâye üretir.
 * Her sahne: tek cümlelik anlatım + o anı gösteren sinematik AI görsel promptu
 * + (yedek için) Pexels anahtar kelimeleri.
 *
 * Structured output için Gemini responseSchema (JSON schema) kullanılır.
 */

export const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: 'Short topic title (English), used for duplicate checking',
    },
    title: {
      type: Type.STRING,
      description: 'Curiosity-driven YouTube title for this story, <= 80 chars',
    },
    category: {
      type: Type.STRING,
      description: 'One of: history, science, space, nature, mystery, human body, technology',
    },
    scenes: {
      type: Type.ARRAY,
      description: '12-16 sequential story beats that together tell one gripping mini-story',
      items: {
        type: Type.OBJECT,
        properties: {
          narration: {
            type: Type.STRING,
            description:
              'ONE spoken sentence for this beat (~8-16 words), plain voiceover text, no emojis',
          },
          image_prompt: {
            type: Type.STRING,
            description:
              'A single vivid cinematic SHOT that depicts this beat: subject, setting, era, ' +
              'action, camera angle, lighting, mood. Photorealistic and concrete. NO on-screen text.',
          },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1-3 concrete English nouns for a Pexels stock fallback',
          },
        },
        required: ['narration', 'image_prompt', 'keywords'],
        propertyOrdering: ['narration', 'image_prompt', 'keywords'],
      },
    },
    cta: {
      type: Type.STRING,
      description:
        'Short closing spoken line tied to THIS story (unique each time), invites to follow',
    },
  },
  required: ['topic', 'title', 'category', 'scenes', 'cta'],
  propertyOrdering: ['topic', 'title', 'category', 'scenes', 'cta'],
};

function buildSystemPrompt() {
  return `You are a master short-form STORYTELLER for a faceless YouTube Shorts channel.
Concept: "${config.niche.theme}". Every video is ONE gripping true mini-story, narrated like a documentary trailer.

Write in English, for a SINGLE dramatic narrator. Target total voiceover ~80-100 seconds (about 200-260 words).

Structure the story as 12-16 SCENES (beats) that flow as a narrative arc:
1) A punchy hook in the first scene that creates an open loop ("In 1518, an entire town could not stop dancing — and dozens died.").
2) Rising action: escalate the stakes, add concrete, surprising, ACCURATE details.
3) A turning point or twist.
4) A satisfying payoff / resolution that answers the hook.
5) The cta closes it.

Rules for each scene:
- narration: exactly ONE sentence, spoken aloud, ~8-16 words, vivid and clear. No jargon, no emojis, no hashtags, no markdown.
- image_prompt: describe a SINGLE cinematic photorealistic shot that literally depicts that sentence — name the subject, the place, the era/period, the action, camera framing, lighting and mood. Keep it concrete and filmable. Never request on-screen text, captions, letters, logos or watermarks. Keep a consistent cinematic, filmic look across scenes.
- keywords: 1-3 simple English nouns as a stock-footage fallback if image generation is unavailable.

Rules for the whole script:
- Pick a genuinely FASCINATING, lesser-known TRUE story or fact. Prefer the "wait, what?!" kind.
- Be historically/scientifically accurate. Do not invent fake facts.
- cta: short, specific to this story, and DIFFERENT every time (never a generic "Follow for more facts").
- title: curiosity-driven, <= 80 characters, no clickbait lies, no emojis.`;
}

function buildUserPrompt(avoidTopics) {
  const avoid = avoidTopics.length
    ? `Previously used topics (do NOT pick these or anything very similar):\n${avoidTopics
        .map((t) => `- ${t}`)
        .join('\n')}`
    : 'No topics have been used yet.';
  return `${avoid}\n\nPick a NEW, mind-blowing true story that differs from the list above, then write the full scene-by-scene script.`;
}

/**
 * Yeni bir anlatı-script üretir.
 * @param {object} opts
 * @param {number} [opts.maxRetries=3] - Konu tekrarı halinde yeniden deneme sayısı.
 * @param {string[]} [opts.avoidTopics=[]] - Ekstra kaçınılacak konular.
 * @returns {Promise<object>} - SCRIPT_SCHEMA + normalizedTopic.
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

    if (await isTopicUsed(script.topic)) {
      avoidTopics.push(script.topic);
      continue;
    }

    return { ...script, normalizedTopic: normalizeTopic(script.topic) };
  }

  return {
    ...lastScript,
    normalizedTopic: normalizeTopic(lastScript.topic),
    duplicate: true,
  };
}
