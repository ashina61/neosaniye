import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import {
  getRecentUsedTopics,
  getRecentFormats,
  getTopPerformingTopics,
  getWinningHooks,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';
import { softenAdText } from '../lib/adSafe.js';
import { validateViewerFirstScript } from '../pipeline/viewerFirstValidation.js';
import { evaluateNarrationLength, rateToFactor } from '../pipeline/durationPolicy.js';
import { ttsRateForTopic } from '../tts/generateAudio.js';
import { pickViralTemplate, findViralTemplate } from './viral-templates.js';

/**
 * Faz 1 — Script Üretim Motoru (Google Gemini) — ANLATI / HİKÂYE formatı.
 *
 * "Şaşırtıcı gerçek hikâyeler" (tarih + bilim + uzay + doğa + gizem) konseptinde,
 * 35-58 sn'lik dikey short için sahnelere bölünmüş bir mini-hikâye üretir.
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
        'A HOOK IS NOT A TITLE. Never announce the topic ("How blind termites build homes" is a TITLE — ' +
        'it tells the viewer what the video is about and gives them nothing to wonder about). ' +
        'Instead open a GAP or a CONTRADICTION the viewer needs resolved: state the impossible part ' +
        'flatly ("Blind builders. 13ft towers."), or a number that should not be possible, or a ' +
        'blunt claim that begs "wait, what?". Prefer concrete nouns and contradictions over ' +
        'explanations. Score each 1-100 for SCROLL-STOP power: would a bored phone user freeze mid-swipe?',
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
      // Seven short beats cannot reliably meet the 105-word narration floor.
      // Enforce the same shape in structured output as in the prompt.
      minItems: 10,
      maxItems: 11,
      description: 'Exactly 10 or 11 sequential story beats that together tell one gripping mini-story',
      items: {
        type: Type.OBJECT,
        properties: {
          narration: {
            type: Type.STRING,
            description:
              'ONE spoken sentence (scene 1: exactly 9 words; later scenes: exactly 12 words), plain voiceover text, no emojis',
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
            description: '1-3 SPECIFIC stock-search phrases naming the exact subject/species (e.g. "leafcutter ants", not "ants") for stock footage fallback',
          },
        },
        required: ['narration', 'image_prompt', 'keywords'],
        propertyOrdering: ['narration', 'image_prompt', 'keywords'],
      },
    },
    cta: {
      type: Type.STRING,
      description:
        'Short closing line tied to THIS story (unique each time), explicitly asks the viewer to SUBSCRIBE. ' +
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

/**
 * A/B HOOK TESTİ için deterministik, retention-odaklı hook puanlayıcı (0-100).
 * retentionQC'nin hook sinyalleriyle aynı ruhta çalışır: pattern-interrupt gücü
 * (sayı/istatistik), curiosity gap (soru), şok kelimeleri ve kısalık (ilk 3 sn'de
 * tek bakışta okunur). İki hook varyantından retention'ı yüksek olanı seçmek için
 * kullanılır — modelin öznel scroll-stop puanına ek, nesnel bir ikinci oy.
 */
export function scoreHookRetention(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  let s = 40;
  const words = t.split(/\s+/).filter(Boolean);
  // Kısalık: ilk 3 sn'de tek bakışta okunmalı (3-5 kelime ideal).
  if (words.length >= 3 && words.length <= 5) s += 14;
  else if (words.length <= 7) s += 6;
  else s -= 8;
  if (t.length <= 26) s += 8;
  // Sayı/istatistik = pattern interrupt gücü.
  if (/\d/.test(t)) s += 16;

  // GERÇEK SORU (soru işaretli) = açık uçlu merak boşluğu.
  const isQuestion = /\?/.test(t);
  if (isQuestion) s += 16;

  // AÇIKLAYICI BAŞLIK TUZAĞI: "HOW BLIND TERMITES BUILD HOMES" gibi soru
  // işareti OLMAYAN "how/why X does Y" kalıbı bir hook değil, videonun
  // BAŞLIĞIdır — konuyu duyurur, gerilim kurmaz. Eski skorlama bunu soruyla
  // aynı kefeye koyup +14 veriyordu ve canlıda tam bu hook seçildi.
  const explainerTitle = !isQuestion
    && /^(how|why|what|the way)\b/i.test(t)
    && /\b(build|builds|work|works|make|makes|do|does|create|creates|survive|survives|grow|grows)\b/i.test(t);
  if (explainerTitle) s -= 16;
  else if (!isQuestion && /^(how|why|what|who|when|where|which|nasıl|neden|niçin|kim|ne|hangi)\b/i.test(t)) s += 4;

  // Şok / patern-kırıcı kelimeler.
  const shock = /(secret|hidden|never|nobody|impossible|shocking|forbidden|banned|deadly|actually|wrong|proof|gizli|asla|kimse|imkansız|şok|yasak|ölümcül|aslında|yanlış|kanıt)/i;
  if (shock.test(t)) s += 12;

  // ÇELİŞKİ/GERİLİM: "kör olan inşa ediyor", "ölü ama hareket ediyor" gibi
  // kendi içinde çatışan ifadeler izleyiciyi durdurur — hook'un asıl motoru.
  const tension = /\b(blind|deaf|dead|frozen|without|no one|nothing|can'?t|couldn'?t|shouldn'?t|yet|still|despite|but|upside|backwards|inside out|kör|sağır|ölü|olmadan|rağmen|ama|tersine)\b/i;
  if (tension.test(t)) s += 10;

  // Zayıf/klişe açılışlar retention'ı düşürür (scroll-past sinyali).
  if (/^(did you know|you won'?t believe|let'?s talk|in this video|bu videoda|biliyor muydun)/i.test(t)) s -= 25;
  return Math.max(0, Math.min(100, s));
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

Write in English, for a SINGLE dramatic narrator. STRICT word budget: the spoken voiceover is the SCENE NARRATIONS ONLY (the cta is NOT spoken) and their total must be ${config.content.minNarrationWords}-${config.content.maxNarrationWords} words — never outside that range. This is a complete ${config.content.idealMinSeconds}-${config.content.idealMaxSeconds} second story, NOT a 15-second fragment and NOT a 57-second one either: do not pad the ending with abstract summaries. Hook fast, but give the mystery, evidence, twist, and payoff enough room to land; every sentence still earns its place.

Structure the story as EXACTLY 10 or 11 SCENES following this EXACT retention arc (a 10M-view Shorts shape):
HOOK → FIRST ANSWER → "BUT..." → NEW INFORMATION → "THE INTERESTING PART..." → STRONGEST FACT → PAYOFF → CTA.
1) HOOK / PATTERN INTERRUPT: the FIRST 3 SECONDS must jolt a scrolling viewer out of autopilot — lead with a PATTERN INTERRUPT: a SHOCKING STATISTIC (a concrete, verifiable number/percentage/scale) OR a POINTED QUESTION. Scene 1 must open a CURIOSITY GAP the viewer NEEDS closed. CRITICAL: that exact gap must stay UNRESOLVED until the final scene (curiosity-gap payoff) — tease the answer, withhold it through the middle, then deliver it in the finale so viewers must watch to the end.
2) MYSTERY + EVIDENCE: escalate fast, ONE concrete, surprising, ACCURATE detail per beat — each beat
   must add NEW information (never restate the previous line in new words).
3) REVEAL then TWIST: the "wait, what?!" turn.
4) ANSWER + PAYOFF: the final scene ANSWERS the opening question so the end loops back to the hook
   (hook "how did they find the invisible sun?" → finale "by finding the sun they couldn't see"). The
   story ends on the payoff; the cta is a separate on-screen/description line, never spoken.
- Use exactly 10 or 11 beats: create a fresh curiosity point every 5-8 seconds. The middle must explicitly pivot with "But..." (or a natural equivalent), then "The interesting part..." before the strongest fact.

Rules for each scene:
- narration: exactly ONE sentence, spoken aloud. Use a fixed word budget: scene 1 is EXACTLY 9 concrete words; every later scene is EXACTLY 12 words. That produces 117 words for 10 scenes, safely inside the ${config.content.minNarrationWords}-${config.content.maxNarrationWords} limit. Count speakable words, including every word in contractions, before answering. No jargon, emojis, hashtags, or markdown.
- VARY the rhythm like a human storyteller: follow a long sentence with a short punchy one; use natural spoken phrasing (contractions are fine), never a monotone list of facts.
- ANIMAL SUBJECTS: avoid extreme close-up full-body animal/insect anatomy in image_prompt (AI deforms legs/heads) — prefer wide environment shots or the creature small-in-frame; always name the EXACT species.\n- image_prompt: describe a SINGLE cinematic photorealistic shot that literally depicts that sentence — name the subject, the place, the era/period, the action, camera framing, lighting and mood. Keep it concrete and filmable. Never request on-screen text, captions, letters, logos or watermarks.
- VISUAL CONTINUITY: every image_prompt must be consistent with the visual_anchor (same character appearance, same era, same light/color mood) so the story looks like ONE film, not random pictures.
- SHOT VARIETY (critical): consecutive scenes must NOT repeat the same framing or location. Rotate deliberately like a film editor: wide establishing shot → medium shot → intimate close-up of hands/objects → over-the-shoulder → extreme close-up detail → a different location/angle. State the shot scale explicitly in each image_prompt.
- LIGHTING: the main subject must be CLEARLY LIT and readable on a small phone screen, even in dark/moody scenes (bright key light on subject, darker background).
- keywords: 1-3 simple English nouns as a stock-footage fallback if image generation is unavailable.

Rules for the whole script:
- Pick a genuinely FASCINATING, lesser-known TRUE story or fact. Prefer the "wait, what?!" kind.
- ACCURACY IS MANDATORY. Use only well-documented, widely-accepted facts. Never invent events, quotes, names, or statistics. If a specific number or detail is uncertain, phrase it cautiously ("around", "some historians say") or leave it out. A wrong fact destroys the channel's credibility.
- FACTUAL CERTAINTY: match your wording to how established each claim is. Only use absolute language
  ("definitely", "proven", "always") for firmly established facts. For a supported-but-unproven theory
  or a debated point, HEDGE explicitly ("may have", "experiments suggest it could have worked",
  "historians still debate"). Never present a debated theory as certain.
- hook_text: MAX 5-7 words, a bold promise/question read at a glance on a phone — not a full sentence.
- LOOP: the finale_text should answer the very question the hook opened, so the end flows back into
  the beginning (hook: "How did Vikings find the Sun through clouds?" → finale: "by finding the Sun
  they couldn't see"). Never leave the finale incomplete just to force a loop.
- MECHANISM: if the story explains HOW something works, at least one scene's narration must state the
  actual working principle in a way that can be shown as a 2-4 step visual (light enters → splits →
  brightness compared → direction found), not just "it worked".
- OPENING UNITY: hook_text, scene 1 narration, and scene 1 image_prompt must name the same concrete subject and promise. Never begin with "Did you know", "You won't believe", or a vague generic question. The first spoken sentence must reveal a concrete surprise, contradiction, danger, scale, mystery, or consequence.
- COVER FRAME: scene 1's image_prompt is the video's cover in the feed — make it the single most visually arresting, high-contrast, instantly-readable shot of the whole story (a striking subject centered, dramatic light), because it alone decides whether a scrolling viewer stops.
- MIDPOINT RE-HOOK: near the middle, use one earned contrast or new consequence that deepens the SAME central question; do not bolt on a random pattern interrupt.
- CTA: after the payoff, short, story-specific, language-matched, and explicitly asks viewers to SUBSCRIBE ("Subscribe..." / "ABONE OL"). Never ask for a like and never use "Follow for more facts". It is NOT spoken.
- title: curiosity-driven, <= 80 characters, no clickbait lies, no emojis.
- MONETIZATION-SAFE LANGUAGE: the title, hook_text, and the FIRST scene's narration must be
  advertiser-friendly — build curiosity/intrigue and AVOID explicit words of violence, death,
  drugs, weapons or any profanity there (prefer "vanished", "the end came", "never returned",
  "did not survive" over "killed/murdered/suicide/blood"). In later scenes, state the facts
  accurately and neutrally, but never gratuitously graphic; prefer "died", "perished", "lost their
  lives" over harsher wording, and never use profanity or slurs. Accuracy still comes first.`;
}

const PROVIDER_BREAKER_STATUSES = new Set([402, 429, 503]);
const providerRun = { openRouterUsed: false, openRouterRequestedModel: null, openRouterResolvedModel: null, openRouterAttempts: 0, openRouterFailures: 0 };
const providerCircuit = { openrouter: false, gemini: false, groq: false,
  cerebras: false, 'github-models': false, mistral: false, cloudflare: false };

export function resetProviderRun() {
  Object.assign(providerRun, { openRouterUsed: false, openRouterRequestedModel: null, openRouterResolvedModel: null, openRouterAttempts: 0, openRouterFailures: 0 });
  Object.assign(providerCircuit, { openrouter: false, gemini: false, groq: false,
    cerebras: false, 'github-models': false, mistral: false, cloudflare: false });
}

export function getProviderRun() { return { ...providerRun }; }

function openAiRequest(req) {
  const schema = req.config?.responseSchema;
  return {
    temperature: 0.8, max_tokens: 3000,
    messages: [
      { role: 'system', content: [req.config?.systemInstruction || '', schema ? `Respond with ONLY one valid JSON object matching this JSON schema — no markdown fences, no commentary:\n${JSON.stringify(schema)}` : 'Respond concisely in plain text.'].join('\n\n') },
      { role: 'user', content: String(req.contents) },
    ],
    ...(schema ? { response_format: { type: 'json_object' } } : {}),
  };
}

/**
 * KESİK JSON ONARIMI. Ücretsiz modeller yanıtı sık sık token bütçesinde
 * kesiyor ("Unterminated string in JSON at position 55" — 25 Tem koşusu).
 * Yanıt gövdesi sağlamsa ama sonu kesikse, açık kalan string/parantezleri
 * kapatarak kurtarmayı dener. Kurtarılamıyorsa null döner (uydurma yapmaz).
 */
export function repairTruncatedJson(raw) {
  let text = String(raw || '').trim();
  // Markdown çiti içindeyse çıkar.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/,'').trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  text = text.slice(start);
  try { return JSON.parse(text); } catch { /* onarmayı dene */ }

  // KONTROL NOKTALARI: metni tararken, string DIŞINDA bir değerin bittiği her
  // yerde (bir '}' / ']' kapandığında ya da ',' görüldüğünde) o ANDAKİ açık
  // parantez yığınının kopyasını sakla. Kesik yanıtta en sondan geriye doğru
  // bu noktaları deneyip yığını oradaki haliyle kapatırız.
  //
  // (Yığını tüm metin için tek seferde hesaplamak yanlıştı: kesik son öğeye ait
  // parantezler de yığına giriyor ve kapatma dizisi bozuk çıkıyordu — kesik
  // dizi vakası bu yüzden kurtarılamıyordu.)
  const checkpoints = [];
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); continue; }
    if (c === '}' || c === ']') {
      stack.pop();
      checkpoints.push({ end: i + 1, close: [...stack].reverse().join('') });
      continue;
    }
    if (c === ',') checkpoints.push({ end: i, close: [...stack].reverse().join('') });
  }

  // En sondaki sağlam noktadan geriye doğru dene.
  for (let i = checkpoints.length - 1; i >= 0; i -= 1) {
    const { end, close } = checkpoints[i];
    const candidate = text.slice(0, end).replace(/,\s*$/, '') + close;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* daha geriye sar */ }
  }
  return null;
}

/**
 * OpenAI-UYUMLU ÜCRETSİZ SAĞLAYICI (Cerebras / GitHub Models / Mistral / CF).
 * Hepsi aynı gövdeyi kabul ettiği için tek fonksiyon yeter; anahtarı olmayan
 * sessizce atlanır. Tek bir sağlayıcının kota yemesi artık run'ı öldürmüyor.
 */
async function openAiCompatFallback(req, provider) {
  const { key, url, model, label, headers = {} } = provider;
  if (!key || providerCircuit[label]) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openrouter.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ model, ...openAiRequest(req) }),
    });
    if (!res.ok) {
      if (PROVIDER_BREAKER_STATUSES.has(res.status)) providerCircuit[label] = true;
      throw new Error(`${label} HTTP ${res.status}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error(`${label} boş yanıt`);
    if (req.config?.responseSchema) {
      // Bozuk/kesik JSON'u sağlayıcı başarısı saymadan önce onarmayı dene.
      try {
        const match = text.match(/\{[\s\S]*\}/);
        JSON.parse(match ? match[0] : text);
      } catch {
        // Onarımı YALNIZCA anlamlıysa kabul et. 2 sahneye kadar kırpılmış bir
        // script zaten kalite kapılarında elenecek; onu "başarı" sayıp zinciri
        // durdurmaktansa SIRADAKİ sağlayıcıya geçmek daha iyi.
        const repaired = repairTruncatedJson(text);
        const needsScenes = Array.isArray(req.config?.responseSchema?.required)
          && req.config.responseSchema.required.includes('scenes');
        const usable = repaired && (!needsScenes || (Array.isArray(repaired.scenes) && repaired.scenes.length >= 5));
        if (!usable) throw new Error(`${label} geçersiz JSON (onarılamadı/eksik)`);
        console.warn(`[${label}] kesik JSON onarıldı (${repaired.scenes?.length ?? '?'} sahne).`);
        return { text: JSON.stringify(repaired) };
      }
    }
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}

/** Zincire girecek ücretsiz sağlayıcılar (sırayla denenir). */
function freeProviderChain() {
  return [
    {
      label: 'cerebras', key: config.cerebras.apiKey, model: config.cerebras.model,
      url: `${config.cerebras.baseUrl}/chat/completions`,
    },
    {
      label: 'github-models', key: config.githubModels.apiKey, model: config.githubModels.model,
      url: `${config.githubModels.baseUrl}/chat/completions`,
    },
    {
      label: 'mistral', key: config.mistral.apiKey, model: config.mistral.model,
      url: `${config.mistral.baseUrl}/chat/completions`,
    },
    {
      label: 'cloudflare', key: config.cloudflareAi.accountId ? config.cloudflareAi.apiKey : null,
      model: config.cloudflareAi.model,
      url: `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAi.accountId}/ai/v1/chat/completions`,
    },
  ].filter((p) => p.key);
}

async function openRouterFallback(req) {
  if (!config.openrouter.apiKey || providerCircuit.openrouter) return null;
  // DAYANIKLILIK: birden çok ücretsiz modeli SIRAYLA dene. Biri boş/geçersiz/404
  // dönerse sıradaki modele geç (tek "boş dönen" auto-router'a takılıp kalma).
  const models = (config.openrouter.models && config.openrouter.models.length)
    ? config.openrouter.models : [config.openrouter.model];
  const attempts = Math.max(1, config.openrouter.attempts);
  let lastErr;
  let salvageText = null; // son çare onarımı için saklanan kesik yanıt
  for (const model of models) {
    providerRun.openRouterRequestedModel = model;
    console.log(`[openrouter] model=${model}`);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.openrouter.timeoutMs);
      providerRun.openRouterAttempts += 1;
      try {
        const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
          method: 'POST', signal: controller.signal,
          headers: { authorization: `Bearer ${config.openrouter.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, ...openAiRequest(req) }),
        });
        if (!res.ok) {
          const err = new Error(`openrouter HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (!text) {
          const err = new Error('openrouter boş yanıt');
          // Free backends occasionally return a successful envelope with no
          // completion while they are being rerouted. Treat it like a transient
          // provider failure instead of abandoning the only remaining fallback.
          err.name = 'OpenRouterEmptyResponseError';
          throw err;
        }
        // OpenRouter's JSON-object mode is best-effort for some free backends.
        // Do not report a provider success and let the pipeline crash later on a
        // malformed/truncated payload; retry it while the same fallback is active.
        if (req.config?.responseSchema) {
          try {
            const match = text.match(/\{[\s\S]*\}/);
            JSON.parse(match ? match[0] : text);
          } catch (cause) {
            // Kesik yanıtı SAKLA ama HEMEN kullanma: yeniden deneme TAM bir
            // script getirebilir; onarılmış kesik yanıt sahne kaybetmiş olur.
            // Onarım yalnızca tüm model/deneme hakları bittiğinde son çare
            // olarak devreye girer (aşağıda).
            salvageText = text;
            const err = new Error(`openrouter geçersiz JSON: ${cause.message}`);
            err.name = 'OpenRouterInvalidJsonError';
            throw err;
          }
        }
        providerRun.openRouterUsed = true;
        providerRun.openRouterResolvedModel = data?.model || model;
        console.log(`[openrouter] resolved=${providerRun.openRouterResolvedModel}`);
        console.log('[openrouter] success');
        return { text };
      } catch (err) {
        lastErr = err;
        providerRun.openRouterFailures += 1;
        // Ödeme/limit/erişilemez → TÜM OpenRouter'ı kapat (model değiştirmek fayda etmez).
        if (PROVIDER_BREAKER_STATUSES.has(err?.status)) {
          providerCircuit.openrouter = true;
          console.warn(`[openrouter] breaker (${err.status}) — durduruldu.`);
          throw err;
        }
        const retryable = err?.name === 'AbortError' ||
          err?.name === 'OpenRouterEmptyResponseError' ||
          err?.name === 'OpenRouterInvalidJsonError' ||
          /network|fetch failed|socket|ECONNRESET/i.test(String(err?.message || err));
        if (retryable && attempt < attempts) {
          console.warn(`[openrouter] geçici hata; tekrar (${attempt}/${attempts}) [${model}]: ${String(err?.message || err).slice(0, 80)}`);
          if (config.openrouter.retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, config.openrouter.retryDelayMs));
          continue;
        }
        // Bu modelde bitti → SIRADAKİ modele geç (breaker açma).
        console.warn(`[openrouter] '${model}' başarısız (${String(err?.message || err).slice(0, 70)}) → sonraki model.`);
        break;
      } finally { clearTimeout(timeout); }
    }
  }
  // SON ÇARE: tüm model/deneme hakları bitti. Elde kesik ama gövdesi sağlam bir
  // yanıt kaldıysa onar. Yeniden denemeler ÖNCE tüketildiği için, tam bir script
  // gelme şansı harcanmadan bu yola girilmez; buradaki tek alternatif zaten
  // "hiç script yok". Kalite kapıları (sahne sayısı/kelime/viewer-first) bu
  // onarılmış script'i de aynen denetler — eksik sahneli çıktı orada elenir.
  if (salvageText) {
    const repaired = repairTruncatedJson(salvageText);
    if (repaired) {
      console.warn('[openrouter] tüm denemeler bitti — kesik JSON son çare olarak onarıldı.');
      providerRun.openRouterUsed = true;
      return { text: JSON.stringify(repaired) };
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/** GROQ YEDEK BEYNİ: Gemini tamamen düştüğünde aynı istek ücretsiz Groq'a
 *  (Llama, OpenAI-uyumlu uç) gider. responseSchema JSON moda + sistem mesajına
 *  gömülür; dönen {text} Gemini yanıtıyla aynı şekilde okunur (response.text).
 *  Aşağı akıştaki doğrulama/sanitize katmanları bozuk çıktıyı zaten yakalar. */
async function groqFallback(req) {
  if (!config.groq.apiKey || providerCircuit.groq) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.groq.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.groq.model,
      // Groq's default completion budget is too small for a complete script
      // with ten image prompts and the required metadata.
      ...openAiRequest(req),
    }),
  });
  if (!res.ok) {
    if (PROVIDER_BREAKER_STATUSES.has(res.status)) providerCircuit.groq = true;
    throw new Error(`groq HTTP ${res.status}`);
  }
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
  // Provider order is intentionally fixed. A quota/payment/outage/timeout trips
  // that provider for this call rather than burning the production time budget.
  const delays = [2000, 6000, 15000, 30000];
  let lastErr;
  for (let i = 0; ai && !providerCircuit.gemini && i < tries; i += 1) {
    try {
      return await ai.models.generateContent(req);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (/quota|RESOURCE_EXHAUSTED|429|402|503|API key|permission|timeout/i.test(msg)) {
        providerCircuit.gemini = true;
        break;
      }
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
    lastErr = gErr;
    console.warn(`[groq] yedek de düştü: ${String(gErr.message).slice(0, 90)}`);
  }
  // EK ÜCRETSİZ BEYİNLER — OpenRouter'dan ÖNCE denenir (OpenRouter'ın ücretsiz
  // arka uçları bozuk/kesik JSON döndürmeye en yatkın olanlar). Biri kota
  // yerse sıradakine geçilir; hepsinin aynı anda düşme ihtimali çok düşük.
  for (const provider of freeProviderChain()) {
    try {
      const alt = await openAiCompatFallback(req, provider);
      if (alt) {
        console.warn(`[${provider.label}] yedek beyin devrede (${provider.model}).`);
        return alt;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[${provider.label}] düştü: ${String(err?.message || err).slice(0, 90)}`);
    }
  }

  try {
    const openRouter = await openRouterFallback(req);
    if (openRouter) return openRouter;
  } catch (err) {
    lastErr = err;
    if (!PROVIDER_BREAKER_STATUSES.has(err?.status) && err?.name !== 'AbortError') {
      console.warn('[openrouter] retry skipped; deterministic fallback next.');
    }
  }
  throw lastErr || new Error('No configured AI provider produced a response.');
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
  // FORCE_TOPIC: doğrulama/test için konuyu sabitle (FORCE_FORMAT ile aynı ruh).
  // Ayarlıysa kaçınma listesini geçersiz kılar ve tam bu konuyu yazdırır.
  const forcedTopic = String(process.env.FORCE_TOPIC || '').trim();
  if (forcedTopic) {
    parts.push(
      `FORCED TOPIC (validation run): write the full scene-by-scene script about ` +
        `"${forcedTopic}". Ignore the "previously used" avoidance for THIS run; this exact ` +
        `topic is required. Keep it a true, accurate nature/science explainer.`,
    );
  } else {
    parts.push('Pick a NEW, mind-blowing TRUE topic that differs from the used list, then write the full scene-by-scene script.');
  }
  return parts.join('\n\n');
}

/**
 * Providers do not retain the prior response between generateContent calls.
 * Include the actual narration in a repair request so "rewrite the previous
 * script" is actionable rather than an instruction the model has to guess at.
 */
export function buildNarrationLengthRepair(script, length, content = config.content) {
  const narration = (script?.scenes || [])
    .map((scene, index) => `${index + 1}. ${String(scene?.narration || '').trim()}`)
    .join('\n');
  const action = length.direction === 'expand'
    ? 'Add only clear, factual supporting detail; do not invent facts.'
    : 'Remove only repetition, filler, and nonessential qualifiers; do not remove factual claims.';

  return `NARRATION LENGTH REPAIR — REQUIRED BEFORE YOU RESPOND:
The previous response contains ${length.words} spoken narration words, which is ${length.code}.
Rewrite the SAME complete JSON script and preserve its topic, hook, evidence, twist, payoff, metadata, and scene count.
${action}
The scene narrations MUST use this exact allocation: scene 1 has EXACTLY 9 spoken words and every remaining scene has EXACTLY 12 spoken words. This makes the total 117 words for 10 scenes or 129 words for 11 scenes, both accepted. Count only narration fields, and count every speakable word in contractions before returning JSON.
Previous narration to repair:
${narration}`;
}

/**
 * Yeni bir anlatı-script üretir.
 * @param {object} opts
 * @param {number} [opts.maxRetries=5] - Konu/şema/duration retry sayısı.
 * @param {string[]} [opts.avoidTopics=[]] - Ekstra kaçınılacak konular.
 * @returns {Promise<object>} - SCRIPT_SCHEMA + normalizedTopic.
 */
export async function generateScript({ maxRetries = 5, avoidTopics: extraAvoid = [], strategyBrief = '' } = {}) {
  resetProviderRun();
  const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

  // 120: eski kanaldan tohumlanan konular da kaçınma listesinde kalsın.
  const recent = await getRecentUsedTopics(120);
  const avoidTopics = [
    ...recent.map((r) => r.topic).filter(Boolean),
    ...extraAvoid,
  ];

  // Öğrenme döngüsü + trend tohumları (ikisi de best-effort).
  const [topPerformers, trendSeeds, winningHooks, recentFormats] = await Promise.all([
    getTopPerformingTopics(5).catch(() => []),
    fetchTrendSeeds(),
    getWinningHooks(3).catch(() => []),
    getRecentFormats(2).catch(() => []),
  ]);
  // FORCE_FORMAT ile format sabitlenebilir (test için; ör. 'process').
  const forced = String(process.env.FORCE_FORMAT || '').trim();
  let format = FORMATS.find((f) => f.key === forced);
  if (!format) {
    format = pickFormat();
    // Aynı format art arda 3 kez olmasın — kanal tek kalıba saplanmasın.
    if (recentFormats.length >= 2 && recentFormats.every((f) => f === format.key)) {
      for (let tries = 0; tries < 5 && format.key === recentFormats[0]; tries += 1) format = pickFormat();
      console.log(`[script] format tekrarı kırıldı → ${format.key}`);
    }
  }
  // VİRAL ŞABLON: FORMATS rotasyonunun ÜSTÜNE hafif bir viral paketleme katmanı.
  // VIRAL_TEMPLATES=0 ile kapatılır; FORCE_VIRAL_TEMPLATE ile sabitlenir (test).
  const viralTemplate = process.env.VIRAL_TEMPLATES === '0'
    ? null
    : (findViralTemplate(process.env.FORCE_VIRAL_TEMPLATE) || pickViralTemplate());
  console.log(
    `[script] format: ${format.key}${forced === format.key ? ' (zorlandı)' : ''}` +
      (viralTemplate ? `, viral şablon: ${viralTemplate.key}` : '') +
      (topPerformers.length ? `, öğrenme: ${topPerformers.length} iyi konu` : '') +
      (trendSeeds.length ? `, trend: ${trendSeeds.length} tohum` : ''),
  );

  let lastScript = null;
  let lengthFeedback = '';
  // DENEMELER ARASI EN İYİ HOOK. Loop yüzünden yeniden yazdırdığımızda yeni
  // script'in hook'u çok daha kötü olabiliyor ve olduğu gibi kabul ediliyordu:
  // canlıda "3 Hidden Sea Cucumber Powers" (ret 82) → "What Sea Cucumbers
  // Can Do!" (46) → 3. denemede hiç aday gelmediği için modelin ham metni
  // "5 Incredible Facts About Sea Cucumbers!" (39 karakter, liste başlığı)
  // ekrana bastı. Hook, retention puanının EN BÜYÜK kalemi.
  let bestHook = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let response;
    try { response = await generateWithRetry(ai, {
      model: config.gemini.model,
      contents:
        buildUserPrompt(avoidTopics, { topPerformers, trendSeeds, strategyBrief, winningHooks }) +
        (viralTemplate ? `\n\nVIRAL TEMPLATE STYLING (soft packaging guide — keep the story's factual integrity and the format above): ${viralTemplate.promptHint}` : '') +
        (lengthFeedback ? `\n\n${lengthFeedback}` : ''),
      config: {
        systemInstruction: buildSystemPrompt(format),
        responseMimeType: 'application/json',
        responseSchema: SCRIPT_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }); } catch (err) {
      // ELDEKİ SCRIPT'İ ÇÖPE ATMA. Bu döngü bir script'i "biraz kısa" bulunca
      // YENİDEN YAZIM istiyor; o ikinci çağrı sağlayıcı zincirini yeniden
      // zarlıyor. Zincir o an ölüyse (Gemini down + Groq 429 + OpenRouter
      // bozuk JSON — 25 Tem 23:31 koşusu) elde ÇALIŞAN bir script varken tüm
      // run çöpe gidiyordu. lastScript zaten tutuluyordu ama yalnızca hata
      // metninde kullanılıyordu; artık gerçek yedek olarak kullanılıyor.
      //
      // Kalite çıtası korunur: yalnızca salvage tabanını geçen (gerçek,
      // sahne-düzeyinde içerik taşıyan) script kabul edilir. Taban altındaysa
      // eskisi gibi fail — uydurma içerikle video yayınlamaktan iyidir.
      const floor = Math.round(config.content.minNarrationWords * 0.70);
      const hasBones = lastScript
        && Array.isArray(lastScript.scenes) && lastScript.scenes.length >= 5
        && String(lastScript.hook_text || '').trim()
        && String(lastScript.topic || lastScript.title || '').trim();
      const salvage = hasBones
        ? evaluateNarrationLength(lastScript.scenes, {
          minWords: config.content.minNarrationWords,
          maxWords: config.content.maxNarrationWords,
          rateFactor: rateToFactor(ttsRateForTopic(lastScript)),
        })
        : null;
      if (salvage && salvage.words >= floor) {
        // Kurtarılan script NORMAL yolla AYNI yayın kapısından geçer; geçemezse
        // kurtarma yapılmaz (kapıyı atlatmak için kestirme değil).
        if (!lastScript.topic) lastScript.topic = String(lastScript.title).trim();
        delete lastScript.hook_candidates;
        lastScript.hook_text = softenAdText(lastScript.hook_text, 'hook');
        if (lastScript.title) lastScript.title = softenAdText(lastScript.title, 'başlık');
        const check = validateViewerFirstScript(lastScript);
        if (check.ok) {
          console.warn(
            `[script] sağlayıcı zinciri düştü (${String(err?.message || err).slice(0, 70)}) — ` +
            `önceki denemedeki GERÇEK script kurtarıldı (${salvage.words} kelime, ${lastScript.scenes.length} sahne).`,
          );
          return {
            ...lastScript,
            shortNarration: salvage.ok ? undefined : true, // TTS süre kurtarma sinyali
            viewerFirstValidation: check,
            format: format.key,
            viralTemplate: viralTemplate?.key || null,
            normalizedTopic: normalizeTopic(lastScript.topic),
            aiProvider: getProviderRun(),
          };
        }
        console.warn(`[script] kurtarma reddedildi (yayın kapısı): ${check.failures.join(', ')}`);
      }
      // A generic local script used to let a provider outage become a 10-scene
      // AI slideshow (and even reused the same non-hook). Do not spend render
      // time or publish a video when no model has supplied factual, scene-level
      // material; the next scheduled run can retry with a working provider.
      throw new Error(
        `SCRIPT_PROVIDER_UNAVAILABLE: no AI provider produced a quality-safe script (${String(err?.message || err).slice(0, 140)}).`,
      );
    }

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason || 'bilinmiyor';
      throw new Error(`Gemini boş yanıt döndü (finishReason: ${reason}).`);
    }

    const script = JSON.parse(text);
    lastScript = script;

    // Zayıf sağlayıcılar (OpenRouter/nemotron) şemaya tam uymayıp `topic`'i boş
    // bırakabiliyor; Gemini structured-output garanti ediyordu. topic tüm alt
    // akışın anahtarı (dedup, metadata, doc id) → başlıktan türet; o da yoksa
    // bu script'i geçersiz say ve (mümkünse) başka sağlayıcıyla tekrar dene.
    if (!script.topic || !String(script.topic).trim()) {
      if (script.title && String(script.title).trim()) {
        script.topic = String(script.title).trim();
        console.warn('[script] sağlayıcı topic vermedi — başlıktan türetildi.');
      } else if (attempt < maxRetries) {
        console.warn('[script] sağlayıcı geçerli topic/title vermedi — yeniden deneniyor.');
        continue;
      } else {
        throw new Error('SCRIPT_MISSING_TOPIC: sağlayıcı geçerli topic/title döndürmedi.');
      }
    }

    // FORCE_TOPIC doğrulama koşusunda tekrar kontrolü atlanır (bee konusu zaten
    // kullanılmış olabilir; bu bilinçli bir yeniden-üretimdir).
    if (!process.env.FORCE_TOPIC && await isTopicUsed(script.topic)) {
      avoidTopics.push(script.topic);
      continue;
    }

    // CTA is not spoken. The old one-sided "under 95 words / 7 scenes max"
    // repair could turn a healthy script into a ~15-second fragment.
    // NOT: evaluateNarrationLength {minWords,maxWords} bekler; config.content
    // {minNarrationWords,maxNarrationWords} tutar → doğru ANAHTARLARLA geçir,
    // yoksa fonksiyon 135 default'unu kullanıp config'i (150) yok sayar.
    // The word window is measured against the rate this topic will be READ at,
    // not against a nominal one — a slowed-down explainer needs fewer words to
    // land in the same runtime band.
    const lengthOpts = {
      minWords: config.content.minNarrationWords,
      maxWords: config.content.maxNarrationWords,
      rateFactor: rateToFactor(ttsRateForTopic(script)),
    };
    const length = evaluateNarrationLength(script.scenes, lengthOpts);
    // SÜRE KURTARMA (25 Tem dersi): Gemini kota + Groq 429 olunca zayıf yedek
    // sağlayıcı hedefin (120) biraz altında GERÇEK bir script verebiliyor (o run:
    // 92 kelime). Eskiden bunu "TOO_SHORT" diye reddedip yeniden yazdırıyorduk →
    // o yeniden-yazım çürük sağlayıcı zincirine düşüp SCRIPT_PROVIDER_UNAVAILABLE
    // ile TÜM run'ı çöpe atıyordu (elde ÇALIŞAN script varken sıfır video). Artık
    // kelime SALVAGE_FLOOR'un (~%70) üstündeyse gerçek script'i KABUL ediyoruz;
    // süreyi generateAudio yavaş-yeniden-sentezle 35s kapısının üstüne çekiyor.
    // Böylece kısa script AUDIO_TOO_SHORT'a taşınmıyor. Sadece taban-altı (çok
    // kısa, kurtarılamaz) durumda yeniden yazım/başarısızlık.
    const salvageFloor = Math.round(config.content.minNarrationWords * 0.70);
    if (length.code === 'NARRATION_TOO_SHORT' && length.words >= salvageFloor) {
      console.warn(`[script] ${length.words} kelime — hedefin altında ama ${salvageFloor}+ tabanında: KABUL (yeniden yazıp sağlayıcı yakmak yerine; süreyi TTS kurtaracak).`);
      length.ok = true;
      script.shortNarration = true; // generateAudio süre kurtarma sinyali
    }
    if (!length.ok && attempt < maxRetries) {
      console.warn(`[script] ${length.words} kelime — ${length.code}, yeniden yazım isteniyor.`);
      lengthFeedback = buildNarrationLengthRepair(script, length, config.content);
      continue;
    }
    if (!length.ok) {
      // ÇOK UZUN her zaman kırpılabilir → üretimi sert-fail etme, sondan sahne
      // atarak (finale + ilk 4 sahne korunur) bütçeye in. ÇOK KISA (taban-altı)
      // salvageable değildir (gerçek içerik gerekir) → yalnızca o durumda fail.
      if (length.code === 'NARRATION_TOO_LONG' && Array.isArray(script.scenes) && script.scenes.length > 5) {
        // Kırpma hedefi, konuşma hızına göre AYARLANMIŞ tavandır — ham config
        // değeri değil; yoksa yavaş okunan bir konu kırpıldıktan sonra bile
        // süre bandını aşardı.
        while (script.scenes.length > 5 &&
          evaluateNarrationLength(script.scenes, lengthOpts).words >
            evaluateNarrationLength(script.scenes, lengthOpts).maxWords) {
          script.scenes.splice(script.scenes.length - 2, 1); // finale'den önceki son sahneyi at
        }
        const trimmed = evaluateNarrationLength(script.scenes, lengthOpts);
        console.warn(`[script] son çare: sahne kırpma → ${trimmed.words} kelime (${script.scenes.length} sahne)`);
        length.ok = trimmed.ok;
        length.words = trimmed.words;
      }
      if (!length.ok) {
        throw new Error(
          `SCRIPT_DURATION_POLICY_FAILED: ${length.code} (${length.words} words); ` +
          `required ${config.content.minNarrationWords}-${config.content.maxNarrationWords} words.`,
        );
      }
    }
    script.narrationWordCount = length.words;

    // Reklam-dostu güvenlik ağı: ekrandaki hook + başlık yumuşatılır
    // (anlatım/altyazı doğruluğu korunur; asıl iş prompt'ta yapılır).
    // HOOK LAB: 6 adayın en yüksek scroll-stop puanlısı kazanır (model kendi
    // seçimini yaptıysa bile puana göre doğrula — 30 karakteri aşan aday elenir).
    if (Array.isArray(script.hook_candidates) && script.hook_candidates.length) {
      // TÜM geçerli adaylar deterministik retention puanıyla yarışır (yalnız
      // modelin ilk 2'si değil) → en iyi hook havuzun 5.'si olsa bile kazanır.
      // Eşitlikte modelin kendi puanı ayırır.
      const valid = script.hook_candidates
        .map((c) => ({ text: String(c.text || '').trim().replace(/["""]/g, ''), score: Number(c.score) || 0 }))
        .filter((c) => c.text.length >= 6 && c.text.length <= 30)
        .map((c) => ({ ...c, retention: scoreHookRetention(c.text) }))
        .sort((a, b) => b.retention - a.retention || b.score - a.score);
      const best = valid[0];
      if (best) {
        script.hook_text = best.text;
        const runnerUp = valid[1];
        if (runnerUp) {
          console.log(`[hook] ${valid.length} aday → kazanan "${best.text}" (ret ${best.retention}) | 2.: "${runnerUp.text}" (ret ${runnerUp.retention})`);
        } else {
          console.log(`[hooklab] ${valid.length} aday → "${best.text}" (retention ${best.retention})`);
        }
        script.hookAbTest = valid.slice(0, 3).map((c) => ({ text: c.text, modelScore: c.score, retentionScore: c.retention }));
      }
      delete script.hook_candidates; // aşağı akışta gereksiz yük
    }
    if (script.hook_text) script.hook_text = softenAdText(script.hook_text, 'hook');
    if (script.title) script.title = softenAdText(script.title, 'başlık');

    // HOOK KALİTE TABANI — hook lab aday üretmezse modelin ham metni denetimsiz
    // geçiyordu. Kapak yazısı 30 karakteri aşamaz ve daha önceki bir denemede
    // daha iyi bir hook gördüysek ona döneriz.
    {
      const cur = String(script.hook_text || '').trim();
      const curRet = cur ? scoreHookRetention(cur) : -99;
      if (cur && cur.length <= 30 && (!bestHook || curRet > bestHook.retention)) {
        bestHook = { text: cur, retention: curRet };
      }
      const tooLong = cur.length > 30;
      if (bestHook && (tooLong || curRet + 12 < bestHook.retention)) {
        // AÇILIŞ BÜTÜNLÜĞÜ korunmalı: devralınan hook, bu script'in ilk
        // cümlesiyle ortak bir kelime paylaşmıyorsa kullanılmaz (aksi hâlde
        // hook başka şey, ilk cümle başka şey söyler).
        const k = new Set(String(script.scenes?.[0]?.narration || '').toLowerCase()
          .match(/[\p{L}\p{N}]{4,}/gu) || []);
        const shares = (bestHook.text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])
          .some((w) => k.has(w));
        if (shares) {
          console.log(`[hook] "${cur}" (ret ${curRet}${tooLong ? `, ${cur.length} karakter` : ''}) ` +
            `yerine önceki denemenin daha güçlü hook'u: "${bestHook.text}" (ret ${bestHook.retention})`);
          script.hook_text = bestHook.text;
        } else if (tooLong && attempt <= 2) {
          console.warn(`[script] hook ${cur.length} karakter ve daha iyi aday yok — yeniden yazım isteniyor.`);
          lengthFeedback = 'Rewrite the SAME script but make hook_text MAX 30 characters: a bold question or promise, never a listicle title like "5 Incredible Facts About X".';
          continue;
        }
      }
    }

    // #2 LOOP: final hook'a bağlanmalı (curiosity-gap payoff) → izleyici baştan
    // izler (replay = Shorts view motoru). Bağlanmıyorsa ERKEN denemelerde
    // yeniden yazdır; son denemeleri riske atma (üretimi asla sert-fail etme).
    if (attempt <= 2) {
      const hookK = new Set(String(script.hook_text || '').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
      const closing = `${script.scenes?.at(-1)?.narration || ''} ${script.finale_text || ''}`.toLowerCase();
      const closingK = new Set(closing.match(/[\p{L}\p{N}]{4,}/gu) || []);
      // QC ile hizalı: finale HOOK KELİMESİNİ kapatmalı (yalnız "because/finally"
      // gibi payoff sözcüğü yetmez — o zaman QC yine "loop yok" diyordu).
      const loops = [...hookK].some((k) => closingK.has(k));
      if (!loops) {
        console.warn('[script] loop zayıf: finale hook\'a bağlanmıyor — yeniden yazım isteniyor.');
        lengthFeedback = `Rewrite the SAME script (same topic, facts, scene count, and word budget) but make the FINAL scene narration and finale_text explicitly ANSWER and echo the hook "${script.hook_text}", so the ending loops straight back into the opening — a curiosity-gap payoff that makes viewers rewatch.`;
        continue;
      }
    }

    // Validate the final A/B-selected and safety-softened hook, not merely the
    // model's pre-selection draft. Otherwise a winning candidate can silently
    // stop matching scene 1 and create exactly the weak opening QC observed in
    // production.
    const viewerValidation = validateViewerFirstScript(script);
    if (!viewerValidation.ok) {
      if (attempt < maxRetries) {
        console.warn(`[script] viewer-first doğrulama reddetti: ${viewerValidation.failures.join(', ')}`);
        lengthFeedback = `Rewrite the SAME topic and fix these release blockers: ${viewerValidation.failures.join(', ')}. Keep the factual content and word budget.`;
        continue;
      }
      throw new Error(`VIEWER_FIRST_SCRIPT_INVALID: ${viewerValidation.failures.join(', ')}`);
    }
    script.viewerFirstValidation = viewerValidation;
    return { ...script, format: format.key, viralTemplate: viralTemplate?.key || null, normalizedTopic: normalizeTopic(script.topic), aiProvider: getProviderRun() };
  }

  throw new Error(`SCRIPT_GENERATION_EXHAUSTED: ${lastScript?.topic || 'no valid script returned'}`);
}
