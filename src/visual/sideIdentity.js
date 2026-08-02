/**
 * TARAF RENK KİMLİĞİ (§8) — "sesi kapatsan bile hangi taraf anlatılıyor bilirsin."
 *
 * ================== NEDEN VAR ==================
 * Karşılaştırma konularında (insan vs AI, eski vs yeni, avcı vs av) tüm video
 * tek bir global renk stiliyle üretiliyordu. brain-vs-ai-memory'de her sahne
 * aynı mavi-siyah paletteydi; izleyici hangi sahnenin insanı, hangisinin AI'yı
 * anlattığını yalnızca ANLATIMDAN anlıyordu. Sesi kapatan (Shorts izleyicisinin
 * çoğunluğu) hiçbir şey anlamıyordu.
 *
 * Çözüm: iki tarafa AYRI görsel kimlik. Renk, doku ve hareket dili birlikte
 * değişir — yalnızca renk değiştirmek daltonik izleyici için işe yaramaz.
 */

/** İki taraflı konularda kullanılan kimlik çiftleri. */
export const SIDE_IDENTITIES = {
  human: {
    label: 'HUMAN',
    accent: 'F0A72B',              // sıcak amber
    promptStyle: 'warm amber tones, soft organic texture, irregular natural edges, '
      + 'gentle film grain',
    motion: 'irregular',           // hafif düzensiz hareket
  },
  ai: {
    label: 'AI',
    accent: '3BD0C8',              // soğuk camgöbeği
    promptStyle: 'cool cyan tones, sharp geometry, precise grid structure, '
      + 'clean edges, no grain',
    motion: 'precise',             // düz, ölçülü hareket
  },
  past: {
    label: 'THEN',
    accent: 'C89B6A',
    promptStyle: 'warm sepia tones, aged texture, soft focus edges',
    motion: 'irregular',
  },
  present: {
    label: 'NOW',
    accent: '3BD0C8',
    promptStyle: 'cool neutral tones, crisp modern clarity, sharp detail',
    motion: 'precise',
  },
};

/** Bir sahnenin hangi tarafı anlattığını belirleyen sinyaller. */
const SIDE_SIGNALS = [
  ['ai', /\b(ai|artificial intelligence|machine|computer|algorithm|model|system|database|server|digital|neural net)\b/i],
  ['human', /\b(human|humans|brain|person|people|we|our|mind|memory|emotion|feel|remember)\b/i],
  ['past', /\b(ancient|historic|centuries ago|in the past|once|originally|old|former)\b/i],
  ['present', /\b(today|modern|now|currently|contemporary|these days)\b/i],
];

/**
 * Konu iki taraflı bir karşılaştırma mı? Öyleyse hangi çift?
 *
 * DÜRÜST SINIR: her video karşılaştırma değildir. İki taraf da metinde
 * GERÇEKTEN geçmiyorsa kimlik uygulanmaz — bir doğa belgeseline zorla
 * "HUMAN vs AI" rengi vermek anlamsız olurdu.
 *
 * @param {object} script
 * @returns {{a:string, b:string}|null}
 */
export function detectSidePair(script = {}) {
  const text = [script.topic, ...(script.scenes || []).map((s) => s.narration)]
    .filter(Boolean).join(' ');
  const hits = new Set();
  for (const [side, re] of SIDE_SIGNALS) if (re.test(text)) hits.add(side);
  if (hits.has('human') && hits.has('ai')) return { a: 'human', b: 'ai' };
  if (hits.has('past') && hits.has('present')) return { a: 'past', b: 'present' };
  return null;
}

/**
 * Bir sahne hangi tarafa ait? Belirsizse null (nötr kalır).
 * @param {string} narration
 * @param {{a:string,b:string}} pair
 */
export function sideOfScene(narration = '', pair) {
  if (!pair) return null;
  const reA = SIDE_SIGNALS.find(([s]) => s === pair.a)?.[1];
  const reB = SIDE_SIGNALS.find(([s]) => s === pair.b)?.[1];
  const a = reA?.test(narration);
  const b = reB?.test(narration);
  // İKİSİ DE geçiyorsa sahne karşılaştırmanın kendisidir; tek tarafa boyanmaz.
  if (a && b) return 'both';
  if (a) return pair.a;
  if (b) return pair.b;
  return null;
}

/**
 * Script'e taraf kimliği uygula: her sahnenin promptuna kendi renk/doku dilini
 * yazar ve `scene.side` alanını doldurur (aktör katmanı vurgu rengini oradan
 * okur).
 *
 * @param {object} script
 * @returns {{pair:object|null, assigned:object, scenesTouched:number}}
 */
export function applySideIdentity(script = {}) {
  const pair = detectSidePair(script);
  const assigned = {};
  if (!pair) return { pair: null, assigned, scenesTouched: 0 };

  let touched = 0;
  for (const scene of script.scenes || []) {
    const side = sideOfScene(scene.narration || '', pair);
    if (!side) continue;
    scene.side = side;
    assigned[side] = (assigned[side] || 0) + 1;
    if (side === 'both') {
      // Karşılaştırma sahnesi: İKİ dili de ister, split-screen okunsun.
      scene.sideAccent = null;
      if (scene.image_prompt) {
        scene.image_prompt = `${scene.image_prompt} Left side: `
          + `${SIDE_IDENTITIES[pair.a].promptStyle}. Right side: `
          + `${SIDE_IDENTITIES[pair.b].promptStyle}. Clear vertical separation between the two halves.`;
      }
      touched += 1;
      continue;
    }
    const id = SIDE_IDENTITIES[side];
    scene.sideAccent = id.accent;
    scene.sideMotion = id.motion;
    if (scene.image_prompt) scene.image_prompt = `${scene.image_prompt} ${id.promptStyle}.`;
    touched += 1;
  }
  script.sidePair = pair;
  return { pair, assigned, scenesTouched: touched };
}
