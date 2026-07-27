import test from 'node:test';
import assert from 'node:assert/strict';
import {planScene, planVisualStory, STORY_TEMPLATES} from '../src/crew/storyPlanner.js';
import {classifyRemotionTemplate} from '../src/video/buildRemotionSpec.js';

const scene = (narration, image_prompt = 'a beautiful cinematic shot') => ({narration, image_prompt});

test('mekanizma cümlesi görselden kesit ister', () => {
  const item = scene('Termites keep the mound at a constant temperature inside');
  planVisualStory({scenes: [item]});
  assert.equal(item.story_template, 'mechanism');
  assert.match(item.image_prompt, /cross-section/i);
  assert.match(item.image_prompt, /interior|internal/i);
  assert.match(item.image_prompt, /beautiful cinematic shot/);
});

test('kompozisyon gereği promptun başına eklenir', () => {
  const item = scene('Warm air rises through the interior chamber', 'a mound');
  planVisualStory({scenes: [item]});
  assert.ok(item.image_prompt.indexOf('cross-section') < item.image_prompt.indexOf('a mound'));
});

test('davranış cümlesi iz için açık orta zemin ister', () => {
  const item = scene('A single termite walks out and marks the ground behind it');
  planVisualStory({scenes: [item]});
  assert.equal(item.story_template, 'flow');
  assert.match(item.image_prompt, /path can be traced|uncluttered/i);
  assert.equal(item.viewer_task, 'Follow the trail');
});

test('sayı cümlesi sayılabilir örnekler ister', () => {
  const item = scene('Over 3000 workers live inside one colony');
  planVisualStory({scenes: [item]});
  assert.equal(item.story_template, 'quantity');
  assert.match(item.image_prompt, /countable/i);
});

test('yapısı olmayan cümlenin promptuna dokunulmaz', () => {
  const item = scene('It was a quiet ordinary afternoon', 'warm empty landscape');
  planVisualStory({scenes: [item]});
  assert.equal(item.story_template, 'atmosphere');
  assert.equal(item.image_prompt, 'warm empty landscape');
  assert.equal(item.viewer_task, null);
});

test('metin overrideı beat sınıfını ezer', () => {
  assert.equal(planScene({narration: 'The insect stays hidden against the bark'}).story_template, 'search_reveal');
  assert.equal(planScene({narration: 'Workers build the tower layer by layer'}).story_template, 'construction');
  assert.equal(planScene({narration: 'The nest is as tall as a two storey house'}).story_template, 'scale');
});

test('her şablonun kamera planı ve tanımı vardır', () => {
  const known = [
    'mechanism', 'flow', 'comparison', 'scale', 'search_reveal',
    'construction', 'map', 'chain', 'quantity', 'communication', 'cause_effect',
    'chain_reaction', 'timeline', 'navigation', 'problem_solution',
    'filtering', 'reconstruct', 'retrieval', 'emotion_link', 'atmosphere',
  ];
  for (const template of STORY_TEMPLATES) {
    assert.ok(known.includes(template), `bilinmeyen şablon: ${template}`);
  }
  assert.equal(STORY_TEMPLATES.length, known.length);
  const plan = planScene({narration: 'Warm air rises through the chamber inside'});
  assert.ok(plan.camera_plan?.motivation);
  assert.ok(plan.camera_plan.start && plan.camera_plan.end);
});

test('planlanan story beat Remotion şablonuna taşınır', () => {
  const scenes = [
    scene('Opening surprise'),
    scene('A single termite walks out and marks the ground behind it'),
    scene('Final answer'),
  ];
  planVisualStory({scenes});
  assert.ok(scenes[1].story_beat, 'story beat taşınmadı');
  assert.equal(scenes[1].story_template, 'flow');
  assert.equal(classifyRemotionTemplate(scenes[1], 1, scenes.length), 'map-route');
});

test('AI olmadan çalışır ve bozuk girdide çökmez', () => {
  assert.doesNotThrow(() => planVisualStory({}));
  assert.doesNotThrow(() => planVisualStory({scenes: []}));
  assert.doesNotThrow(() => planVisualStory({scenes: [{}]}));
  const result = planVisualStory({scenes: [{narration: 'x'}]});
  assert.equal(result.stats.total, 1);
});

test('istatistikler QC için raporlanır', () => {
  const scenes = [
    scene('Termites keep the mound at a constant temperature inside'),
    scene('A single termite walks out and marks the ground'),
    scene('It was a quiet ordinary afternoon'),
  ];
  const {stats} = planVisualStory({scenes});
  assert.equal(stats.total, 3);
  assert.equal(stats.composed, 2);
  assert.equal(stats.atmosphereOnly, 1);
  assert.equal(stats.viewerTasks, 2);
});
