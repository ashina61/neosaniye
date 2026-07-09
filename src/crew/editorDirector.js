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
  },
  required: ['music_mood', 'boundaries', 'subscribe_after_scene'],
  propertyOrdering: ['music_mood', 'boundaries', 'subscribe_after_scene'],
};

const SYSTEM = `You are the FILM EDITOR and SOUND DESIGNER of a premium faceless YouTube Shorts channel.
You receive a scene-by-scene story. Design the edit like a pro:
- Pacing lives in CUTS: most boundaries are 'cut'. Use an animated transition only where the story's
  emotion shifts (a reveal, a time jump, entering the twist). Never more than ~40% animated.
- Sound tells the story: place 'impact' exactly at the biggest shock/twist boundary, 'riser' on the
  boundary building INTO a reveal, 'shimmer' at a moment of wonder, 'whoosh' for time/place jumps.
- EVERY animated (non-cut) transition MUST carry an sfx — a silent animated wipe feels broken.
  'none' is allowed ONLY on plain cuts. Aim for 3-5 audible sfx per video total.
- Pick the music mood by the story's FEELING, not its surface topic (a dark science story = mystery).
- Place the subscribe reminder at the story's most natural breathing point.`;

/**
 * @param {object} script - generateScript çıktısı
 * @returns {Promise<object|null>} temizlenmiş kurgu planı veya null
 */
export async function planEdit(script) {
  if (!config.gemini.apiKey || !script?.scenes?.length || script.scenes.length < 3) return null;
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const N = script.scenes.length;

  const brief = script.scenes.map((s, i) => `Scene ${i + 1}: ${s.narration}`).join('\n');
  const prompt = `Topic: ${script.topic} (category: ${script.category})

${brief}

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
    if (transition !== 'cut' && sfxType === 'none') sfxType = 'whoosh';
    return { transition, sfx: sfxType };
  });
  // Animasyon oranı %50'yi aşarsa fazlasını cut'a çevir (sondan başa).
  const animated = boundaries.filter((b) => b.transition !== 'cut').length;
  let excess = animated - Math.floor((N - 1) / 2);
  for (let i = boundaries.length - 1; i >= 0 && excess > 0; i -= 1) {
    if (boundaries[i].transition !== 'cut') {
      boundaries[i].transition = 'cut';
      excess -= 1;
    }
  }
  const musicMood = MOODS.includes(plan.music_mood) ? plan.music_mood : null;
  let sub = Number(plan.subscribe_after_scene);
  if (!Number.isFinite(sub) || sub < 2 || sub > N - 1) sub = Math.max(2, Math.round(N * 0.45));

  return { boundaries, musicMood, subscribeScene: sub - 1 }; // 0-tabanlı sahne indeksi
}
