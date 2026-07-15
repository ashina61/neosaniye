import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';
import {
  getRecentUsedTopics,
  getTopPerformingTopics,
  getWinningHooks,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';
import { softenAdText } from '../lib/adSafe.js';

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
    hook_candidates: {
      type: Type.ARRAY,
      description:
        'HOOK LAB: exactly 6 alternative cover lines for this story, each 3-5 words / MAX 26 chars, ' +
        'each a DIFFERENT angle (impossible claim, curiosity gap, direct shock, question, number, irony). ' +
        'Score each 1-100 for SCROLL-STOP power: would a bored phone user freeze mid-swipe?',
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'The candidate cover line' },
          score: { type: Type.INTEGER, description: 'Scroll-stop score 1-100' },
        },
        required: ['text', 'score'],
        propertyOrdering: ['text', 'score'],
      },
    },
    hook_text: {
      type: Type.STRING,
      description:
        'THE WINNING candidate from hook_candidates (highest scroll-stop score), copied exactly: ' +
        'a SHORT punchy on-screen COVER line for the first 2 seconds, 3-5 words, MAX 26 characters, ' +
        'natural sentence case with proper-noun capitals (e.g. "Rasputin wouldn\'t die"). ' +
        'A bold statement, not a full sentence. No period, no quotes, NOT all-caps.',
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
        'Short closing line tied to THIS story (unique each time), invites to follow. ' +
        'NOT spoken in the voiceover — used only in the description/on-screen, so keep it snappy.',
    },
    emphasis_words: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '6-12 single words copied EXACTLY as they appear in the narrations that deserve visual ' +
        'emphasis in captions: numbers, names, shock words, the twist word (e.g. "20,000", ' +
        '"emus", "surrendered", "vanished"). One word per entry, no phrases.',
    },
    finale_text: {
      type: Type.STRING,
      description:
        'The mic-drop phrase of the story, 3-7 words, shown as an elegant on-screen title in the ' +
        'final seconds (e.g. "the biggest drug dealer in history", "a war lost to birds"). ' +
        'Lowercase feel, no period, no quotes.',
    },
  },
  required: ['topic', 'title', 'hook_candidates', 'hook_text', 'category', 'visual_anchor', 'scenes', 'cta', 'emphasis_words', 'finale_text'],
  propertyOrdering: ['topic', 'title', 'hook_candidates', 'hook_text', 'category', 'visual_anchor', 'scenes', 'cta', 'emphasis_words', 'finale_text'],
};

// Format rotasyonu: izleyici tek kalıptan yorulmasın. Story + how-it-works +
// process (gerçek görüntü öncelikli) ağırlıklı.
// Ağırlık dengesi (15 Tem): process 6→3 — %46 process = yarı yarıya tamamen
// stok-klip video; niş konularda kütüphanede birebir görüntü olmayınca alakasız
// klipler giriyor ve kalite hissi düşüyordu. story 2→3 (Moon Hoax: 433 izlenme
// + %167 retention — kanalın en iyi videosu bir story/history idi), facts3 1→2.
const FORMATS = [
  { key: 'story', weight: 3, brief: 'ONE gripping true mini-story with a narrative arc (hook, escalation, twist, payoff).' },
  {
    key: 'howworks',
    weight: 3,
    brief:
      'Explain HOW something fascinating actually works, step by step, as a visual journey ' +
      '(e.g. "How do octopuses vanish in plain sight?", "How does a hurricane build its power?"). ' +
      'Each scene = one step of the process, building to a satisfying "so THAT\'s why" payoff. ' +
      'STRONGLY prefer subjects that exist in real film footage: nature, animals, weather, machines, ' +
      'the human body, space, oceans, cities — these will be shown with REAL video clips.',
  },
  {
    key: 'process',
    weight: 3,
    brief:
      'A mesmerizing REAL-FOOTAGE "watch how this is actually done/made" video (a craft, a repair, ' +
      'a manufacturing process, cooking, a machine at work, nature in action). The narrator is a ' +
      'fascinated guide REACTING to what the viewer is literally watching and explaining the hidden ' +
      'why behind each step. The entire video is built from real stock clips — pick a subject with ' +
      'ABUNDANT generic footage.',
  },
  { key: 'facts3', weight: 2, brief: 'THREE rapid-fire, jaw-dropping TRUE facts around one tight theme. Scene 1 hooks the theme; then each fact gets 2 scenes (setup + payoff); close with the best "wait, WHAT?" fact.' },
  { key: 'whatif', weight: 1, brief: 'A "What if...?" scenario answered with REAL science/history (e.g. "What if the Moon disappeared tonight?"). Grounded, accurate consequences presented as a story.' },
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
  // process formatı: görüntü GERÇEK stok kliplerden gelir — kurallar farklı.
  const processExtra =
    format.key === 'process'
      ? `

PROCESS FORMAT RULES (this video is built from REAL stock footage, not generated images):
- keywords are the PRIMARY visual source here: write 2-3 SEARCHABLE stock-video phrases per scene
  (action + object, e.g. "blacksmith forging closeup", "glassblowing furnace", "pouring epoxy resin
  table"). Generic and common — a stock library must plausibly HAVE this clip. No names, no eras.
- narration speaks TO the footage like a fascinated guide, present tense: "Watch what he does
  next...", "See that paste? It's not glue.", "This is the part nobody expects." Make the viewer
  feel they're watching one continuous demonstration.
- Choose subjects with abundant stock coverage: woodworking, forging, glassblowing, pottery,
  baking, coffee roasting, machining, welding, farming, fishing, weaving, printing, honey
  harvesting, cheese making. AVOID one-off events, specific people, or historical reenactments.
- Still fill image_prompt for every scene (used only as a fallback if no clip is found).`
      : '';
  return `You are a master short-form STORYTELLER for a faceless YouTube Shorts channel.
Concept: "${config.niche.theme}". This video's format: ${format.brief}${processExtra}

Write in English, for a SINGLE dramatic narrator. STRICT word budget: the spoken voiceover is the SCENE NARRATIONS ONLY (the cta is NOT spoken) and their total must be 85-100 words — never more. That is ~35-40 seconds. Shorts are SHORT — hook fast, no filler, every sentence earns its place.

Structure the story as 7-8 SCENES (beats) that flow as a tight narrative arc:
1) A punchy hook in the FIRST scene that creates an open loop ("In 1518, an entire town could not stop dancing — and dozens died.").
2) Rising action: escalate fast, add ONE concrete, surprising, ACCURATE detail per beat.
3) A turning point or twist.
4) A satisfying payoff / resolution in the FINAL scene that answers the hook (the story ends on this beat — the cta is a separate on-screen/description line, never spoken).

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
- cta: short, specific to this story, and DIFFERENT every time (never a generic "Follow for more facts"). It is NOT spoken — description/on-screen only — so do not write it as a narration line.
- title: curiosity-driven, <= 80 characters, no clickbait lies, no emojis.
- MONETIZATION-SAFE LANGUAGE: the title, hook_text, and the FIRST scene's narration must be
  advertiser-friendly — build curiosity/intrigue and AVOID explicit words of violence, death,
  drugs, weapons or any profanity there (prefer "vanished", "the end came", "never returned",
  "did not survive" over "killed/murdered/suicide/blood"). In later scenes, state the facts
  accurately and neutrally, but never gratuitously graphic; prefer "died", "perished", "lost their
  lives" over harsher wording, and never use profanity or slurs. Accuracy still comes first.`;
}

/** GROQ YEDEK BEYNİ: Gemini tamamen düştüğünde aynı istek ücretsiz Groq'a
 *  (Llama, OpenAI-uyumlu uç) gider. responseSchema JSON moda + sistem mesajına
 *  gömülür; dönen {text} Gemini yanıtıyla aynı şekilde okunur (response.text).
 *  Aşağı akıştaki doğrulama/sanitize katmanları bozuk çıktıyı zaten yakalar. */
async function groqFallback(req) {
  if (!config.groq.apiKey) return null;
  const schema = req.config?.responseSchema;
  const sys = [
    req.config?.systemInstruction || '',
    schema
      ? 'Respond with ONLY one valid JSON object matching this JSON schema — no markdown fences, no commentary:\n' +
        JSON.stringify(schema)
      : 'Respond concisely in plain text.',
  ].join('\n\n');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.groq.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.groq.model,
      temperature: 0.8,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: String(req.contents) },
      ],
      ...(schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`groq HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('groq boş yanıt');
  return { text };
}

/** Geçici hatalarda (503 UNAVAILABLE / 5xx / ağ) sabırlı backoff ile dener.
 *  Google'ın "high demand" dalgaları dakikalar sürebilir; kısa backoff pes
 *  ettiriyordu (canlıda görüldü). Kota (429) hatasında Gemini'de ısrar etmez;
 *  her tükenişte (kota dahil) GROQ_API_KEY varsa yedek beyne geçilir. */
export async function generateWithRetry(ai, req, tries = 5) {
  const delays = [2000, 6000, 15000, 30000];
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await ai.models.generateContent(req);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (/quota|RESOURCE_EXHAUSTED|429|API key|permission/i.test(msg)) break;
      if (i < tries - 1) {
        const wait = delays[Math.min(i, delays.length - 1)];
        console.warn(`[gemini] geçici hata, ${wait / 1000}sn sonra tekrar (${i + 1}/${tries}): ${msg.slice(0, 90)}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  try {
    const alt = await groqFallback(req);
    if (alt) {
      console.warn(`[groq] Gemini düştü — yedek beyin devrede (${config.groq.model}).`);
      return alt;
    }
  } catch (gErr) {
    console.warn(`[groq] yedek de düştü: ${String(gErr.message).slice(0, 90)}`);
  }
  throw lastErr;
}

function buildUserPrompt(avoidTopics, { topPerformers = [], trendSeeds = [], strategyBrief = '', winningHooks = [] } = {}) {
  const parts = [];
  if (strategyBrief) {
    parts.push(
      'DATA-DRIVEN STRATEGY (from our own view analytics — let it steer your topic/angle choice):\n' +
        strategyBrief,
    );
  }
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
  if (winningHooks.length) {
    parts.push(
      'PROVEN HOOKS — these opening lines earned our channel the MOST views. Study their ' +
        'energy (impossible claim, curiosity gap, "wait what?!") and write your hook_text ' +
        'and first scene with the SAME punch (do not copy them):\n' +
        winningHooks.map((h) => `- "${h.hook}" (${h.views} views)`).join('\n'),
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
export async function generateScript({ maxRetries = 3, avoidTopics: extraAvoid = [], strategyBrief = '' } = {}) {
  assertGemini();
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  // 120: eski kanaldan tohumlanan konular da kaçınma listesinde kalsın.
  const recent = await getRecentUsedTopics(120);
  const avoidTopics = [
    ...recent.map((r) => r.topic).filter(Boolean),
    ...extraAvoid,
  ];

  // Öğrenme döngüsü + trend tohumları (ikisi de best-effort).
  const [topPerformers, trendSeeds, winningHooks] = await Promise.all([
    getTopPerformingTopics(5).catch(() => []),
    fetchTrendSeeds(),
    getWinningHooks(3).catch(() => []),
  ]);
  // FORCE_FORMAT ile format sabitlenebilir (test için; ör. 'process').
  const forced = String(process.env.FORCE_FORMAT || '').trim();
  const format = FORMATS.find((f) => f.key === forced) || pickFormat();
  console.log(
    `[script] format: ${format.key}${forced === format.key ? ' (zorlandı)' : ''}` +
      (topPerformers.length ? `, öğrenme: ${topPerformers.length} iyi konu` : '') +
      (trendSeeds.length ? `, trend: ${trendSeeds.length} tohum` : ''),
  );

  let lastScript = null;
  let lengthFeedback = '';

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await generateWithRetry(ai, {
      model: config.gemini.model,
      contents:
        buildUserPrompt(avoidTopics, { topPerformers, trendSeeds, strategyBrief, winningHooks }) +
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

    // SÜRE ZORLAMASI: yalnızca SESLENDİRİLEN sahne anlatımları sayılır (cta seslendirilmiyor).
    // 105 kelime ≈ 40sn tavan; aşarsa aynı konuda kısaltma iste.
    const totalWords = (script.scenes || [])
      .map((s) => s.narration || '')
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (totalWords > 105 && attempt < maxRetries) {
      console.warn(`[script] ${totalWords} kelime — bütçe aşıldı, kısaltma isteniyor.`);
      lengthFeedback =
        `Your previous script about "${script.topic}" was ${totalWords} words of narration — TOO LONG. ` +
        `Rewrite the SAME topic "${script.topic}" with the total spoken narration under 95 words: ` +
        'fewer scenes (7 max), shorter sentences, cut the weakest details. Keep the same quality.';
      continue;
    }

    // Reklam-dostu güvenlik ağı: ekrandaki hook + başlık yumuşatılır
    // (anlatım/altyazı doğruluğu korunur; asıl iş prompt'ta yapılır).
    // HOOK LAB: 6 adayın en yüksek scroll-stop puanlısı kazanır (model kendi
    // seçimini yaptıysa bile puana göre doğrula — 30 karakteri aşan aday elenir).
    if (Array.isArray(script.hook_candidates) && script.hook_candidates.length) {
      const best = script.hook_candidates
        .map((c) => ({ text: String(c.text || '').trim().replace(/["""]/g, ''), score: Number(c.score) || 0 }))
        .filter((c) => c.text.length >= 6 && c.text.length <= 30)
        .sort((a, b) => b.score - a.score)[0];
      if (best) {
        script.hook_text = best.text;
        console.log(`[hooklab] ${script.hook_candidates.length} aday → "${best.text}" (puan ${best.score})`);
      }
      delete script.hook_candidates; // aşağı akışta gereksiz yük
    }
    if (script.hook_text) script.hook_text = softenAdText(script.hook_text, 'hook');
    if (script.title) script.title = softenAdText(script.title, 'başlık');
    return { ...script, format: format.key, normalizedTopic: normalizeTopic(script.topic) };
  }

  if (lastScript?.hook_text) lastScript.hook_text = softenAdText(lastScript.hook_text, 'hook');
  if (lastScript?.title) lastScript.title = softenAdText(lastScript.title, 'başlık');
  return {
    ...lastScript,
    format: format.key,
    normalizedTopic: normalizeTopic(lastScript.topic),
    duplicate: true,
  };
}
