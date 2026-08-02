import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import { generateWithRetry } from '../script/generateScript.js';

/**
 * ORKESTRA — Kurgucu + Ses Yönetmeni (tek geçiş).
 *
 * Hikâyeyi okur ve dramaturjiye göre karar verir:
 *  - Sahne sınırlarında geçiş tipi (çoğu 'cut'; duygu kırılmalarında animasyon)
 *  - Her sınırda ses efekti (twist'te impact, tırmanışta riser, merak anında
 *    shimmer, zaman/mekân atlayışında whoosh, sakin kesmede none)
 *  - Müzik ruhu (hikâyenin HİSSİNE göre; konu kategorisiyle aynı olmayabilir)
 *  - Abone kartının hikâyeyi en az bölen anı (doğal nefes noktası)
 *
 * Düşerse mevcut mekanik plan devreye girer — boru hattı asla kırılmaz.
 */

const TRANSITIONS = [
  'cut', 'fade', 'slideleft', 'slideright', 'slideup',
  'wipeup', 'zoomin', 'smoothleft', 'smoothright',
];
const SFX = ['none', 'whoosh', 'impact', 'riser', 'shimmer'];
const MOODS = ['history', 'mystery', 'space', 'science', 'nature'];

const EDIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    music_mood: {
      type: Type.STRING,
      description: `Music mood matching the story FEELING: one of ${MOODS.join(', ')}`,
    },
    boundaries: {
      type: Type.ARRAY,
      description: 'One entry per boundary BETWEEN scenes (count = scenes - 1), in order',
      items: {
        type: Type.OBJECT,
        properties: {
          transition: {
            type: Type.STRING,
            description: `One of: ${TRANSITIONS.join(', ')}. Mostly 'cut'; animate only emotional shifts (max ~40%).`,
          },
          sfx: {
            type: Type.STRING,
            description:
              `One of: ${SFX.join(', ')}. impact=the twist/shock moment, riser=tension building into a reveal, ` +
              'shimmer=wonder/beauty, whoosh=time/location jump, none=quiet cut.',
          },
        },
        required: ['transition', 'sfx'],
        propertyOrdering: ['transition', 'sfx'],
      },
    },
    subscribe_after_scene: {
      type: Type.INTEGER,
      description:
        'The 1-based scene number at whose START the subscribe reminder appears — pick a natural ' +
        'breathing point (never scene 1, never the final scene, ideally right after a payoff beat).',
    },
    ambience: {
      type: Type.STRING,
      description:
        'A 2-5 word sound-library search query for ONE background ambience bed matching the ' +
        "story's SETTING (e.g. 'battlefield distant wind', 'rain forest night', 'spaceship " +
        "engine hum', 'medieval market crowd'). Lowercase words only, no punctuation.",
    },
  },
  required: ['music_mood', 'boundaries', 'subscribe_after_scene', 'ambience'],
  propertyOrdering: ['music_mood', 'boundaries', 'subscribe_after_scene', 'ambience'],
};

const SYSTEM = `You are the FILM EDITOR and SOUND DESIGNER of a premium faceless YouTube Shorts channel.
You receive a scene-by-scene story. Design the edit like a pro:
- Pacing lives in CUTS: at LEAST two thirds of boundaries must be 'cut'. A real Shorts edit breathes
  through hard cuts; a video that dissolves everywhere reads as a slideshow, not an edit (measured
  live: zero detectable scene changes across a 39s video). Use an animated transition only where the story's
  emotion shifts (a reveal, a time jump, entering the twist). Never more than ~40% animated.
- Sound tells the story — every SFX has a PURPOSE, matched to the narration beat, never decoration:
  reveal/discovery → 'shimmer'; a question/time-or-place jump → 'whoosh'; danger/weight → 'impact' (low
  hit); building INTO a reveal → 'riser'; the final answer/resolution → 'impact'. Wrong-purpose SFX is
  worse than silence.
- MUSIC AS A CO-EDITOR (music_mood + let it breathe with the story): the mood should imply a shape —
  lift under the hook, a drop/hit at the biggest reveal, a brief pull-back before the twist, a settled
  resolution on the payoff. Pick the mood that supports that emotional curve, not just the topic.
- SFX DISCIPLINE: nominate 3-5 audible boundary sfx per video, only when the story earns one. Each must land ON a meaningful narration moment (the crystal/object reveal,
  the split/reveal, the final resolution) — NOT random. Space them out (don't stack two within a few
  seconds) and vary the type. Never add a whoosh just to hit a count. The renderer adds a separate subtle hook cue.
- SFX ARE EARNED, NOT SCHEDULED: leave 'none' unless the incoming line genuinely carries that meaning
  (impact=a hard turn/shock, riser=tension climbing into a reveal, shimmer=discovery/light,
  whoosh=physical movement or a time jump). A sound with no relationship to what is being said is
  worse than silence — live feedback called the old scheduled cues "completely irrelevant".
  An animated transition may be silent; do NOT add a whoosh just because a transition animates.
  'none' is allowed ONLY on plain cuts.
- Pick the music mood by the story's FEELING, not its surface topic (a dark science story = mystery).
- Place the subscribe reminder only after the payoff, in the final beat.
- Choose ONE ambience bed for the whole video: the real-world background sound of the story's main
  SETTING (a battlefield, a jungle, a lab, deep space). It plays very quietly under the music and
  makes the video feel like real footage instead of narrated slides. Keep the query generic enough
  to exist in a sound library — places and textures, not story specifics.`;

/**
 * @param {object} script - generateScript çıktısı
 * @returns {Promise<object|null>} temizlenmiş kurgu planı veya null
 */
export async function planEdit(script) {
  if (!config.gemini.apiKey || !script?.scenes?.length || script.scenes.length < 3) return null;
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const N = script.scenes.length;

  const brief = script.scenes.map((s, i) => `Scene ${i + 1}: ${s.narration}`).join('\n');
  const insight = script.strategyBrief
    ? `PERFORMANCE INSIGHT (bias the edit/mood toward what works): ${script.strategyBrief}\n\n`
    : '';
  const prompt = `Topic: ${script.topic} (category: ${script.category})

${insight}${brief}

Design the edit: exactly ${N - 1} boundaries, plus music mood and subscribe placement.`;

  const response = await generateWithRetry(ai, {
    model: config.gemini.model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: EDIT_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const plan = JSON.parse(response.text || '{}');

  // --- Temizle/doğrula: model saçmalarsa mekanik plana düşülür ---
  if (!Array.isArray(plan.boundaries) || plan.boundaries.length !== N - 1) return null;
  const boundaries = plan.boundaries.map((b) => {
    const transition = TRANSITIONS.includes(b.transition) ? b.transition : 'cut';
    let sfxType = SFX.includes(b.sfx) ? b.sfx : 'none';
    // Animasyonlu geçiş asla sessiz olamaz (canlıda "bozuk" hissi verdi).
    // ZORLA WHOOSH KALDIRILDI: "animasyonlu geçiş sessiz kalmasın" diye her
    // geçişe whoosh basmak, sesi anlamdan kopartıyordu (26 Tem: "alakasız").
    // Sesi artık semanticSfx anlatımdan türetiyor; burada 'none' NONE kalır.
    return { transition, sfx: sfxType };
  });
  // Decorative transitions are exceptional: max two and no more than 25%.
  const animated = boundaries.filter((b) => b.transition !== 'cut').length;
  let excess = animated - Math.min(2, Math.floor((N - 1) / 4));
  for (let i = boundaries.length - 1; i >= 0 && excess > 0; i -= 1) {
    if (boundaries[i].transition !== 'cut') {
      boundaries[i].transition = 'cut';
      excess -= 1;
    }
  }
  const musicMood = MOODS.includes(plan.music_mood) ? plan.music_mood : null;
  let sub = Number(plan.subscribe_after_scene);
  if (!Number.isFinite(sub) || sub < N - 1 || sub > N) sub = N;

  // Ambiyans sorgusu: sade kelimelere indir (arama API'sine güvenli gider);
  // boş/saçma kalırsa null — çağıran taraf kategori varsayılanına düşer.
  const ambience =
    String(plan.ambience || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 5)
      .join(' ') || null;

  return { boundaries, musicMood, subscribeScene: sub - 1, ambience }; // subscribeScene 0-tabanlı
}
