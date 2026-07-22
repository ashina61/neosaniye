import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/script/generateScript.js', import.meta.url).href;

function run(code, env = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
    env: { ...process.env, OPENROUTER_API_KEY: 'openrouter-test-secret', OPENROUTER_MODEL: 'openrouter/free', GEMINI_API_KEY: '', GROQ_API_KEY: '', ...env },
  });
}

test('OpenRouter uses OpenAI chat completions, records the resolved model, and never logs its key', () => {
  const result = run(`
    globalThis.fetch = async (url, init) => new Response(JSON.stringify({ model: 'provider/free-model', choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const response = await m.generateWithRetry(null, { contents: 'hello', config: {} });
    console.log('RESULT=' + JSON.stringify({ response, report: m.getProviderRun() }));
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[openrouter\] model=openrouter\/free/);
  assert.match(result.stdout, /\[openrouter\] resolved=provider\/free-model/);
  assert.match(result.stdout, /\[openrouter\] success/);
  assert.doesNotMatch(result.stdout + result.stderr, /openrouter-test-secret/);
  const payload = JSON.parse(result.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(payload.response.text, 'ok');
  assert.deepEqual(payload.report, { openRouterUsed: true, openRouterRequestedModel: 'openrouter/free', openRouterResolvedModel: 'provider/free-model', openRouterAttempts: 1, openRouterFailures: 0 });
});

test('OpenRouter is only called after Gemini and Groq fail', () => {
  const result = run(`
    globalThis.fetch = async (url) => {
      if (url.includes('api.groq.com')) return new Response(JSON.stringify({ choices: [{ message: { content: 'groq response' } }] }), { status: 200 });
      throw new Error('OpenRouter must not be called while Groq succeeds');
    };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const gemini = { models: { generateContent: async () => { throw new Error('429 quota'); } } };
    const response = await m.generateWithRetry(gemini, { contents: 'hello', config: {} }, 1);
    console.log('RESULT=' + JSON.stringify({ response, report: m.getProviderRun() }));
  `, { GROQ_API_KEY: 'groq-test-key' });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(payload.response.text, 'groq response');
  assert.equal(payload.report.openRouterAttempts, 0);
});

test('OpenRouter 429 trips the circuit breaker and is not retried in the same run', () => {
  const result = run(`
    let calls = 0; globalThis.fetch = async () => { calls += 1; return new Response('', { status: 429 }); };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    for (let i = 0; i < 2; i += 1) { try { await m.generateWithRetry(null, { contents: 'hello', config: {} }); } catch {} }
    console.log('RESULT=' + JSON.stringify({ calls, report: m.getProviderRun() }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(payload.calls, 1);
  assert.equal(payload.report.openRouterFailures, 1);
  assert.equal(payload.report.openRouterAttempts, 1);
});
