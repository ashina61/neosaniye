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
            description:
              '1-3 SPECIFIC stock-search phrases naming the exact subject/species ' +
              '(e.g. "leafcutter ants carrying leaves", NOT just "ants"). Wrong-species footage ' +
              'destroys credibility. Only meaningful when motion=true.',
          },
          real_subject: {
            type: Type.STRING,
            nullable: true,
            description:
              'If this scene depicts a SPECIFIC real, named, photographable thing — a famous ' +
              'artifact, monument, painting, document, place or person (e.g. "Antikythera mechanism ' +
              'fragment", "Rosetta Stone", "Great Serpent Mound aerial") — give its canonical English ' +
              'name for an open-license archive photo search. REAL photos beat AI reconstructions for ' +
              'credibility. Leave null for generic/atmospheric scenes.',
          },
          stat: {
            type: Type.OBJECT,
            nullable: true,
            description:
              'Set ONLY when this scene\'s core IS one striking NUMBER that is EXPLICITLY stated in ' +
              'this scene\'s narration (e.g. "50 times per second", "20,000 acres", "1,200 years"). ' +
              'Then this scene becomes a bold animated number card instead of a photo. ' +
              'Leave null for every other scene. Never scene 1. At most ONE scene per video.',
            properties: {
              value: { type: Type.NUMBER, description: 'The plain integer to count up to (e.g. 50, 20000). Digits only.' },
              unit: { type: Type.STRING, description: 'Short unit/qualifier shown under the number, 1-4 words (e.g. "times per second", "acres", "years"). No symbols.' },
              label: { type: Type.STRING, description: 'Tiny caption under the unit giving context, 2-5 words (e.g. "A hummingbird\'s wingbeat").' },
            },
            propertyOrdering: ['value', 'unit', 'label'],
          },
          diagram: {
            type: Type.OBJECT,
            nullable: true,
            description:
              'Set ONLY for a how-it-works style story, on the ONE scene whose narration sums up ' +
              'the mechanism: the scene becomes an animated step-by-step card. steps = 2-4 ultra-short ' +
              'phrases (3-5 words each) strictly derived from what the script actually explains. ' +
              'Leave null everywhere else. Never scene 1. A video may have AT MOST one special card ' +
              '(stat OR diagram, never both).',
            properties: {
              title: { type: Type.STRING, description: 'Card heading, 2-4 words (e.g. "How it hovers"). No punctuation.' },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-4 steps, each 3-5 words, plain language, in process order',
              },
            },
            propertyOrdering: ['title', 'steps'],
          },
          forbidden_mismatches: {
            type: Type.ARRAY,
            nullable: true,
            items: { type: Type.STRING },
            description:
              'SEMANTIC GUARD: 2-5 single words that a stock clip for THIS scene must NOT be about ' +
              '(topic-irrelevant subjects). E.g. for a Viking sea-navigation scene: ' +
              '["cyclist","street","office","milk","portrait"]. The system rejects any stock hit ' +
              'whose keyword matches these, so an off-topic clip (a cyclist in a Viking video) is ' +
              'never used just because it exists. Derive from what would clearly NOT explain the line.',
          },
        },
        required: ['shot', 'image_prompt', 'motion', 'stock_keywords'],
        propertyOrdering: ['shot', 'image_prompt', 'motion', 'stock_keywords', 'real_subject', 'stat', 'diagram', 'forbidden_mismatches'],
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
- For motion scenes give 1-3 stock_keywords that NAME THE EXACT SPECIES/SUBJECT ("leafcutter ants
  carrying leaves", never just "ants") — wrong-species footage is a credibility killer.
- REAL ARTIFACTS: when the story is about a specific REAL named object/place (a mechanism, a
  monument, a painting), set real_subject with its canonical name — the system will fetch a REAL
  open-license photograph, which beats any AI reconstruction for documentary credibility.
- LIVING CREATURES: AI image generation DEFORMS animal/insect anatomy in close-ups (wrong leg
  count, broken heads — seen live). For animal subjects prefer REAL footage (motion=true). When an
  AI image is unavoidable for an animal, avoid extreme close-up full-body anatomy: use wide
  environment shots, silhouettes, or the creature small-in-frame instead.
- image_prompt must be a single concrete filmable shot. Never request text, captions, logos, watermarks.
- NUMBER CARD (optional, powerful): if exactly one scene's core is a striking NUMBER that is
  literally stated in its narration, set that scene's "stat" (value/unit/label). It becomes a bold
  animated count-up card — a strong pattern-interrupt. Use it for AT MOST one scene, never scene 1,
  and only when the number is genuinely in the narration. Otherwise leave stat null everywhere.
- HOW-IT-WORKS CARD (mechanism videos: REQUIRED, not optional): if ANY narration explains how
  something works (splits light, refracts, "the reason", a 2-4 step process), you MUST set "diagram"
  on the scene that sums up the mechanism — a plain object B-roll is NOT enough to explain a
  mechanism. title (2-4 words) + 2-4 ultra-short steps (3-5 words each) strictly from the script.
  Keep it readable at a glance: arrows/rays/highlights, never a tiny dense scientific chart.
  Never scene 1. A video gets AT MOST one special card total: stat OR diagram, never both.
- DEMONSTRATION SCENES: if a scene shows someone USING an object to prove a point, the shot must
  show the RESULT of the action (the object turning, two brightnesses changing, a direction arrow
  appearing) — a person merely holding/looking at the object does not demonstrate anything.
- SEMANTIC RELEVANCE: every shot must visually explain its exact narration line. For each scene set
  "forbidden_mismatches" (topic-irrelevant subjects to reject) so stock search never picks an
  off-topic clip just because footage exists.`;

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
    // Gerçek arşiv fotoğrafı adayı (opsiyonel) — generateImages Commons/Met'te arar.
    if (shot.real_subject && String(shot.real_subject).trim().length > 2) {
      scene.real_subject = String(shot.real_subject).trim().slice(0, 80);
    }
    // Sayı kartı adayı (opsiyonel) — doğrulama/guard generateImages'te yapılır.
    if (shot.stat && Number(shot.stat.value) > 0 && i > 0) {
      scene.stat = {
        value: Number(shot.stat.value),
        unit: String(shot.stat.unit || '').trim(),
        label: String(shot.stat.label || '').trim(),
      };
    }
    // "How it works" adım kartı adayı (opsiyonel) — guard generateImages'te.
    if (shot.diagram && Array.isArray(shot.diagram.steps) && i > 0) {
      scene.diagram = {
        title: String(shot.diagram.title || '').trim(),
        steps: shot.diagram.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 4),
      };
    }
    // Semantik yasak-uyumsuzluk listesi (stok görsel reddi + QC alaka ölçümü).
    if (Array.isArray(shot.forbidden_mismatches) && shot.forbidden_mismatches.length) {
      scene.forbidden_mismatches = shot.forbidden_mismatches
        .map((w) => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 5);
    }
  });
  return script;
}
