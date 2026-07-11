import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import { generateWithRetry } from '../script/generateScript.js';

/**
 * ORKESTRA — Görüntü Yönetmeni (DP).
 *
 * Yönetmenin (generateScript) yazdığı hikâyeyi alır ve profesyonel bir çekim
 * listesine çevirir: her sahne için kadraj ölçeği/açı/ışık kararını verir,
 * görsel promptu rafine eder ve hangi sahnelerin GERÇEK stok videoyla
 * (hareket) destekleneceğini seçer. Tek işi görüntü — hikâyeye karışmaz.
 *
 * Düşerse boru hattı etkilenmez: yönetmenin taslak promptlarıyla devam edilir.
 */

const SHOT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      description: 'One entry per story scene, same order and count as the input',
      items: {
        type: Type.OBJECT,
        properties: {
          shot: {
            type: Type.STRING,
            description:
              'Shot scale/angle, one of: wide establishing, medium, close-up, ' +
              'extreme close-up, over-the-shoulder, low angle, high angle, detail insert',
          },
          image_prompt: {
            type: Type.STRING,
            description:
              'REFINED single cinematic shot description: subject, era, setting, action, ' +
              'the chosen shot scale/angle, lighting (subject clearly lit), mood. ' +
              'Concrete and filmable. No on-screen text/watermark.',
          },
          motion: {
            type: Type.BOOLEAN,
            description:
              'true if this scene should use REAL stock footage instead of a generated still. ' +
              'Choose the 2-3 scenes that most benefit from live motion AND are generic enough ' +
              'for stock libraries (crowds, landscapes, hands working, city, nature, ocean, fire...). ' +
              'Never scene 1.',
          },
          stock_keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1-3 simple English stock-search nouns (only meaningful when motion=true)',
          },
        },
        required: ['shot', 'image_prompt', 'motion', 'stock_keywords'],
        propertyOrdering: ['shot', 'image_prompt', 'motion', 'stock_keywords'],
      },
    },
  },
  required: ['scenes'],
};

const SYSTEM = `You are the DIRECTOR OF PHOTOGRAPHY for a premium faceless YouTube Shorts channel.
You receive a story (scene narrations + the writer's draft visual ideas + a visual anchor).
Produce a professional SHOT LIST that makes the video feel like ONE cinematic film:

- VARY shot scale deliberately like a film editor: wide establishing -> medium -> close-up ->
  detail insert -> over-the-shoulder... Consecutive scenes must NOT repeat the same framing or location.
- Respect the visual anchor (same character appearance, era, light/color mood) in every prompt.
- The subject must be CLEARLY LIT and readable on a small phone screen.
- MOTION DECISION (critical): if the story's subject exists in real film footage — nature, animals,
  weather, oceans, machines, the human body, space, cities, fire, crowds — mark MOST scenes
  motion=true (up to 5): real video beats stills for these and holds attention far better.
  For historical/period/impossible-to-film subjects, use motion=true only for the 2-3 scenes
  generic enough for stock (landscapes, hands, fire, storms). Scene 1 must always be motion=false
  (it carries the hook cover).
- For motion scenes give 1-3 simple stock_keywords.
- image_prompt must be a single concrete filmable shot. Never request text, captions, logos, watermarks.`;

/**
 * @param {object} script - generateScript çıktısı (scenes, visual_anchor, topic, category)
 * @returns {Promise<object|null>} shot list ({scenes:[...]}) veya null (uygunsuzsa)
 */
export async function directVisuals(script) {
  if (!config.gemini.apiKey || !script?.scenes?.length) return null;
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const brief = script.scenes
    .map((s, i) => `Scene ${i + 1}: "${s.narration}" (writer's draft visual: ${s.image_prompt})`)
    .join('\n');
  // Baş Analist'in izlenmeden çıkardığı strateji notu (varsa) — veriyle karar.
  const insight = script.strategyBrief
    ? `PERFORMANCE INSIGHT (bias your visual choices toward what works): ${script.strategyBrief}\n\n`
    : '';
  const prompt = `Topic: ${script.topic} (category: ${script.category})
Visual anchor (must stay consistent): ${script.visual_anchor || '-'}

${insight}${brief}

Produce the shot list (exactly ${script.scenes.length} scenes, same order).`;

  const response = await generateWithRetry(ai, {
    model: config.gemini.model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: SHOT_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const parsed = JSON.parse(response.text || '{}');
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length !== script.scenes.length) {
    return null; // sayı tutmuyorsa güvenme — taslakla devam
  }
  return parsed;
}

/** Çekim listesini script'e uygular (image_prompt/motion/stok kelimeleri). */
export function applyShotList(script, shotList) {
  let motionCount = 0;
  shotList.scenes.forEach((shot, i) => {
    const scene = script.scenes[i];
    if (shot.image_prompt && shot.image_prompt.length > 20) {
      scene.image_prompt = shot.image_prompt;
    }
    scene.shot = shot.shot;
    // İlk sahne asla motion olmaz (hook kapağı); üst sınır 5 (çekilebilir
    // konularda video ağırlıklı, tarihîde AI ağırlıklı — DP karar verir).
    const wantMotion = Boolean(shot.motion) && i > 0 && motionCount < 5;
    scene.motion = wantMotion;
    if (wantMotion) {
      motionCount += 1;
      if (Array.isArray(shot.stock_keywords) && shot.stock_keywords.length) {
        scene.stock_keywords = shot.stock_keywords.slice(0, 3);
      }
    }
  });
  return script;
}
