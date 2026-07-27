import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  buildSubjectBible, shortCanonicalName, subjectPromptPrefix, applySubjectBible,
} from '../src/crew/subjectBible.js';
import {assignListMarkers, assessListStructure} from '../src/pipeline/storyAudit.js';
import {planScene} from '../src/crew/storyPlanner.js';

test('kanonik ad kısa olur, görsel-anchor paragrafı ad olarak kullanılmaz', () => {
  const anchor = 'A vibrant ruby-throated hummingbird, metallic green and iridescent red, '
    + 'hovers near a brightly colored flower in a lush garden. The lighting is bright and natural.';
  const bible = buildSubjectBible({topic: 'How Hummingbirds See Invisible Colors', visual_anchor: anchor});
  assert.equal(bible.canonicalName, 'hummingbird');
  assert.ok(bible.canonicalName.length <= 40);
  const prefix = subjectPromptPrefix(bible);
  assert.ok(prefix.length < 130, `ön ek çok uzun (${prefix.length})`);
  assert.ok(!prefix.includes('lush garden'));
});

test('çoğul tür adı tekile indirilir', () => {
  assert.equal(shortCanonicalName('How Hummingbirds See Invisible Colors'), 'hummingbird');
  assert.equal(shortCanonicalName('Sea Cucumbers'), 'sea cucumber');
  assert.equal(shortCanonicalName('Why Ants Never Sleep'), 'ant');
  assert.equal(shortCanonicalName('Termite Mound Engineering'), 'termite');
});

test('ad çıkarılamıyorsa kimlik ön eki kurulmaz', () => {
  const longNonName = 'x'.repeat(120);
  assert.equal(shortCanonicalName(longNonName), '');
  const bible = buildSubjectBible({topic: '', visual_anchor: longNonName});
  assert.equal(subjectPromptPrefix(bible), '');
  const script = {visual_anchor: longNonName, scenes: [{image_prompt: 'a reef'}]};
  const {applied} = applySubjectBible(script);
  assert.equal(applied, 0);
  assert.equal(script.scenes[0].image_prompt, 'a reef');
});

test('kimlik ön eki sahne cümlesini boğmaz', () => {
  const script = {
    topic: 'How Hummingbirds See Invisible Colors',
    scenes: [{image_prompt: 'a bird hovering beside a red flower at dawn'}],
  };
  applySubjectBible(script);
  const prompt = script.scenes[0].image_prompt;
  const prefixLength = prompt.indexOf('a bird hovering');
  assert.ok(prefixLength > 0 && prefixLength < 140, `ön ek ${prefixLength} karakter`);
});

test('hook liste vaat etmiyorsa numara atanmaz', () => {
  const script = {
    hook_text: "See colors we can't?",
    title: '5 colors humans miss',
    scenes: Array.from({length: 10}, () => ({narration: 'x'})),
  };
  const result = assignListMarkers(script);
  assert.equal(result.declared, null);
  assert.equal(result.assigned, 0);
  assert.ok(!script.scenes.some((scene) => Number.isFinite(scene.list_index)));
  assert.equal(assessListStructure(script).declared, false);
});

test('hook liste vaat ediyorsa numara atanır', () => {
  const script = {
    hook_text: '5 incredible facts',
    scenes: Array.from({length: 10}, () => ({narration: 'x'})),
  };
  const result = assignListMarkers(script);
  assert.equal(result.declared, 5);
  assert.equal(result.assigned, 5);
});

test('tek renderer Remotiondur ve eski abone rozet yolu yoktur', async () => {
  const source = await readFile('src/video/renderVideo.js', 'utf8');
  assert.match(source, /renderRemotion/);
  assert.doesNotMatch(source, /subPrompt|motionCtaOn|drawtext|filter_complex/);
});

test('karşıtlık cümlesi karşılaştırma şablonu alır', () => {
  assert.equal(
    planScene({narration: 'Unlike humans with three, hummingbirds possess four distinct types'}).story_template,
    'comparison',
  );
  assert.equal(
    planScene({narration: 'In contrast, most birds see only three colors'}).story_template,
    'comparison',
  );
});

test('ölçek cümlesi karşılaştırmaya kaymaz', () => {
  assert.equal(
    planScene({narration: 'The nest is as tall as a two storey house'}).story_template,
    'scale',
  );
});
