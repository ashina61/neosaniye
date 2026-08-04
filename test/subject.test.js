import test from 'node:test';
import assert from 'node:assert/strict';
import {readSubject, SET_IDS, MOTIF_IDS, ATMOSPHERE_IDS} from '../src/story/subject.js';
import {buildReelSpec} from '../src/video/buildReelSpec.js';

const reel = (topic, lines) =>
  buildReelSpec({
    script: {topic, title: topic, scenes: lines.map((narration) => ({narration}))},
    audio: {duration: lines.length * 4},
    timeline: {
      source: 'edge-tts',
      duration: lines.length * 4,
      words: [],
      scenes: lines.map((narration, index) => ({scene: index, start: index * 4, end: index * 4 + 4, duration: 4, narration})),
    },
  });

const WHALE = [
  'In 1820 a whaling ship left port hunting the deep ocean.',
  'The captain refused to turn back when the crew warned him.',
  'So the whale struck the hull. No warning. No escape. Water first.',
  'The ship sank and twenty sailors drowned in the storm.',
  'Today that voyage earns millions as a printed legend.',
  'This was the most expensive hunt in history.',
];

const ROCKET = [
  'In 1969 a laboratory built a rocket for a mission to the moon.',
  'The committee laughed at the engineer who warned about the fuel.',
  'So they built the opposite. No tests. No delays. Speed first.',
  'The engine exploded on the pad and the programme collapsed in fire.',
  'Today that patent earns billions in every satellite in orbit.',
  'This was the most expensive no in history.',
];

test('iki farklı konu aynı çizimleri paylaşmaz', () => {
  const whale = reel('The whale that sank a ship', WHALE);
  const rocket = reel('The rocket that never launched', ROCKET);

  const draw = (spec) => spec.beats.map((beat) => `${beat.props.set}/${beat.props.motif}/${beat.props.atmosphere}`);
  const a = draw(whale);
  const b = draw(rocket);

  // Rig dizisi benzer olsa bile çizimler örtüşmemeli.
  const shared = a.filter((value) => b.includes(value));
  assert.ok(shared.length <= 1, `iki konu ${shared.length} çizimi paylaşıyor: ${shared.join(', ')}`);

  assert.ok(whale.beats.some((beat) => beat.props.set === 'ocean'), 'balina hikâyesi okyanusta geçmiyor');
  assert.ok(rocket.beats.some((beat) => beat.props.set === 'space'), 'roket hikâyesi uzayda geçmiyor');
  assert.ok(whale.beats.some((beat) => ['whale', 'ship'].includes(beat.props.motif)));
  assert.ok(rocket.beats.some((beat) => ['rocket', 'gear'].includes(beat.props.motif)));
});

test('bir videonun sahneleri birbirinden de farklı çizilir', () => {
  const spec = reel('The rocket that never launched', ROCKET);
  const sets = new Set(spec.beats.map((beat) => beat.props.set));
  const motifs = new Set(spec.beats.map((beat) => beat.props.motif));
  assert.ok(sets.size >= 2, `tüm sahneler aynı mekânda: ${[...sets]}`);
  assert.ok(motifs.size >= 3, `tüm sahneler aynı nesneyi çiziyor: ${[...motifs]}`);
});

test('seçim deterministik ve geçerli kimliklerle sınırlı', () => {
  const first = reel('The whale that sank a ship', WHALE).beats.map((beat) => beat.props);
  const second = reel('The whale that sank a ship', WHALE).beats.map((beat) => beat.props);
  assert.deepEqual(first, second);

  for (const props of first) {
    assert.ok(SET_IDS.includes(props.set) || ['gallery', 'villain', 'desk', 'street', 'study'].includes(props.set), `bilinmeyen set: ${props.set}`);
    assert.ok(props.motif === null || MOTIF_IDS.includes(props.motif), `bilinmeyen motif: ${props.motif}`);
    assert.ok(
      props.atmosphere === 'none' || ATMOSPHERE_IDS.includes(props.atmosphere),
      `bilinmeyen atmosfer: ${props.atmosphere}`,
    );
  }
});

test('kelime önekleri yanlış sahne seçmez', () => {
  // Bu üçü gerçek hatalardı: "millions" fabrika, "started" uzay seçiyordu.
  assert.notEqual(readSubject({line: 'It earned millions in a single year.'}).set, 'factory');
  assert.notEqual(readSubject({line: 'The programme started in a small room.'}).set, 'space');
  assert.notEqual(readSubject({line: 'He worked safely for thirty years.'}).set, 'vault');
});

test('hiçbir sinyal yoksa rigin kendi mekânı kullanılır ve nesne çizilmez', () => {
  const plain = readSubject({line: 'Nobody expected what happened next.', rig: 'money-room', seed: 5, index: 0});
  assert.equal(plain.set, 'study');
  assert.equal(plain.motif, null);
  assert.ok(typeof plain.atmosphere === 'string');
});
