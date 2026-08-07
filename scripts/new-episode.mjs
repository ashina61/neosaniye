#!/usr/bin/env node
/**
 * A NEW EPISODE IS A FOLDER. This writes the folder.
 *
 * The repo's one law is that adding an episode is not a code change, and this
 * is the last place that was still not quite true: the folder had to be built
 * by hand, from memory, by reading another episode's brief and copying its
 * shape. That is a code change wearing a different hat — the shape lived in
 * somebody's head instead of in the tool.
 *
 * So: one command, one folder, and a brief that already carries the rules that
 * cost this repo the most to learn. The template is the argument.
 *
 *   npm run new -- --id=hatshepsut --title="The pharaoh they tried to erase"
 *
 * Then WRITE THE SIX LINES. That is the only part a person should be doing —
 * the voiceover, and one phrase per line saying what we are looking at.
 * Everything after it is derived: the shot type, the length, the cuts, the
 * look, the artwork recipes.
 */
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

/**
 * The moods a look is generated INSIDE. Not palettes — bounds. Two episodes in
 * the same mood are cousins; two moods are strangers.
 */
const MOODS = ['gold-heat', 'cold-noir', 'green-rot', 'ash-grey'];

/**
 * THE TEMPLATE IS THE ARGUMENT.
 *
 * Every field here is a rule this repo paid for. The six lines are six because
 * the reference reel is six scenes in thirty seconds and its whole script is
 * seventy-seven words; the draft that came before it was nine lines and a
 * hundred and eighty-four, which is sixty-eight seconds of narration and the
 * reason every cut felt slow and every shot felt empty.
 */
const brief = (id, title, mood) => ({
  id,
  title,
  mood,
  style:
    'documentary photograph, period-accurate, available light, muted colour, fine grain, ' +
    'no text, no watermark, no modern objects',
  $note:
    'SIX LINES, ~80 WORDS, THIRTY SECONDS. A line that will not fit in fifteen words is two lines or it is cut. ' +
    'EVERY LINE NAMES A REAL THING: imageCommons carries a search for something that exists and is photographed, ' +
    'and the prompt only draws the nameless scenery — an empty dune, a foggy corner. ' +
    'The voiceover is the storyboard: the planner reads it for the SHOT (a number becomes a slate, a list becomes ' +
    'paper landing, an artefact becomes a push into it), for the LENGTH, and for the MOTIF that acts out its verb.',
  lines: [
    {
      slug: 'open',
      vo: 'The first line. Say the hook in under fifteen words.',
      image: 'what we are looking at, for the generator to draw if Commons has nothing',
      imageCommons: ['the real thing, most specific first', 'a broader search as a fallback'],
      kicker: 'PLACE · YEAR',
      title: 'THE HOOK',
      footer: 'the line under it',
    },
    {
      slug: 'route',
      vo: 'A line about a journey becomes a map with the places on it.',
      image: 'an old chart on vellum, faded ink',
      imageCommons: ['a real historical map of the region'],
      $hint: 'stops[] turns this into an itinerary drawing itself, stop by named stop',
      stops: ['First place', 'Second place', 'Third place'],
    },
    {
      slug: 'place',
      vo: 'A line naming things to put in the frame becomes a frame to put them in.',
      image: 'a wide empty landscape, no people',
      imageCommons: ['the real place'],
      $hint: 'pieces[] are cut-outs and OPTIONAL — a piece that fails to draw costs depth, never the reel',
      pieces: ['one object in profile', 'a tree'],
      onScreen: 'A SHORT CARD',
    },
    {
      slug: 'artefact',
      vo: 'A line about one object becomes a flight into a photograph of it.',
      image: 'the wall it hangs on',
      imageCommons: ['the room or the wall'],
      artefact: 'a close view of the object itself',
      artefactCommons: ['the object, by its real name'],
      caption: ['Two or three', 'fragments that', 'land one at a time.'],
    },
    {
      slug: 'turn',
      vo: 'The line where it goes wrong, or where the money arrives.',
      image: 'a street, a room, a horizon',
      imageCommons: ['the real place'],
      $hint: 'motif plays the VERB: coins, rise, route, embers, rays, tally. Or "none" to leave the shot alone.',
      motif: 'coins',
    },
    {
      slug: 'close',
      vo: 'The last line. A number worth saying is worth counting to.',
      image: 'something emptying out — footprints, an empty room',
      imageCommons: ['the real place'],
      kicker: 'PLACE · YEAR',
      title: 'TWELVE YEARS',
      footer: 'the verdict, quietly',
    },
  ],
});

async function main() {
  const args = parseArgs();
  const id = typeof args.id === 'string' ? args.id.trim() : '';
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    console.error('Usage: npm run new -- --id=<episode-id> [--title="…"] [--mood=gold-heat]');
    console.error('  The id is a folder name: lowercase, digits and hyphens.');
    process.exit(1);
  }

  const mood = typeof args.mood === 'string' ? args.mood : MOODS[0];
  if (!MOODS.includes(mood)) {
    console.error(`✗ mood "${mood}" is not one of ${MOODS.join(', ')}`);
    process.exit(1);
  }

  const dir = episodeDir(id);
  if (await exists(dir)) {
    // Never overwrite: a brief is hand-written, and it is the only part of an
    // episode that cannot be regenerated from anything else.
    console.error(`✗ ${path.relative(ROOT, dir)} already exists — nothing was changed.`);
    process.exit(1);
  }

  const title = typeof args.title === 'string' ? args.title : id.replace(/-/g, ' ');
  await mkdir(path.join(dir, 'assets'), {recursive: true});
  await writeFile(path.join(dir, 'brief.json'), `${JSON.stringify(brief(id, title, mood), null, 2)}\n`, 'utf8');

  console.log(`✓ ${path.relative(ROOT, dir)}/brief.json — mood ${mood}`);

  /**
   * A SCAFFOLDED EPISODE IS VALID FROM ITS FIRST SECOND.
   *
   * Writing only the brief left `npm test` red — the suite validates every
   * episode in the repo, and one with no scene-config and no artwork fails it.
   * So you would scaffold, push, and watch CI go red before you had written a
   * word. Planning the template and standing in for its artwork costs two
   * seconds and means the folder is a working episode you then REWRITE, rather
   * than a hole you have to fill before anything runs.
   */
  await run('scripts/plan-episode.mjs', id);
  await run('scripts/make-placeholder-assets.mjs', id);

  console.log('\nNow write the six lines. That is the only part a person should be doing:');
  console.log('  the voiceover, and one phrase per line saying what we are looking at.');
  console.log('  Everything after it is derived — the shot type, the length, the cuts, the look.\n');
  console.log('Then:');
  console.log(`  npm run plan   -- --episode=${id}      # re-derive from YOUR lines`);
  console.log(`  npm run frames -- --episode=${id}      # look at it, grey boxes and all`);
  console.log(`\nOr run the "Reel" workflow with episode_id=${id}: it voices, draws and renders.`);
}

/** The scaffold runs the real scripts rather than reimplementing them. */
function run(script, id) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), `--episode=${id}`], {stdio: 'inherit'});
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
