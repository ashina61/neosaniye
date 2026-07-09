import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';
import {
  getRecentUsedTopics,
  getTopPerformingTopics,
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
    hook_text: {
      type: Type.STRING,
      description:
        'A SHORT punchy on-screen COVER line for the first 2 seconds: 3-5 words, MAX 24 characters, ' +
        'shocking/curiosity-spiking (e.g. "AN ARMY LOST TO BIRDS", "A TOWN DANCED TO DEATH"). ' +
        'Must be a bold statement, not a full sentence. No period, no quotes.',
    },
    category: {
      type: Type.STRING,
      description: 'One of: history, science, space, nature, mystery, human body, technology',
    },
    visual_anchor: {
      type: Type.STRING,
      description:
        'ONE sentence describing the recurring visual identity every scene shares: the main ' +
        'subject/character (appearance, clothing, era), the setting, and the light/color mood. ' +
        'Used to keep all generated images consistent (e.g. "a weathered Australian soldier ' +
        'in a khaki 1930s uniform, dusty golden outback light, dry grassland").',
    },
    scenes: {
      type: Type.ARRAY,
      description: '7-9 sequential story beats that together tell one gripping mini-story',
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
    emphasis_words: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '6-12 single words copied EXACTLY as they appear in the narrations that deserve visual ' +
        'emphasis in captions: numbers, names, shock words, the twist word (e.g. "20,000", ' +
        '"emus", "surrendered", "vanished"). One word per entry, no phrases.',
    },
  },
  required: ['topic', 'title', 'hook_text', 'category', 'visual_anchor', 'scenes', 'cta', 'emphasis_words'],
  propertyOrdering: ['topic', 'title', 'hook_text', 'category', 'visual_anchor', 'scenes', 'cta', 'emphasis_words'],
};

// Format rotasyonu: izleyici tek kalıptan yorulmasın. Story ağırlıklı.
const FORMATS = [
  { key: 'story', weight: 6, brief: 'ONE gripping true mini-story with a narrative arc (hook, escalation, twist, payoff).' },
  { key: 'facts3', weight: 2, brief: 'THREE rapid-fire, jaw-dropping TRUE facts around one tight theme. Scene 1 hooks the theme; then each fact gets 2 scenes (setup + payoff); close with the best "wait, WHAT?" fact.' },
  { key: 'whatif', weight: 2, brief: 'A "What if...?" scenario answered with REAL science/history (e.g. "What if the Moon disappeared tonight?"). Grounded, accurate consequences presented as a story.' },
];
export function pickFormat(rand = Math.random()) {
  const totalW = FORMATS.reduce((a, f) => a + f.weight, 0);
  let r = rand * totalW;
  for (const f of FORMATS) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return FORMATS[0];
}

/** Reddit TIL'den trend konu tohumları (best-effort; olmadıysa boş döner). */
async function fetchTrendSeeds() {
  if (process.env.TREND_DISCOVERY === '0') return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      'https://www.reddit.com/r/todayilearned/top.json?t=week&limit=12',
      { signal: ctrl.signal, headers: { 'user-agent': 'neosaniye/1.0' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || [])
      .map((c) => String(c?.data?.title || '').replace(/^TIL:?\s*/i, '').trim())
      .filter((t) => t.length > 20 && t.length < 200)
      .slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function buildSystemPrompt(format) {
  return `You are a master short-form STORYTELLER for a faceless YouTube Shorts channel.
Concept: "${config.niche.theme}". This video's format: ${format.brief}

Write in English, for a SINGLE dramatic narrator. STRICT word budget: the total voiceover (all narrations + cta) must be 90-115 words — never more. That is ~35-42 seconds. Shorts are SHORT — hook fast, no filler, every sentence earns its place.

Structure the story as 7-9 SCENES (beats) that flow as a tight narrative arc:
1) A punchy hook in the FIRST scene that creates an open loop ("In 1518, an entire town could not stop dancing — and dozens died.").
2) Rising action: escalate fast, add ONE concrete, surprising, ACCURATE detail per beat.
3) A turning point or twist.
4) A satisfying payoff / resolution that answers the hook.
5) The cta closes it.

Rules for each scene:
- narration: exactly ONE sentence, spoken aloud, ~10-16 words, vivid and clear. No jargon, no emojis, no hashtags, no markdown.
- VARY the rhythm like a human storyteller: follow a long sentence with a short punchy one; use natural spoken phrasing (contractions are fine), never a monotone list of facts.
- image_prompt: describe a SINGLE cinematic photorealistic shot that literally depicts that sentence — name the subject, the place, the era/period, the action, camera framing, lighting and mood. Keep it concrete and filmable. Never request on-screen text, captions, letters, logos or watermarks.
- VISUAL CONTINUITY: every image_prompt must be consistent with the visual_anchor (same character appearance, same era, same light/color mood) so the story looks like ONE film, not random pictures.
- SHOT VARIETY (critical): consecutive scenes must NOT repeat the same framing or location. Rotate deliberately like a film editor: wide establishing shot → medium shot → intimate close-up of hands/objects → over-the-shoulder → extreme close-up detail → a different location/angle. State the shot scale explicitly in each image_prompt.
- LIGHTING: the main subject must be CLEARLY LIT and readable on a small phone screen, even in dark/moody scenes (bright key light on subject, darker background).
- keywords: 1-3 simple English nouns as a stock-footage fallback if image generation is unavailable.

Rules for the whole script:
- Pick a genuinely FASCINATING, lesser-known TRUE story or fact. Prefer the "wait, what?!" kind.
- ACCURACY IS MANDATORY. Use only well-documented, widely-accepted facts. Never invent events, quotes, names, or statistics. If a specific number or detail is uncertain, phrase it cautiously ("around", "some historians say") or leave it out. A wrong fact destroys the channel's credibility.
- cta: short, specific to this story, and DIFFERENT every time (never a generic "Follow for more facts").
- title: curiosity-driven, <= 80 characters, no clickbait lies, no emojis.`;
}

/** Geçici hatalarda (503 UNAVAILABLE / 5xx / ağ) sabırlı backoff ile dener.
 *  Google'ın "high demand" dalgaları dakikalar sürebilir; kısa backoff pes
 *  ettiriyordu (canlıda görüldü). Kota (429) hatasında ısrar etmez.  */
export async function generateWithRetry(ai, req, tries = 5) {
  const delays = [2000, 6000, 15000, 30000];
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await ai.models.generateContent(req);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (/quota|RESOURCE_EXHAUSTED|429|API key|permission/i.test(msg)) throw err;
      if (i < tries - 1) {
        const wait = delays[Math.min(i, delays.length - 1)];
        console.warn(`[gemini] geçici hata, ${wait / 1000}sn sonra tekrar (${i + 1}/${tries}): ${msg.slice(0, 90)}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

function buildUserPrompt(avoidTopics, { topPerformers = [], trendSeeds = [] } = {}) {
  const parts = [];
  parts.push(
    avoidTopics.length
      ? `Previously used topics (do NOT pick these or anything very similar):\n${avoidTopics
          .map((t) => `- ${t}`)
          .join('\n')}`
      : 'No topics have been used yet.',
  );
  if (topPerformers.length) {
    parts.push(
      'These past topics performed BEST with our audience (do not repeat them, but ' +
        'favor NEW topics with a similar flavor/energy):\n' +
        topPerformers.map((t) => `- ${t.topic} (${t.views} views)`).join('\n'),
    );
  }
  if (trendSeeds.length) {
    parts.push(
      'OPTIONAL inspiration — facts people are currently fascinated by (you may pick one, ' +
        'adapt one, or ignore them entirely):\n' +
        trendSeeds.map((t) => `- ${t}`).join('\n'),
    );
  }
  parts.push('Pick a NEW, mind-blowing TRUE topic that differs from the used list, then write the full scene-by-scene script.');
  return parts.join('\n\n');
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

  // Öğrenme döngüsü + trend tohumları (ikisi de best-effort).
  const [topPerformers, trendSeeds] = await Promise.all([
    getTopPerformingTopics(5).catch(() => []),
    fetchTrendSeeds(),
  ]);
  const format = pickFormat();
  console.log(
    `[script] format: ${format.key}` +
      (topPerformers.length ? `, öğrenme: ${topPerformers.length} iyi konu` : '') +
      (trendSeeds.length ? `, trend: ${trendSeeds.length} tohum` : ''),
  );

  let lastScript = null;
  let lengthFeedback = '';

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await generateWithRetry(ai, {
      model: config.gemini.model,
      contents:
        buildUserPrompt(avoidTopics, { topPerformers, trendSeeds }) +
        (lengthFeedback ? `\n\n${lengthFeedback}` : ''),
      config: {
        systemInstruction: buildSystemPrompt(format),
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

    // SÜRE ZORLAMASI: prompt'taki bütçe yetmiyor, saymadan kabul etme.
    // 125 kelime ≈ 45sn tavan; aşarsa aynı konuda kısaltma iste.
    const totalWords = [
      ...(script.scenes || []).map((s) => s.narration || ''),
      script.cta || '',
    ]
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (totalWords > 125 && attempt < maxRetries) {
      console.warn(`[script] ${totalWords} kelime — bütçe aşıldı, kısaltma isteniyor.`);
      lengthFeedback =
        `Your previous script about "${script.topic}" was ${totalWords} words — TOO LONG. ` +
        `Rewrite the SAME topic "${script.topic}" with the total voiceover under 110 words: ` +
        'fewer scenes (7 max), shorter sentences, cut the weakest details. Keep the same quality.';
      continue;
    }

    return { ...script, format: format.key, normalizedTopic: normalizeTopic(script.topic) };
  }

  return {
    ...lastScript,
    format: format.key,
    normalizedTopic: normalizeTopic(lastScript.topic),
    duplicate: true,
  };
}
