/**
 * A SURFACE MUST NEVER BECOME A SEARCH.
 *
 * The failure this guards is not a crash, which is why it needed a test: three
 * episodes running asked a photo archive for "a plain grey laboratory wall",
 * "dark green water" and "rows of museum storage drawers", and got back a white
 * room, an aerial photograph of a lake and an antique console cabinet. Every one
 * of those downloads succeeded. Every one passed validation. Every one reached a
 * rendered frame, and the only place it showed was in the picture.
 *
 * So the checks here are about ROUTING — that a surface is drawn on this machine
 * and cannot be routed anywhere else — and about the drawing being a real image
 * of the right size with something actually in it.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {drawSurface, textureFor, SURFACE_TEXTURES} from '../scripts/lib/surface.mjs';
import {problemsWith} from '../scripts/write-episode.mjs';

const run = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, '');
const PLANNER = path.join(ROOT, 'scripts', 'plan-episode.mjs');

test('a surface layer is drawn here, never fetched — even when the brief listed searches', async () => {
  const shelf = await mkdtemp(path.join(os.tmpdir(), 'reel-surface-'));
  const dir = path.join(shelf, 'probe');
  try {
    await mkdir(dir, {recursive: true});
    const lines = [1, 2, 3, 4, 5, 6].map((i) => ({
      slug: `s${i}`,
      vo: 'A thing happened here today.',
      image: 'a wall',
      pieces: [],
      shot: {
        template: 'composite',
        signature: 'the room pushes in',
        camera: {from: 1, to: 1.3},
        props: [],
        layers: [
          {
            role: 'wall',
            asset: 'wall.jpg',
            kind: 'surface',
            depth: 0.1,
            // THE MISTAKE THIS EXISTS FOR. The author has the searches in hand
            // from the layer above and pastes them in; one query is all it
            // takes to put a cabinet where a blank wall belongs.
            commons: ['plain grey wall'],
            prompt: 'a plain grey wall, nothing on it',
            surface: 'plaster',
            colour: '#6e6f6a',
          },
        ],
      },
    }));
    await writeFile(
      path.join(dir, 'brief.json'),
      JSON.stringify({id: 'probe', title: 'p', mood: 'ash-grey', style: 's', lines}),
    );
    await run('node', [PLANNER, '--episode=probe'], {cwd: ROOT, env: {...process.env, EPISODES_DIR: shelf}});

    const recipes = JSON.parse(await readFile(path.join(dir, 'assets.json'), 'utf8'));
    const recipe = recipes.assets['wall.jpg'];
    assert.equal(recipe.kind, 'surface');
    assert.equal(recipe.commons, undefined, 'a surface must carry no Commons query');
    assert.equal(recipe.surface, 'plaster');
    assert.equal(recipe.colour, '#6e6f6a');
    // And the generator has to know how to make one without a provider.
    assert.equal(recipes.kinds.surface?.draw, 'surface');
  } finally {
    await rm(shelf, {recursive: true, force: true});
  }
});

test('the writer refuses a blank ground asked for as a photograph', () => {
  const brief = {
    id: 'p',
    title: 'p',
    mood: 'ash-grey',
    lines: [1, 2, 3, 4, 5, 6].map((i) => ({
      slug: `s${i}`,
      vo: 'A thing happened here today.',
      image: 'a wall',
      pieces: ['a wooden chair'],
      shot: {
        template: 'composite',
        signature: 'the room pushes in',
        camera: {from: 1, to: 1.3},
        props: [],
        layers: [{role: 'wall', asset: 'wall.jpg', kind: 'backdrop', prompt: 'a plain grey wall, nothing on it'}],
      },
    })),
  };
  const problems = problemsWith(brief).join('\n');
  assert.match(problems, /that is a surface, use "kind": "surface"/);

  // And the same brief with the kind corrected has nothing left to say about it.
  for (const line of brief.lines) line.shot.layers[0].kind = 'surface';
  assert.doesNotMatch(problemsWith(brief).join('\n'), /surface/);
});

test('a surface with searches on it is refused rather than quietly cleaned', () => {
  const brief = {
    id: 'p',
    title: 'p',
    mood: 'ash-grey',
    lines: [1, 2, 3, 4, 5, 6].map((i) => ({
      slug: `s${i}`,
      vo: 'A thing happened here today.',
      image: 'a wall',
      pieces: ['a wooden chair'],
      shot: {
        template: 'composite',
        signature: 'the room pushes in',
        camera: {from: 1, to: 1.3},
        props: [],
        layers: [{role: 'wall', asset: 'wall.jpg', kind: 'surface', commons: ['grey wall'], prompt: 'a plain wall'}],
      },
    })),
  };
  assert.match(problemsWith(brief).join('\n'), /is a surface AND has commons searches/);
});

test('the material is read out of the sentence the brief already wrote', () => {
  assert.equal(textureFor('dark green water over a rocky seabed'), 'water');
  assert.equal(textureFor('rows of wooden museum storage drawers'), 'drawers');
  assert.equal(textureFor('a plain grey laboratory wall, nothing on it'), 'plaster');
  assert.equal(textureFor('a dark museum interior wall, low even lighting'), 'dark');
  assert.equal(textureFor('a sheet of brushed steel'), 'metal');
  assert.equal(textureFor('the moon in a clear night sky'), 'sky');
  // Anything unrecognised is still a room, not a crash.
  assert.ok(SURFACE_TEXTURES.includes(textureFor('something nobody listed')));
});

test('every texture draws a real image at the size asked for, with detail in it', async () => {
  for (const texture of SURFACE_TEXTURES) {
    const png = await drawSurface({name: `${texture}.png`, width: 240, height: 426, texture});
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 240, texture);
    assert.equal(meta.height, 426, texture);

    /**
     * NOT A FLAT FIELD.
     *
     * A surface that comes out as one colour is a grey card, and a grey card
     * behind a plate is exactly the "empty video" this whole pipeline was
     * rebuilt to stop shipping. Standard deviation is the cheapest question
     * that tells a texture from a fill.
     */
    const {channels} = await sharp(png).stats();
    const spread = Math.max(...channels.map((c) => c.stdev));
    assert.ok(spread > 4, `${texture} is nearly flat (stdev ${spread.toFixed(1)})`);
  }
});

test('the same name draws the same surface, and a different name does not', async () => {
  const a = await drawSurface({name: 'wall.png', width: 120, height: 200, texture: 'plaster'});
  const b = await drawSurface({name: 'wall.png', width: 120, height: 200, texture: 'plaster'});
  const c = await drawSurface({name: 'other-wall.png', width: 120, height: 200, texture: 'plaster'});
  assert.ok(a.equals(b), 'a surface must be reproducible from its name alone');
  assert.ok(!a.equals(c), 'two different walls in one episode must not be the same picture');
});

test('the file name decides the format — a PNG written into a .jpg is a long fuse', async () => {
  const jpg = await drawSurface({name: 'wall.jpg', width: 120, height: 200, texture: 'wall', format: 'jpeg'});
  assert.equal((await sharp(jpg).metadata()).format, 'jpeg');
  const png = await drawSurface({name: 'wall.png', width: 120, height: 200, texture: 'wall'});
  assert.equal((await sharp(png).metadata()).format, 'png');
});
