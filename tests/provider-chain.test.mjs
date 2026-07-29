import assert from 'node:assert/strict';
import test from 'node:test';
import {jsonObject} from '../scripts/lib/provider-chain.mjs';

test('jsonObject parses fenced provider output', () => {
  assert.deepEqual(jsonObject('```json\n{"title":"ok","scenes":[]}\n```'), {title: 'ok', scenes: []});
});

test('jsonObject stops after the first balanced object', () => {
  const value = jsonObject('Result: {"text":"a } brace","nested":{"ok":true}} trailing {not json}');
  assert.deepEqual(value, {text: 'a } brace', nested: {ok: true}});
});

test('jsonObject handles escaped quotes and rejects incomplete JSON', () => {
  assert.deepEqual(jsonObject('{"text":"say \\\"hi\\\""}'), {text: 'say "hi"'});
  assert.throws(() => jsonObject('prefix {"missing": true'), /incomplete JSON/);
});
