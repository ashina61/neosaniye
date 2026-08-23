/**
 * THE DECISION LAYER.
 *
 * The engine can animate; these tests are about whether anything CHOSE. Each
 * one is a judgement the pipeline was not making, and most of them are a fault
 * that shipped: a sea slug standing in for a shipwreck, a verdict split across
 * two shots so the reel finished on the weaker half, eight pull-backs in ten.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  beatOfLine,
  endingStrategy,
  hookStrategy,
  readScript,
  rhythmFor,
  visualIdea,
  wantsHold,
} from '../scripts/lib/story.mjs';
import {
  assetBrief,
  colourAxis,
  combine,
  judge,
  technicalAxes,
} from '../scripts/lib/assetdirector.mjs';
import {directFraming, graphicJustified, hierarchyFor, labelFor} from '../scripts/lib/visual.mjs';
import {clampArrival, directCamera, directTransition, withinQuota} from '../scripts/lib/director.mjs';

function seeded(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── THE STORY BRAIN ───────────────────────────────────────────────────── */

test('a sentence is read as a beat, not as a length', () => {
  assert.equal(beatOfLine({vo: 'Sponge divers found a wreck.'}, 1, 6), 'DISCOVERY');
  assert.equal(beatOfLine({vo: 'It predicted eclipses.'}, 3, 6), 'PAYOFF');
  assert.equal(beatOfLine({vo: 'Nothing this complex was built again.'}, 5, 6), 'VERDICT');
});

test('a reveal outranks a discovery — an x-ray does not find, it opens', () => {
  // "X-rays found thirty gears" contains "found", and a discovery rule reading
  // first calls it one. Nobody discovered anything: an instrument looked inside
  // something already on the table.
  assert.equal(beatOfLine({vo: 'X-rays found thirty gears, cut by hand.'}, 3, 6), 'REVEAL');
});

test('the brief may name the beat, and it wins', () => {
  assert.equal(beatOfLine({vo: 'Anything at all.', beat: 'mystery'}, 2, 6), 'MYSTERY');
});

test('the ends of a reel are structural', () => {
  assert.equal(beatOfLine({vo: 'A wall stood there.'}, 0, 6), 'HOOK');
  assert.equal(beatOfLine({vo: 'A wall stood there.'}, 5, 6), 'VERDICT');
});

test('every beat carries a visual intention, so an asset has something to be wrong about', () => {
  const idea = visualIdea({vo: 'X-rays found thirty gears.'}, 'REVEAL');
  assert.match(idea, /gear/);
  assert.ok(idea.length > 20, 'an intention is a sentence, not a noun');
});

test('a closing beat asks for air and a hook never does', () => {
  assert.equal(wantsHold('VERDICT'), true);
  assert.equal(wantsHold('HOOK'), false);
});

test('rhythm leans early on a fast beat and late on a slow one', () => {
  const fast = rhythmFor('HOOK', 3);
  const slow = rhythmFor('VERDICT', 3);
  assert.ok(fast[0] > fast[2], 'a hook front-loads');
  assert.ok(slow[2] > slow[0], 'a verdict is allowed to arrive');
  for (const set of [fast, slow]) {
    assert.ok(Math.abs(set.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'weights must sum to one');
  }
});

test('the hook and the ending are stated as strategies, not left to position', () => {
  const read = readScript([{vo: 'Divers found a wreck.'}, {vo: 'Nothing like it was built for centuries.'}]);
  assert.match(hookStrategy(read).demands, /strongest/);
  assert.match(endingStrategy(read).demands, /hold/);
});

/* ── THE ASSET DIRECTOR ────────────────────────────────────────────────── */

const wellShot = {
  width: 1080,
  height: 1920,
  shortEdge: 1080,
  aspect: 0.5625,
  keptInCrop: 1,
  brightness: 0.44,
  contrast: 0.4,
  colourfulness: 0.12,
  hasAlpha: false,
};

test('the technical axes reward a plate that suits its role', () => {
  const axes = technicalAxes(wellShot, 'backdrop');
  assert.ok(axes.resolution >= 9 && axes.exposure >= 9 && axes.composition >= 9);
});

test('a blown-out plate fails on exposure however sharp it is', () => {
  // The white sweep of a catalogue photograph: perfectly exposed for a catalogue and
  // a hole in the middle of a dark reel.
  const axes = technicalAxes({...wellShot, brightness: 0.83}, 'backdrop');
  assert.ok(axes.exposure < 3, `exposure ${axes.exposure}`);
});

test('a landscape file loses most of itself to a 9:16 crop, and that is composition', () => {
  const wide = technicalAxes({...wellShot, keptInCrop: 0.33}, 'backdrop');
  assert.ok(wide.composition < 5, `composition ${wide.composition}`);
});

test('SEMANTICS GATE THE SCORE — a beautiful photograph of the wrong thing is not a 7', () => {
  const perfect = technicalAxes(wellShot, 'backdrop');
  const wrongThing = combine({relevance: 2, accuracy: 1, subject: 2, technical: perfect, colour: 10});
  assert.ok(wrongThing <= 2, `a wrong picture scored ${wrongThing} on a full technical pass`);
});

test('a right picture is not sunk by a middling technical half', () => {
  const rough = technicalAxes({...wellShot, contrast: 0.22, shortEdge: 900}, 'backdrop');
  assert.ok(combine({relevance: 9, accuracy: 9, subject: 9, technical: rough, colour: 6}) >= 7);
});

test('an unreviewed asset is reported as unknown, never as approved', () => {
  const verdict = judge({file: 'x.png', role: 'background', measured: wellShot});
  assert.equal(verdict.reviewed, false);
  assert.ok(verdict.axes.relevance < 7, 'unreviewed must not score as good');
});

test('a refused asset comes with a brief, not just a complaint', () => {
  const verdict = judge({
    file: 'sideboard.jpg',
    role: 'drawers',
    measured: wellShot,
    reviewed: {depicts: 'a Victorian sideboard', relevance: 2, accuracy: 1, subject: 2, needed: 'a museum drawer front'},
    idea: 'the drawer as a specimen',
  });
  assert.equal(verdict.verdict, 'reject');
  assert.equal(verdict.brief.subject, 'a museum drawer front');
  assert.ok(verdict.brief.required.length >= 3);
});

test('a casting note outranks a passing score', () => {
  // The encrusted wreck find scored well as a wall and was still in the wrong
  // place: it was standing in as an empty backdrop while a brick texture played
  // the subject in front of it.
  const verdict = judge({
    file: 'find.jpg',
    role: 'case',
    measured: wellShot,
    reviewed: {depicts: 'an encrusted wreck find', relevance: 9, accuracy: 8, subject: 9, recastAs: 'fragment'},
  });
  assert.ok(verdict.score >= 7);
  assert.equal(verdict.verdict, 'recast');
});

test('a recast picture is scored for the role it is going to', () => {
  const verdict = judge({
    file: 'bronze.jpg',
    role: 'wall',
    measured: wellShot,
    reviewed: {
      relevance: 2,
      accuracy: 2,
      subject: 2,
      recastTo: {line: 'wreck', role: 'bronze', relevance: 8, accuracy: 7, subject: 8},
    },
  });
  assert.ok(verdict.score >= 6, `a rescued picture still scored ${verdict.score} for the role it was rescued from`);
});

test('colour compatibility is measured against the reel, not against a constant', () => {
  const dark = colourAxis({brightness: 0.12, colourfulness: 0.1}, {brightness: 0.15, colourfulness: 0.1});
  const bright = colourAxis({brightness: 0.85, colourfulness: 0.1}, {brightness: 0.15, colourfulness: 0.1});
  assert.ok(dark > bright + 3, 'a plate matching the reel must beat one that does not');
});

test('an asset brief says what to avoid as well as what to get', () => {
  const brief = assetBrief({role: 'drawers', idea: 'a museum drawer', notice: 'the label slot'});
  assert.ok(brief.avoid.length >= 3);
  assert.match(brief.composition, /%/);
});

/* ── THE VISUAL DIRECTOR ───────────────────────────────────────────────── */

test('a shot with no photograph is a typographic shot, not a broken one', () => {
  const h = hierarchyFor({beat: 'VERDICT', hasPhoto: false, emphasis: 'fourteen hundred years'});
  assert.equal(h.carrier, 'type');
  assert.match(h.primary, /fourteen hundred/);
  assert.match(h.background, /drawn/);
});

test('every shot names one primary element', () => {
  for (const beat of ['HOOK', 'REVEAL', 'EVIDENCE', 'CONTEXT', 'VERDICT']) {
    const h = hierarchyFor({beat, hasPhoto: true, emphasis: 'x'});
    assert.ok(h.primary && h.secondary && h.background, `${beat} left the hierarchy unstated`);
    assert.notEqual(h.primary, h.secondary);
  }
});

test('framing varies under a quota instead of defaulting to centre', () => {
  const rand = seeded('framing');
  const used = {};
  const seen = new Set();
  for (let i = 0; i < 10; i += 1) {
    const f = directFraming({beat: 'CONTEXT', rand, used, total: 10});
    used[f.name] = (used[f.name] ?? 0) + 1;
    seen.add(f.name);
  }
  assert.ok(seen.size >= 2, 'ten shots came back as one framing');
});

test('a label carries apparatus a voice cannot — a date range, a place', () => {
  assert.equal(labelFor({vo: 'It sat there from 1901 until 1951.'}), '1901–1951');
  assert.equal(labelFor({vo: 'A wreck was found.', place: 'Antikythera'}), 'Antikythera');
});

test('a graphic must do one of the eight jobs or it does not appear', () => {
  assert.equal(graphicJustified('wire', {hasSubject: true}), 'highlight');
  assert.equal(graphicJustified('wire', {hasSubject: false}), null, 'a circle round nothing encloses nothing');
  assert.equal(graphicJustified('beam', {hasSubject: true}), null, 'pure atmosphere proves nothing');
});

/* ── CAMERA AND TRANSITION QUOTAS ──────────────────────────────────────── */

test('no camera family may carry the reel', () => {
  const rand = seeded('quota');
  const used = {};
  for (let i = 0; i < 12; i += 1) {
    const move = directCamera({beat: 'REVEAL', rand, durationInFrames: 90, used, total: 12, share: 0.3});
    used[move.kind] = (used[move.kind] ?? 0) + 1;
  }
  const worst = Math.max(...Object.values(used));
  assert.ok(worst <= 6, `one move took ${worst} of 12 shots: ${JSON.stringify(used)}`);
});

test('when a beat runs out of preferences the pool widens instead of repeating', () => {
  const rand = seeded('widen');
  const used = {push: 9, tilt: 9, hold: 9};
  const move = directCamera({beat: 'REVEAL', rand, durationInFrames: 120, used, total: 10, share: 0.3});
  assert.ok(['pull', 'pan', 'drift'].includes(move.kind), `fell back to ${move.kind}`);
});

test('two shots of one picture never repeat the move, and never hold', () => {
  const rand = seeded('reframe');
  for (let i = 0; i < 30; i += 1) {
    const move = directCamera({
      beat: 'DETAIL',
      rand,
      durationInFrames: 80,
      reframeFrom: 'push',
      sameSubject: true,
      total: 10,
    });
    assert.notEqual(move.kind, 'push');
    assert.notEqual(move.kind, 'hold', 'a locked-off frame on the same plate shows nothing new');
  }
});

test('every camera move states its purpose', () => {
  const rand = seeded('purpose');
  const move = directCamera({beat: 'HOOK', rand, durationInFrames: 90, total: 10});
  assert.ok(move.purpose && move.purpose.length > 10);
});

test('a short shot never arrives blank or blurred', () => {
  const rand = seeded('short');
  for (let i = 0; i < 40; i += 1) {
    const arrival = directTransition({beat: 'REVEAL', rand, durationInFrames: 45, total: 10});
    assert.ok(!['blinds', 'flare', 'rack'].includes(arrival.kind), `${arrival.kind} on a 1.5s shot`);
  }
});

test('transition overflow goes to a hard cut, not back into the pool', () => {
  const rand = seeded('overflow');
  const used = {slam: 99, flare: 99};
  const arrival = directTransition({beat: 'VERDICT', rand, durationInFrames: 120, used, total: 10});
  assert.equal(arrival.kind, 'cut');
});

test('an arrival may not eat the shot, even one the brief asked for by name', () => {
  // A rack written when the shot was four and a half seconds, applied to one
  // that is now one point nine.
  assert.ok(clampArrival('rack', 11, 58) <= 5, 'a blanking arrival on a short shot must be cut back');
  assert.ok(clampArrival('slip', 40, 60) <= 8, 'no arrival may take more than about an eighth of a shot');
  assert.equal(clampArrival('cut', 0, 60), 0);
});

test('a quota that is fully spent falls to the least-used option', () => {
  assert.deepEqual(withinQuota(['a', 'b'], {a: 9, b: 3}, 4, 0.3), ['b']);
});
