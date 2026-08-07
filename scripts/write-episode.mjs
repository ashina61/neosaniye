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

EACH LINE OBJECT:

  "slug"          one lowercase word, unique, used in file names
  "vo"            the spoken line
  "image"         one phrase: what we are LOOKING at. Scenery, no people named.
  "imageCommons"  1-3 Wikimedia Commons searches for something that REALLY
                  EXISTS and is photographed — a named place, building, map or
                  artefact. Most specific first, broader as fallback. Omit only
                  if the shot is genuinely nameless scenery.

OPTIONAL, and only where the line earns it — an unused one is better than a
wrong one:

  "kicker","title","footer"   for a line that STATES something. The title is set
                              large; make it two or three words, or a number.
  "artefact" + "artefactCommons"
                              for a line about ONE object. Becomes a flight into
                              a photograph of it.
  "stops"                     3-5 real place names, for a line about a journey.
                              Draws an itinerary, stop by named stop.
  "pieces"                    2-3 single objects to stand in the frame, each
                              phrased as one thing: "camel standing in profile".
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
  if (brief.lines.length !== 6) problems.push(`${brief.lines.length} lines, must be exactly 6`);

  const words = brief.lines.reduce((total, l) => total + String(l?.vo ?? '').trim().split(/\s+/).filter(Boolean).length, 0);
  // 92, not 100. The per-line cap is fifteen, so six lines all sitting at it
  // comes to ninety — a total ceiling above that catches nothing, and the whole
  // point of a ceiling is to catch a script that is short line by line and long
  // end to end. Ninety-two words is about thirty-four seconds.
  if (words > 92) problems.push(`${words} words — thirty seconds of narration is about 80`);

  const slugs = new Set();
  for (const [i, line] of brief.lines.entries()) {
    const vo = String(line?.vo ?? '').trim();
    const n = vo.split(/\s+/).filter(Boolean).length;
    if (!vo) problems.push(`line ${i + 1}: no vo`);
    else if (n > 17) problems.push(`line ${i + 1}: ${n} words — over fifteen means it is two lines`);
    if (!line?.slug) problems.push(`line ${i + 1}: no slug`);
    else if (slugs.has(line.slug)) problems.push(`line ${i + 1}: slug "${line.slug}" is used twice`);
    else slugs.add(line.slug);
    if (!line?.image) problems.push(`line ${i + 1}: no image — say what we are looking at`);
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
  const prompt = promptFor(topic, id, mood);

  const reply = await ask(prompt);
  if (!reply) {
    // NO KEY IS NOT A DEAD END. The writer does not have to be an API — the
    // reference build's whole method is pasting a prompt into an assistant and
    // pasting the answer back. Put the prompt where it can be picked up.
    const file = path.join(dir, 'PROMPT.md');
    await writeFile(file, `${prompt}\n`, 'utf8');
    console.log(`No ANTHROPIC_API_KEY or OPENAI_API_KEY — the prompt is written instead.\n`);
    console.log(`  ${path.relative(ROOT, file)}\n`);
    console.log('Paste it to any assistant, save the JSON it returns as:');
    console.log(`  ${path.relative(ROOT, path.join(dir, 'brief.json'))}\n`);
    console.log(`Then: npm run plan -- --episode=${id}`);
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
  await writeFile(file, `${JSON.stringify({...brief, id, mood}, null, 2)}\n`, 'utf8');

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
