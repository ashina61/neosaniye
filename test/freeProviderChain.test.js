import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/script/generateScript.js', import.meta.url).href;

/**
 * Zincir davranışını izole çalıştırır. Tüm sağlayıcılar VARSAYILAN OLARAK
 * kapalıdır; her test yalnızca ilgilendiği anahtarları açar. Böylece ortamdan
 * sızan bir GITHUB_TOKEN testi kirletemez (canlıda bu sızıntı OpenRouter
 * testlerini kırmıştı).
 */
function run(code, env = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GEMINI_API_KEY: '', GROQ_API_KEY: '', OPENROUTER_API_KEY: '',
      GITHUB_MODELS_TOKEN: '', GITHUB_TOKEN: '', CEREBRAS_API_KEY: '',
      MISTRAL_API_KEY: '', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '',
      ...env,
    },
  });
}

const OK_BODY = "JSON.stringify({ choices: [{ message: { content: 'ok' } }] })";

test('anahtarı olmayan sağlayıcı zincire hiç girmez', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => { hits.push(url); return new Response(${OK_BODY}, { status: 200 }); };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    try { await m.generateWithRetry(null, { contents: 'x', config: {} }); } catch {}
    console.log('RESULT=' + JSON.stringify(hits));
  `);
  assert.equal(r.status, 0, r.stderr);
  const hits = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.deepEqual(hits, [], `anahtarsızken ağ çağrısı yapıldı: ${hits.join(', ')}`);
});

test('Cerebras anahtarı varsa devreye girer ve doğru uca gider', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => { hits.push(url); return new Response(${OK_BODY}, { status: 200 }); };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const res = await m.generateWithRetry(null, { contents: 'x', config: {} });
    console.log('RESULT=' + JSON.stringify({ hits, text: res.text }));
  `, { CEREBRAS_API_KEY: 'cerebras-secret' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.text, 'ok');
  assert.equal(p.hits.length, 1);
  assert.match(p.hits[0], /api\.cerebras\.ai\/v1\/chat\/completions/);
  assert.doesNotMatch(r.stdout + r.stderr, /cerebras-secret/, 'anahtar loglandı');
});

test('GitHub Models ayrı anahtar istemez: GITHUB_TOKEN yeter', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url, init) => {
      hits.push({ url, auth: init.headers.authorization });
      return new Response(${OK_BODY}, { status: 200 });
    };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    await m.generateWithRetry(null, { contents: 'x', config: {} });
    console.log('RESULT=' + JSON.stringify(hits));
  `, { GITHUB_TOKEN: 'gh-actions-token' });
  assert.equal(r.status, 0, r.stderr);
  const hits = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.match(hits[0].url, /models\.github\.ai\/inference\/chat\/completions/);
  assert.equal(hits[0].auth, 'Bearer gh-actions-token');
});

test('zincir sırası: Cerebras → GitHub Models → Mistral → Cloudflare', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => { hits.push(url); return new Response('', { status: 500 }); };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    try { await m.generateWithRetry(null, { contents: 'x', config: {} }); } catch {}
    console.log('RESULT=' + JSON.stringify(hits));
  `, {
    CEREBRAS_API_KEY: 'a', GITHUB_TOKEN: 'b', MISTRAL_API_KEY: 'c',
    CLOUDFLARE_API_TOKEN: 'd', CLOUDFLARE_ACCOUNT_ID: 'acct123',
  });
  assert.equal(r.status, 0, r.stderr);
  const hits = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  const hosts = hits.map((u) => new URL(u).host);
  assert.deepEqual(hosts, [
    'api.cerebras.ai', 'models.github.ai', 'api.mistral.ai', 'api.cloudflare.com',
  ], `zincir sırası bozuk: ${hosts.join(' → ')}`);
  // Cloudflare hesap kimliği URL'ye gerçekten giriyor mu?
  assert.match(hits[3], /accounts\/acct123\/ai\/v1\/chat\/completions/);
});

test('ilk başarılı sağlayıcı kazanır, sonrakiler ÇAĞRILMAZ', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => {
      hits.push(new URL(url).host);
      if (url.includes('cerebras')) return new Response('', { status: 429 });
      return new Response(${OK_BODY}, { status: 200 });
    };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const res = await m.generateWithRetry(null, { contents: 'x', config: {} });
    console.log('RESULT=' + JSON.stringify({ hits, text: res.text }));
  `, { CEREBRAS_API_KEY: 'a', GITHUB_TOKEN: 'b', MISTRAL_API_KEY: 'c' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.text, 'ok');
  assert.deepEqual(p.hits, ['api.cerebras.ai', 'models.github.ai'],
    'GitHub Models başarılı olmasına rağmen zincir devam etti');
});

test('429 sağlayıcının devre kesicisini açar: aynı run içinde tekrar denenmez', () => {
  const r = run(`
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response('', { status: 429 }); };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    for (let i = 0; i < 3; i += 1) {
      try { await m.generateWithRetry(null, { contents: 'x', config: {} }); } catch {}
    }
    console.log('RESULT=' + JSON.stringify({ calls }));
  `, { CEREBRAS_API_KEY: 'a' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.calls, 1, `429 sonrası tekrar denendi (${p.calls} çağrı)`);
});

test('kesik JSON: onarım ANCAK ≥5 sahne varsa kabul edilir', () => {
  // Şema sahne istiyorsa, 2 sahneye kırpılmış bir onarım "başarı" sayılıp
  // zinciri durdurmamalı — sıradaki sağlayıcı tam script verebilir.
  const schema = "{ required: ['topic','scenes'], properties: {} }";
  const r = run(`
    const hits = [];
    const short = '{"topic":"x","scenes":[{"n":"a"},{"n":"b"},{"n":"c';
    const full = JSON.stringify({ topic: 'x', scenes: Array.from({length:10},(_,i)=>({ n: 's'+i })) });
    globalThis.fetch = async (url) => {
      hits.push(new URL(url).host);
      const body = url.includes('cerebras') ? short : full;
      return new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), { status: 200 });
    };
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const res = await m.generateWithRetry(null, { contents: 'x', config: { responseSchema: ${schema} } });
    console.log('RESULT=' + JSON.stringify({ hits, scenes: JSON.parse(res.text).scenes.length }));
  `, { CEREBRAS_API_KEY: 'a', GITHUB_TOKEN: 'b' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.deepEqual(p.hits, ['api.cerebras.ai', 'models.github.ai'],
    'yetersiz onarım kabul edilip zincir durdu');
  assert.equal(p.scenes, 10, 'tam script yerine kırpılmış onarım kullanıldı');
});

test('yeterli kesik JSON (≥5 sahne) onarılıp kabul edilir', () => {
  const schema = "{ required: ['topic','scenes'], properties: {} }";
  const r = run(`
    let body = '{"topic":"x","scenes":[';
    for (let i = 0; i < 8; i += 1) body += '{"n":"s' + i + '"},';
    body += '{"n":"kes';   // son sahne yarım kaldı
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), { status: 200 });
    const m = await import('${moduleUrl}'); m.resetProviderRun();
    const res = await m.generateWithRetry(null, { contents: 'x', config: { responseSchema: ${schema} } });
    console.log('RESULT=' + JSON.stringify({ scenes: JSON.parse(res.text).scenes.length }));
  `, { CEREBRAS_API_KEY: 'a' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.scenes, 8, 'yarım sahne atılıp 8 tam sahne kalmalıydı');
});
