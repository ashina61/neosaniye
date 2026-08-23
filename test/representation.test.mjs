/**
 * THE REPRESENTATION LAYER — can it show a place, a process, a body, the
 * inside of a material, and how big something is?
 *
 * The generalisation benchmark answered no: forty-one of forty-five lines fell
 * to typography because the library had five diagram types tuned to one
 * episode. These tests are the answer to that, and they are written the way the
 * failure was found — by asking a SENTENCE what it needs, never by naming an
 * episode.
 *
 * The negative half matters more than the positive half. The worst thing this
 * engine ever drew was a train of meshing gears presented as a schematic
 * reconstruction of a human heart: correct geometry, correct mesh, correct
 * disclosure plate, and a lie. Nothing caught it, because the hard semantic
 * gate guarded photographs only.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  NEEDS_A_PICTURE,
  SERVES,
  SUBJECT_DOMAIN,
  readSubject,
  representationProblems,
  semanticCheck,
} from '../scripts/lib/semantics.mjs';
import {bestDrawing, chooseRepresentation} from '../scripts/lib/representation.mjs';
import {buildAnatomyFlow, buildCrossSection, buildMap, buildProcess, buildScaleHaulage} from '../scripts/lib/visualise.mjs';

const draw = (vo, extra = {}) =>
  chooseRepresentation({vo, seed: `t:${vo.slice(0, 12)}`, accent: '#c8d94a', muted: '#cfc6ae', ...extra});

const reel = (scenes) => ({fps: 30, width: 1080, height: 1920, scenes});

/* ── THE FIVE QUESTIONS THE BENCHMARK ASKED ────────────────────────────── */

test('can it show GEOGRAPHY?', () => {
  const r = draw('At its narrowest the Strait of Hormuz is twenty-one miles across.');
  assert.equal(r.diagram?.type, 'map');
  assert.ok(r.diagram.regions.length >= 2, 'a strait needs two sides and the water between them');
  assert.ok(r.diagram.distance, 'a line that states a width should draw the width');
  assert.match(String(r.diagram.distance.label), /21/);
});

test('can it show a PROCESS?', () => {
  const r = draw('The smith heated it, hammered it, folded it, and quenched the blade in oil.');
  assert.equal(r.diagram?.type, 'process');
  assert.ok(r.diagram.stages.length >= 4, `only ${r.diagram.stages.length} stages`);
  const agents = r.diagram.stages.map((s) => s.agent).filter((a) => a && a !== 'none');
  assert.deepEqual(agents, ['heat', 'strike', 'fold', 'quench'], 'the verbs, in the order the sentence says them');
});

test('can it show ANATOMY?', () => {
  const r = draw('Four chambers, four valves, and every valve opens in a single direction.');
  assert.equal(r.diagram?.type, 'anatomyFlow');
  assert.equal(r.diagram.chambers.length, 4);
  assert.ok(r.diagram.valves.length >= 1);
  assert.ok(r.diagram.vessels.length >= 2);
});

test('can it show an INTERNAL MECHANISM?', () => {
  const r = draw('When a crack opens, water reaches a lump of lime, which recrystallises and seals it shut.');
  assert.equal(r.diagram?.type, 'crossSection');
  assert.ok(r.diagram.crack, 'the crack is the event');
  assert.ok(r.diagram.fluid, 'the water has to arrive');
  assert.ok(r.diagram.growth, 'and the gap has to actually close');
});

test('can it show SCALE?', () => {
  const r = draw('Each block weighs about eight hundred tons and was rolled on hardwood.');
  assert.equal(r.diagram?.type, 'scaleHaulage');
  assert.ok(r.diagram.humanHeight > 0, 'scale needs a human to be scale');
  assert.ok(r.diagram.rollers > 0, 'the sentence says rolled');
  assert.equal(r.diagram.figure.value, 800);
});

/* ── CAUSALITY AND OBJECT IDENTITY ─────────────────────────────────────── */

test('a process is ONE object changing, not four illustrations', () => {
  const r = draw('It was forged, then folded, then quenched.');
  const counts = new Set(r.diagram.stages.map((s) => s.shape.length));
  assert.equal(counts.size, 1, 'every stage must have the same point count or the object cannot tween');
  // And it must actually change: identical stages would be a still.
  const first = JSON.stringify(r.diagram.stages[0].shape);
  assert.ok(r.diagram.stages.some((s) => JSON.stringify(s.shape) !== first), 'the object never changed');
});

test('every transformation states what caused it', () => {
  const r = draw('The smith heated it, hammered it, and quenched the blade.');
  for (const stage of r.diagram.stages.slice(1)) {
    assert.ok(stage.agent && stage.agent !== 'none', `stage "${stage.label}" has no cause`);
    assert.ok(stage.effect, `stage "${stage.label}" states no effect`);
  }
});

test('a circulation closes on itself', () => {
  const spec = buildAnatomyFlow({vo: 'blood moves through four chambers', accent: '#a', muted: '#b', claims: ['circulation']});
  // Every leg of the circuit must name a vessel that exists, and the last must
  // lead back toward the first: a loop that ends somewhere is not circulation.
  for (const leg of spec.circuit) assert.ok(spec.vessels[leg], `circuit names vessel ${leg}, which does not exist`);
  const first = spec.vessels[spec.circuit[0]].path[0];
  const last = spec.vessels[spec.circuit[spec.circuit.length - 1]].path.slice(-1)[0];
  assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.35, 'the circuit does not return to where it started');
});

test('a section runs its events in causal order', () => {
  const spec = buildCrossSection({
    vo: 'a crack opens, water enters, the lime reacts and seals it',
    seed: 's',
    accent: '#a',
    muted: '#b',
    claims: ['crack_propagation', 'fluid_ingress', 'reaction', 'self_healing'],
  });
  assert.ok(spec.fluid.at > spec.crack.opensAt, 'water cannot arrive before the crack it runs down');
  assert.ok(spec.growth.at > spec.fluid.at, 'the repair cannot precede the water that starts it');
  assert.ok(spec.crack.healsAt >= spec.growth.at - 4, 'the crack closes as the mineral grows, not before');
});

/* ── THE REQUIRED SEMANTIC REJECTIONS ──────────────────────────────────── */

test('humanHeart → gearSystem = FAIL', () => {
  const check = semanticCheck({type: 'gearSystem', subject: 'humanHeart', domains: ['anatomy'], claims: ['chambers']});
  assert.equal(check.ok, false);
  assert.match(check.why, /anatomy/);
  // And the config-level gate refuses it too, from the declared subject alone.
  const {errors} = representationProblems(
    reel([
      {
        id: 'heart',
        sceneType: 'composite',
        durationInFrames: 90,
        voText: 'four chambers and four valves',
        diagram: {type: 'gearSystem', count: 4, subject: 'humanHeart', depicts: 'anatomy'},
        params: {},
      },
    ]),
  );
  assert.ok(errors.length >= 1, 'a gear train claiming to be a heart must not pass validation');
  assert.match(errors.join(' '), /humanHeart/);
});

test('swordMaking → timeline only = FAIL', () => {
  const check = semanticCheck({type: 'timeline', subject: 'swordMaking', domains: ['process'], claims: ['sequence']});
  assert.equal(check.ok, false, 'a row of dates is not a picture of a forging');
  const {errors} = representationProblems(
    reel([
      {
        id: 'sword',
        sceneType: 'composite',
        durationInFrames: 90,
        voText: 'hammer, fold, hammer again',
        diagram: {type: 'timeline', events: [], subject: 'swordMaking', depicts: 'process'},
        params: {},
      },
    ]),
  );
  assert.ok(errors.length >= 1);
});

test('a strait → typography only = FAIL', () => {
  const check = semanticCheck({type: 'typography', subject: 'strait', domains: ['geography'], claims: ['narrowness']});
  assert.equal(check.ok, false, 'words are not a picture of a place');
  assert.ok(NEEDS_A_PICTURE.includes('geography'));
  // And a geography line with nothing drawn is reported, not passed over.
  const {warnings} = representationProblems(
    reel([
      {
        id: 'strait',
        sceneType: 'composite',
        durationInFrames: 90,
        voText: 'the strait is twenty-one miles across between two shores',
        params: {caption: ['twenty-one miles']},
      },
    ]),
  );
  assert.ok(warnings.some((m) => m.includes('REPRESENTATION_REQUIRED')), warnings.join(' | '));
});

test('romanConcrete → a generic texture = FAIL', () => {
  // "Generic texture" is a photograph with no semantic claim behind it. The
  // material domain is not served by a wall picture that shows no mechanism.
  const check = semanticCheck({type: 'orbit', subject: 'romanConcrete', domains: ['material'], claims: ['self_healing']});
  assert.equal(check.ok, false);
  const {errors} = representationProblems(
    reel([
      {
        id: 'wall',
        sceneType: 'composite',
        durationInFrames: 90,
        voText: 'the lime recrystallises across the crack and seals it',
        diagram: {type: 'orbit', cx: 0.5, cy: 0.4, radius: 0.2, subject: 'romanConcrete', depicts: 'material'},
        params: {},
      },
    ]),
  );
  assert.ok(errors.length >= 1, 'a ring drawn over a concrete claim must not pass');
});

test('a megalith → a number alone = FAIL', () => {
  const check = semanticCheck({type: 'typography', subject: 'megalith', domains: ['scale'], claims: ['mass', 'haulage']});
  assert.equal(check.ok, false, 'a figure on a card is not a picture of how big something is');
  assert.ok(NEEDS_A_PICTURE.includes('scale'));
});

/* ── THE GATE'S OWN SHAPE ──────────────────────────────────────────────── */

test('typography may still carry a claim, a number or a date', () => {
  for (const domain of ['abstract', 'quantity', 'elapsed']) {
    assert.equal(semanticCheck({type: 'typography', domains: [domain]}).ok, true, domain);
  }
});

test('typography may NOT carry a place, a process, a body, a mechanism or a size', () => {
  for (const domain of NEEDS_A_PICTURE) {
    assert.equal(semanticCheck({type: 'typography', domains: [domain]}).ok, false, `typography took ${domain}`);
  }
});

test('every subject the classifier can name has a domain, and every domain a drawing', () => {
  for (const [subject, domain] of Object.entries(SUBJECT_DOMAIN)) {
    const servers = Object.entries(SERVES).filter(([type, d]) => type !== 'photo' && type !== 'typography' && d.includes(domain));
    assert.ok(servers.length, `nothing can draw ${domain} (${subject})`);
  }
});

test('a drawing that declares a domain it cannot depict is refused', () => {
  const {errors} = representationProblems(
    reel([
      {
        id: 'x',
        sceneType: 'composite',
        durationInFrames: 60,
        voText: 'a line',
        diagram: {type: 'map', depicts: 'anatomy'},
        params: {},
      },
    ]),
  );
  assert.ok(errors.some((m) => m.includes('cannot depict')), errors.join(' | '));
});

/* ── SELECTION IS SEMANTIC, NOT BY EPISODE ─────────────────────────────── */

test('the same claim in a different subject gets the same drawing', () => {
  // Nothing in the selector may key on the topic. Two unrelated sentences that
  // make the same KIND of claim must resolve to the same representation.
  const a = draw('At its narrowest the channel is nine miles across between two shores.');
  const b = draw('At its narrowest the pass is two miles across between the northern and southern ridges.');
  assert.equal(a.diagram?.type, 'map');
  assert.equal(b.diagram?.type, 'map');
});

test('a subject never seen before still gets a drawing', () => {
  // Glass-making is in no table anywhere in this repo.
  const r = draw('The batch is heated, then blown, then cooled slowly for a week.');
  assert.equal(r.diagram?.type, 'process');
  assert.ok(r.diagram.stages.length >= 3);
});

test('the classifier reads the sentence, not the topic', () => {
  assert.equal(readSubject('the heart has four chambers').domain, 'anatomy');
  assert.equal(readSubject('the strait is narrow').domain, 'geography');
  assert.equal(readSubject('he hammered and folded the steel').domain, 'process');
  assert.equal(readSubject('the crack lets water into the lime').domain, 'material');
  assert.equal(readSubject('the block weighs eight hundred tons').domain, 'scale');
});

test('bestDrawing prefers the drawing built for the job over one that merely covers it', () => {
  // A section serves process as a secondary domain; on a forging line the
  // process builder must win, or a blade gets a cross-section instead of being
  // made.
  const ranked = bestDrawing({domain: 'process', domains: ['process', 'material'], claims: ['transformation', 'sequence']});
  assert.equal(ranked[0].type, 'process', ranked.map((r) => `${r.type}:${r.score}`).join(' '));
});

/* ── HONESTY ───────────────────────────────────────────────────────────── */

test('every drawn spec carries a subject and its claims', () => {
  for (const vo of [
    'the strait is twenty-one miles across between two shores',
    'he heated and folded the steel',
    'four chambers and four valves',
    'the crack lets water reach the lime, which seals it',
    'the block weighs eight hundred tons and was rolled',
  ]) {
    const r = draw(vo);
    assert.ok(r.diagram, vo);
    assert.ok(r.diagram.subject, `no subject declared for "${vo}"`);
    assert.ok(Array.isArray(r.diagram.claims), `no claims declared for "${vo}"`);
    assert.ok(r.diagram.depicts, `no domain declared for "${vo}"`);
  }
});

test('an uncertain reconstruction says so rather than claiming to be schematic', () => {
  const spec = buildScaleHaulage({vo: 'the block was rolled on hardwood rollers', accent: '#a', muted: '#b', claims: ['haulage']});
  // The component's default plate is the weaker claim; the builder must not
  // override it with a stronger one.
  assert.equal(spec.disclosure, undefined, 'the builder must leave the illustrative plate in place');
});

test('a map never implies survey precision it does not have', () => {
  const spec = buildMap({vo: 'twenty-one miles across', seed: 's', accent: '#a', muted: '#b', claims: ['narrowness']});
  assert.equal(spec.disclosure, undefined, 'the schematic plate is the component default and must stand');
  // Coastlines are generated, so two different seeds give different coasts —
  // which is the visible proof that no real outline is being claimed.
  const other = buildMap({vo: 'twenty-one miles across', seed: 'different', accent: '#a', muted: '#b', claims: ['narrowness']});
  assert.notDeepEqual(spec.regions[0].shape, other.regions[0].shape);
});

test('a process builder refuses a sentence with no transformation in it', () => {
  assert.equal(buildProcess({vo: 'the sword was expensive and rare', accent: '#a', muted: '#b'}), null);
});
