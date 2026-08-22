#!/usr/bin/env node
/**
 * A TOPIC IN, SIX LINES OUT.
 *
 * The one step of this pipeline that is authorship rather than derivation.
 * Everything downstream is decided: the planner reads the lines for the shot,
 * the length, the cuts, the motif and the look; the voice script reads them for
 * the clock. But somebody has to WRITE them, and no rule does that.
 *
 * The reference build does this by pasting a prompt into Claude Code and
 * reading the storyboard back as prose. That works, and it has one weakness —
 * the prompt lives in a blog post, so every episode is written to whatever the
 * author remembered of it. Here the prompt lives in the repo, next to the rules
 * it encodes, and it produces the brief the planner actually eats.
 *
 *   npm run write -- --id=hatshepsut --topic="the pharaoh they tried to erase"
 *
 * With ANTHROPIC_API_KEY or OPENAI_API_KEY set, it writes brief.json directly.
 * Without one it writes the prompt to the episode folder and tells you to paste
 * it — because the writer does not have to be an API. It can be you, or the
 * assistant you are already talking to.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const MOODS = ['gold-heat', 'cold-noir', 'green-rot', 'ash-grey'];

/** Templates a brief may direct a shot into. Kept in step with the registry. */
const TEMPLATES = ['composite', 'portal-zoom-reveal', 'title-slate', 'evidence-board', 'stacked-reveal', 'split-shift', 'parallax-punch'];
/** Drawn objects a shot may stand in the frame. Mirrors engine/schema.mjs. */
const PROP_KINDS = ['plaque', 'newspaper', 'card', 'print', 'wire', 'beam'];

/**
 * THE BRIEF-WRITING PROMPT.
 *
 * Every constraint in here is a lesson this repo paid for, not a preference:
 *
 *   SIX LINES, ~80 WORDS   the reference reel is six scenes in thirty seconds
 *                          and seventy-seven words. The draft before it was
 *                          nine lines and a hundred and eighty-four — sixty
 *                          eight seconds of narration, and the reason every cut
 *                          felt slow and every shot felt empty.
 *   NAME REAL THINGS       a model asked for "a medieval map" invents one and
 *                          invents it badly. The Catalan Atlas exists, is
 *                          photographed and is out of copyright.
 *   VERBS, NOT ADJECTIVES  the planner reads the verb to choose what gets DRAWN
 *                          over the shot. "He gave it away" earns falling gold;
 *                          "he was wealthy" earns nothing.
 *   ONE PAUSE PER LINE     the narration is the clock, and the cuts are the
 *                          silences between lines. Lines that run together give
 *                          a reel that cannot be cut to its own voice.
 */
/**
 * THE FOOTAGE BRIEF — a different supply line, so a different prompt.
 *
 * The stills brief asks for a backdrop and the objects standing in front of it,
 * because that reel is BUILT: a stack of plates with graphics drawn over them.
 * A footage reel is FOUND. Nothing is drawn, so there are no pieces to name and
 * no props to place, and the only thing each line needs is the sentence and the
 * search that will land the clip under it.
 *
 * The searches are the hard part and they are the whole brief. A phrase that
 * names a specific event ("the Leeds repair shop closing") returns nothing in
 * any stock library; a phrase that names an ACTION with hands and objects in it
 * ("hands repairing a watch, close up") returns fifty. So the line is written
 * for the story and the search is written for the library, and they are allowed
 * to be different sentences.
 */
export function footagePromptFor(topic, id, mood) {
  return `Write the voiceover for a 30-second vertical documentary reel about: ${topic}

This reel is cut from STOCK FOOTAGE. Nothing is drawn and nothing is
photographed to order — every shot is a clip somebody already filmed and
licensed for reuse, so a line that cannot be matched to an ordinary,
findable action has no picture at all.

Return ONLY a JSON object, no prose around it, in exactly this shape:

{
  "id": ${JSON.stringify(id)},
  "title": "a short title for the episode",
  "mood": ${JSON.stringify(mood)},
  "footage": true,
  "style": "handheld documentary footage, available light",
  "lines": [ six line objects ]
}

THE SCRIPT — same six lines, same discipline:

* EXACTLY SIX lines, one per scene, around 80 words TOTAL, none over 15 words.
* Line 1 is the hook and must stop a scroll on its own.
* Line 6 is the verdict. If there is a number worth saying, say it here.
* Write VERBS: what was done, what broke, what was found, what it cost.
* Every line ends in a full stop and is spoken with a pause after it — the
  reel is cut apart at those pauses.

EACH LINE OBJECT:

  "slug"      one lowercase word, unique, used in the file name
  "vo"        the spoken line
  "footage"   THE SEARCH. What the camera is looking at, phrased the way a
              stock library is indexed: an action, close, with hands or
              machines in it. "hands soldering a circuit board", "metal lathe
              turning brass", "rain on a workshop window".
              NOT a named event, NOT a named person, NOT a date — no library
              has "the Leeds repair shop in 2010". The line carries the story;
              the search only has to carry the picture under it.
              Vertical or square framing exists for far fewer subjects than
              landscape, so prefer a subject that is shot close: hands, tools,
              faces, surfaces.
  "alt"       optional second search, tried if the first finds nothing.

No "pieces", no "props", no "shot": there is nothing to place. The clip is the
shot, the words on screen come from the line itself, and the grade and the
grain are the only things this pipeline adds.`;
}

export function promptFor(topic, id, mood) {
  return `Write the voiceover for a 30-second vertical documentary reel about: ${topic}

Return ONLY a JSON object, no prose around it, in exactly this shape:

{
  "id": ${JSON.stringify(id)},
  "title": "a short title for the episode",
  "mood": ${JSON.stringify(mood)},
  "style": "documentary photograph, period-accurate, available light, muted colour, fine grain, no text, no watermark, no modern objects",
  "lines": [ six line objects ]
}

THE SCRIPT — this is the hard part, and the constraints are not style notes:

* EXACTLY SIX lines, one per scene. Around 80 words TOTAL, no line over 15 words.
  Thirty seconds of narration is 80 words. A line that will not fit in fifteen
  words is two lines or it is cut.
* Line 1 is the hook and must be able to stop a scroll on its own.
* Line 6 is the verdict. If there is a number worth saying, say it here.
* Write VERBS. What was done, what collapsed, what arrived. "He gave it away and
  the price collapsed" is a scene; "he was extremely wealthy" is a caption.
* Every line must end in a full stop, and each is spoken with a pause after it —
  they are cut apart at those pauses, so no line may run into the next.
* You do not need an original story. Take one that already works and tell it
  sharper than everyone else did.

A SHOT IS NOT A PHOTOGRAPH. IT IS A STACK OF PIECES.

This is the part that decides whether the reel is any good, so it is not
optional. One photograph per scene, pushed into slowly, is a slideshow — six
pictures and some text, which is what this pipeline produced until somebody
watched it. The reference reel's opening frame is a SKY, two cut-out CLOUDS
drifting at different speeds, a cut-out BUILDING, a FIGURE, a FRAME and a paper
TEXTURE: seven files, not one of them a whole picture.

So for every line you name the BACKDROP and then the things that stand in front
of it. They are separate files on purpose — separate files can move at different
speeds, and that difference is the only reason a flat plate reads as a space.

EACH LINE OBJECT:

  "slug"          one lowercase word, unique, used in file names
  "vo"            the spoken line
  "image"         the BACKDROP — what is BEHIND everything. One phrase, a place
                  or a surface, with nothing standing in it. "an empty lecture
                  room", not "ten men in a lecture room".
  "imageCommons"  1-3 Wikimedia Commons searches for something that REALLY
                  EXISTS and is photographed — a named place, building, map or
                  artefact. Most specific first, broader as fallback. Omit only
                  if the shot is genuinely nameless scenery.
  "pieces"        2-4 SINGLE OBJECTS that stand in front of that backdrop, and
                  the reason the shot has depth. REQUIRED on every line but one.
                  Each is ONE thing, phrased singular, photographable on its own:
                      "chalkboard on a wooden easel"
                      "man in a suit standing in profile"
                      "wooden chair, empty"
                  NOT a scene ("men around a table"), NOT a plural ("a row of
                  chairs"), NOT two things joined by "and". Each one is cut out
                  and placed at its own depth, so anything that is already a
                  picture cannot be used.

  "shot"          THE CHOREOGRAPHY. Required. This is the part that decides
                  whether the reel is directed or merely assembled — see below.

THE SHOT — you are the director here, not a labeller.

A pipeline that picks the camera move from a rotation and the prop positions
from a random number produces the same reel every time with different
photographs in it, and it composes nonsense: a newspaper hanging in mid-air in
front of a building, because nothing decided to put it there. YOU decide. One
shot at a time, and say why in the signature.

  "shot": {
    "template":  "composite" for a room with things in it (the default),
                 "portal-zoom-reveal" to fly INTO a framed photograph,
                 "title-slate" for a hard typographic card with no photo,
                 "evidence-board" for pinned cards on a surface.
    "signature": ONE sentence naming the single move this shot exists for.
                 "the front page lands on the desk and the room pushes past it".
                 If you cannot name it, the shot has no reason to be a shot.
    "camera":    {"from": 1.0, "to": 1.35, "focus": "hunt" | "sharp"}
                 Scale at the start and end of the shot. Push IN (to > from) or
                 PULL BACK (to < from) — two pushes in a row read as one move
                 with a stutter. "hunt" makes the lens find focus like an old
                 camera; use it where the shot opens on something.
    "layers":    THE SHOT'S MATERIAL LIST — the photographs, back to front. Each
                 one is a separate file on purpose, because separate files move
                 at different speeds and that difference is the only reason a
                 flat plate reads as a space.
                   "role"    a short name: map, road, tank, man, wall
                   "asset"   the file name it will be saved as, e.g. "tank.png".
                             A NAME, never a path.
                   "kind"    "backdrop" fills the frame; "piece" is cut out to
                             transparency and stood in front of it
                   "commons" 1-3 Wikimedia searches for it, most specific first
                   "prompt"  what to draw if nothing free exists
                   "depth"   0 to 1, its share of the camera push. The backdrop
                             is low, the thing at the front is 1.
                   "height"  a PIECE only: how tall it stands, as a fraction of
                             the frame height. Leave it out for a backdrop.
                   "x","y"   a PIECE only: fractions, where its FEET stand
                   "at"      fraction of the shot when it arrives
                   "enter"   "left" | "right" | "top" | "bottom" — the edge it
                             travels in from. The reference reel's offer scene
                             is one hand from the LEFT and one from the RIGHT a
                             second apart; that is the whole scene.
                   "swing"   degrees of decaying sway as it lands
                   "shadow"  true for a figure standing on the ground
    "anchor":    [x, y] fractions — the point on the FLOOR that every plate
                 scales about. If a figure is standing, this is his feet. Get it
                 wrong and he scales off the pavement into the air.
    "text":      where the caption goes and how it arrives. It is the last thing
                 a viewer needs to read, so it is placed, never scattered:
                   "x","y"   fractions of the frame
                   "size"    fraction of the frame WIDTH, about 0.07
                   "at"      fraction of the shot when the first line lands
                   "every"   frames between lines — they land one at a time
                   "scrim"   0 to 1, how much ground the words carry under them.
                             Over a dark empty corner 0.2; over a printed map
                             0.6; over a shot that should speak for itself, 0.
    "cut":       how this shot ARRIVES, if you want to choose: "slam" (something
                 landed), "rack" (something was noticed), "slip" (something was
                 put down), "flare" (the beat that breaks the story), "blinds"
                 (a room being opened on). Leave it out and it is read from the
                 line's own verb.
    "props":     the drawn objects standing in this shot. THIS IS THE SHOT'S
                 CONTENT, not decoration:
                   "kind"  plaque | newspaper | card | print | wire | beam
                   "text"  what it says, AND IT COMES OUT OF THE LINE. The
                           reference's three front pages read NO LATE FEES, NO
                           STORES, CUSTOMER FIRST while the narrator says "No
                           late fees. No stores. Customer first." — same words,
                           same moment. A headline that paraphrases the line is
                           a second, quieter voice arguing with the first. Use
                           the line's own words or leave the prop out.
                   "size"  fraction of the frame WIDTH, 0.2 to 0.95. A front
                           page that is the point of the shot is 0.8+; a
                           caption plaque is 0.3. A newspaper at 0.4 floating
                           over a photograph reads as a sticker — if it is
                           worth showing, it is worth filling the frame.
                   "x","y" fractions of the frame, 0 to 1, where its CENTRE
                           sits. Put it where it belongs in the picture: a
                           paper lies on a desk, a plaque hangs under a
                           picture, a beam comes in from a window.
                   "at"    fraction of the shot, 0 to 1, when it arrives.
                           Stagger them — things landing together read as one
                           event, not three.
                   "depth" 0 to 1, its share of the camera push. Near things
                           take more. Nothing else gives a flat plate depth.
                   "tilt"  degrees, for paper that was put down by a hand.
  }

Rules for the shot, and they are the ones that cost the most to learn:

* A SHOT DOES ONE THING. Three props competing is no props at all. Two is
  usually right, one is often better, and the signature says which one wins.
* IF A PROP IS THE SUBJECT, IT FILLS THE FRAME. Three newspapers landing one
  after another on a desk is a whole scene and needs no photograph behind it.
* PUT THINGS WHERE THEY WOULD BE. A newspaper needs a surface under it. A
  plaque hangs on a wall below what it captions. Anything floating in open air
  is a graphic pasted on a picture and it looks like one.
* VARY THE MOVE. If the last shot pushed in, this one pulls back or cuts to a
  card. Six slow pushes is a slideshow whatever is drawn on top.

OPTIONAL, and only where the line earns it — an unused one is better than a
wrong one:

  "kicker","title","footer"   for a line that STATES something. The title is set
                              large; make it two or three words, or a number.
  "artefact" + "artefactCommons"
                              for a line about ONE object. Becomes a flight into
                              a photograph of it.
  "stops"                     3-5 real place names, for a line about a journey.
                              Draws an itinerary, stop by named stop.
  "items"                     up to 3 cards as "card|HEADING|one short line",
                              for a line that lists three things.
  "caption"                   2-3 short fragments that land one at a time.
  "onScreen"                  one very short card, 2-3 words.
  "motif"                     coins | rise | route | embers | rays | tally —
                              what gets DRAWN acting out the line's verb. Or
                              "none" to leave the shot alone. Leave it out and
                              it is inferred from the words.

Return the JSON and nothing else.`;
}

/** Anthropic messages, or the OpenAI chat protocol. Whichever key is present. */
async function ask(prompt) {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) {
    const response = await fetch(`${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'}/messages`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-api-key': anthropic, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({
        model: process.env.WRITE_MODEL || 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{role: 'user', content: prompt}],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`Anthropic HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`);
    const body = await response.json();
    return body?.content?.map((part) => part.text ?? '').join('') ?? '';
  }

  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    const base = process.env.WRITE_BASE_URL || process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1';
    const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${openai}`},
      body: JSON.stringify({
        model: process.env.WRITE_MODEL || 'gpt-4o',
        messages: [{role: 'user', content: prompt}],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`);
    const body = await response.json();
    return body?.choices?.[0]?.message?.content ?? '';
  }

  return null;
}

/** Models wrap JSON in prose and fences however they feel. Dig it out. */
export function jsonFrom(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the reply');
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * THE RULES, CHECKED — because a prompt is a request, not a guarantee.
 *
 * A model that returns nine lines is not a model that misunderstood; it is one
 * that will produce a sixty-eight-second reel, which is the exact failure this
 * whole discipline exists to prevent. So the brief is refused rather than
 * written, with the counts, and the same prompt run again usually complies.
 */
export function problemsWith(brief) {
  const problems = [];
  if (!Array.isArray(brief?.lines)) return ['no lines array'];
  /**
   * A FOOTAGE BRIEF IS HELD TO THE SCRIPT, NOT TO THE STACK.
   *
   * Every rule below about pieces, props and the camera exists because a still
   * reel is BUILT — and a brief that hands over six photographs and no depth is
   * the failure they catch. A footage reel has none of that machinery: there is
   * one clip per shot, nothing stands in front of it, and the camera holds
   * still because the picture is already moving. What it can fail at instead is
   * a search no library can answer, so that is what is checked.
   */
  const footage = brief.footage === true;
  if (brief.lines.length !== 6) problems.push(`${brief.lines.length} lines, must be exactly 6`);

  const words = brief.lines.reduce((total, l) => total + String(l?.vo ?? '').trim().split(/\s+/).filter(Boolean).length, 0);
  // 92, not 100. The per-line cap is fifteen, so six lines all sitting at it
  // comes to ninety — a total ceiling above that catches nothing, and the whole
  // point of a ceiling is to catch a script that is short line by line and long
  // end to end. Ninety-two words is about thirty-four seconds.
  if (words > 92) problems.push(`${words} words — thirty seconds of narration is about 80`);

  const slugs = new Set();
  let flat = 0;
  for (const [i, line] of brief.lines.entries()) {
    const vo = String(line?.vo ?? '').trim();
    const n = vo.split(/\s+/).filter(Boolean).length;
    if (!vo) problems.push(`line ${i + 1}: no vo`);
    else if (n > 17) problems.push(`line ${i + 1}: ${n} words — over fifteen means it is two lines`);
    if (!line?.slug) problems.push(`line ${i + 1}: no slug`);
    else if (slugs.has(line.slug)) problems.push(`line ${i + 1}: slug "${line.slug}" is used twice`);
    else slugs.add(line.slug);
    // A footage line says what the camera is looking at in `footage`; the
    // check for that is a few lines down, with the rest of the supply rules.
    if (!line?.image && !footage) problems.push(`line ${i + 1}: no image — say what we are looking at`);

    // A SHOT IS A STACK. A line with no pieces is one photograph pushed into
    // slowly, and six of those is a slideshow — the exact failure that made a
    // finished reel worth throwing away. One bare line is a rest; two is a
    // pattern.
    if (footage) {
      const search = String(line?.footage ?? line?.image ?? '').trim();
      if (!search) {
        problems.push(`line ${i + 1}: no footage search — say what the camera is looking at`);
      } else if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(search) || /^[A-Z][a-z]+ [A-Z]/.test(search)) {
        // No library is indexed by event. "Leeds 2010" returns nothing and the
        // shot ends up empty; the story is the LINE's job, not the search's.
        problems.push(
          `line ${i + 1}: footage search "${search}" names a date or an event — a stock library is indexed by action`,
        );
      }
      continue;
    }

    const pieces = Array.isArray(line?.pieces) ? line.pieces.map((p) => String(p ?? '').trim()).filter(Boolean) : [];

    /**
     * A STACK IS A STACK HOWEVER IT WAS DECLARED.
     *
     * `pieces` was the first way to say "these things stand in front of the
     * backdrop" and it is the weaker one: a bare phrase, placed by rule. A
     * directed `shot.layers` says the same thing and more — the file, the size,
     * the point it stands on, the edge it enters from and what to draw or fetch
     * for it. Counting only the old form told a brief that had done the work
     * properly that it was six slides.
     */
    const standing = (line?.shot?.layers ?? []).filter((l) => l?.height !== undefined).length;
    const drawn = (line?.shot?.props ?? []).length;
    if (!pieces.length && !standing && !drawn) flat += 1;
    else if (pieces.length > 4) problems.push(`line ${i + 1}: ${pieces.length} pieces — four is already a crowded frame`);

    for (const piece of pieces) {
      // Each piece is CUT OUT and given its own depth, so anything that is
      // already a picture cannot be one. "men around a table" keys to a
      // rectangle; "a row of chairs" keys to confetti. Both pass every other
      // check in this file and both cost the shot its depth.
      // The SUBJECT is the first noun, and if it is plural the phrase is a
      // scene however singular the rest of it reads. "men around a table"
      // trips none of the word checks below and is a picture, not a piece.
      const subject = piece.toLowerCase().replace(/^(a|an|the|one)\s+/, '').split(/\s+/)[0] ?? '';
      const plural =
        /^(men|women|people|children|feet|teeth|geese|mice|crowds?|troops)$/.test(subject) ||
        /[^s]s$/.test(subject);

      if (/\band\b|\bwith\b|,/.test(piece)) {
        problems.push(`line ${i + 1}: piece "${piece}" is two things — one object per piece`);
      } else if (
        plural ||
        /\b(row|group|crowd|pile|stack|set|pair|bunch|line)\s+of\b|\bseveral\b|\bmany\b|\bsome\b/i.test(piece)
      ) {
        problems.push(`line ${i + 1}: piece "${piece}" is a scene, not an object — it cannot be cut out`);
      }
    }

    /**
     * A SHOT HAS TO BE DIRECTED, and this is where that is enforced.
     *
     * Everything else in this file checks the WRITING. This checks the
     * DIRECTING, and it is the check that was missing for the whole life of the
     * pipeline: without it the planner picked the camera move from a rotation
     * and the prop positions from a random number, which produces the same reel
     * every time with different photographs in it — and composes nonsense,
     * because nothing decided anything. A newspaper ended up hanging in mid-air
     * in front of a university portico. Nobody put it there; a die did.
     */
    const shot = line?.shot;
    if (typeof shot !== 'object' || shot === null) {
      problems.push(`line ${i + 1}: no shot — say how this one is directed, not just what it says`);
    } else {
      if (!String(shot.signature ?? '').trim()) {
        problems.push(`line ${i + 1}: shot has no signature — name the ONE move it exists for`);
      }
      if (shot.template !== undefined && !TEMPLATES.includes(shot.template)) {
        problems.push(`line ${i + 1}: shot.template "${shot.template}" is not one of ${TEMPLATES.join(', ')}`);
      }
      const from = shot.camera?.from ?? 1;
      const to = shot.camera?.to ?? 1.3;
      // A shot that neither pushes nor pulls is a still frame with grain on it.
      if (Math.abs(to - from) < 0.06) {
        problems.push(`line ${i + 1}: camera goes ${from}→${to} — that is a still frame, push in or pull back`);
      }

      const props = Array.isArray(shot.props) ? shot.props : [];
      if (props.length > 3) {
        problems.push(`line ${i + 1}: ${props.length} props — a shot does one thing, three compete and none wins`);
      }
      for (const prop of props) {
        if (!PROP_KINDS.includes(prop?.kind)) {
          problems.push(`line ${i + 1}: prop kind "${prop?.kind}" is not one of ${PROP_KINDS.join(', ')}`);
          continue;
        }
        const size = Number(prop.size);
        // THE LESSON FROM THE CONTACT SHEET. A front page rendered at 0.4 of
        // the frame is a cream rectangle with unreadable type floating over an
        // unrelated photograph — it reads as a placeholder, because at reel
        // size that is exactly what it looks like. Either it is the subject and
        // it fills the frame, or it is a caption and it is small on purpose.
        if (!(size > 0.15 && size <= 0.98)) {
          problems.push(`line ${i + 1}: prop "${prop.kind}" has size ${prop.size} — give it 0.2 to 0.95 of the frame`);
        } else if (prop.kind === 'newspaper' && size < 0.6) {
          problems.push(
            `line ${i + 1}: a newspaper at ${size} of the frame is a sticker — 0.6+ if it is worth showing at all`,
          );
        }
        if (prop.kind !== 'beam' && !String(prop.text ?? '').trim()) {
          problems.push(`line ${i + 1}: prop "${prop.kind}" carries no text — say what it says`);
        } else if (prop.kind !== 'beam') {
          /**
           * WHAT IT SAYS IS WHAT IS BEING SAID.
           *
           * The reference reel's three front pages read NO LATE FEES, NO STORES,
           * CUSTOMER FIRST while the narrator says "No late fees. No stores.
           * Customer first." — the same words, at the same moment. That is why
           * they land; a headline that paraphrases the line is a second, quieter
           * voice arguing with the first one.
           *
           * So the words on a drawn object have to come OUT of the line. Not a
           * summary of it, not a title for it: a fragment of it.
           */
          const words = (text) =>
            String(text)
              .toLowerCase()
              .replace(/[^a-z0-9\s·]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length > 2);
          const said = new Set(words(`${vo} ${line.title ?? ''} ${(line.caption ?? []).join(' ')}`));
          const missing = words(prop.text).filter((w) => !said.has(w) && !/^\d+$/.test(w));
          if (missing.length) {
            problems.push(
              `line ${i + 1}: prop says "${prop.text}" but the line never says ${missing.map((w) => `"${w}"`).join(', ')}` +
                ` — put the line's own words on it`,
            );
          }
        }
      }
    }
  }
  if (flat > 1) {
    problems.push(`${flat} lines have nothing in front of the backdrop — a shot is a stack, and this is ${flat} slides`);
  }
  return problems;
}

async function main() {
  const args = parseArgs();
  const id = typeof args.id === 'string' ? args.id.trim() : '';
  const topic = typeof args.topic === 'string' ? args.topic.trim() : '';
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !topic) {
    console.error('Usage: npm run write -- --id=<episode-id> --topic="what it is about" [--mood=gold-heat]');
    process.exit(1);
  }

  const mood = typeof args.mood === 'string' ? args.mood : MOODS[0];
  if (!MOODS.includes(mood)) {
    console.error(`✗ mood "${mood}" is not one of ${MOODS.join(', ')}`);
    process.exit(1);
  }

  const dir = episodeDir(id);
  await mkdir(dir, {recursive: true});
  const footage = args.footage === true || args.footage === 'true';
  const prompt = footage ? footagePromptFor(topic, id, mood) : promptFor(topic, id, mood);

  const reply = await ask(prompt);
  if (!reply) {
    // NO KEY IS NOT A DEAD END. The writer does not have to be an API — the
    // reference build's whole method is pasting a prompt into an assistant and
    // pasting the answer back. Put the prompt where it can be picked up.
    const file = path.join(dir, 'PROMPT.md');
    await writeFile(file, `${prompt}\n`, 'utf8');
    // An absolute path when the episode shelf has been moved, a repo-relative
    // one when it has not — `../../../tmp/...` helps nobody.
    const show = (p) => (p.startsWith(ROOT) ? path.relative(ROOT, p) : p);
    console.log(`No ANTHROPIC_API_KEY or OPENAI_API_KEY — so the prompt is written instead.\n`);
    console.log(`  1. Open   ${show(file)}`);
    console.log(`  2. Paste the whole thing to any assistant — this one included.`);
    console.log(`  3. Save the JSON it answers with as:\n               ${show(path.join(dir, 'brief.json'))}`);
    console.log(`  4. Run     npm run plan -- --episode=${id}\n`);
    console.log(`The plan step will tell you anything the brief got wrong before a frame is rendered.`);
    return;
  }

  const brief = jsonFrom(reply);
  const problems = problemsWith(brief);
  if (problems.length) {
    console.error(`✗ the script does not hold to the shape — nothing was written:\n`);
    for (const problem of problems) console.error(`   · ${problem}`);
    console.error('\n   Run it again; the same prompt usually complies on a second pass.');
    process.exit(1);
  }

  const file = path.join(dir, 'brief.json');
  if (await exists(file) && !args.force) {
    console.error(`✗ ${path.relative(ROOT, file)} already exists — pass --force to overwrite it.`);
    process.exit(1);
  }
  await writeFile(file, `${JSON.stringify({...brief, id, mood, ...(footage ? {footage: true} : {})}, null, 2)}\n`, 'utf8');

  const words = brief.lines.reduce((t, l) => t + l.vo.trim().split(/\s+/).length, 0);
  console.log(`✓ ${path.relative(ROOT, file)} — 6 lines, ${words} words, ~${(words / 2.7).toFixed(0)}s\n`);
  for (const [i, line] of brief.lines.entries()) console.log(`  ${i + 1}. ${line.vo}`);
  console.log(`\nNext: npm run plan -- --episode=${id}`);
}

// Only when run as a command; the tests import the prompt and the checks.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
