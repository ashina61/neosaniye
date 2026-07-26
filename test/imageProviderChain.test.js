import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/media/generateImages.js', import.meta.url).href;

/** Görsel zincirini izole çalıştırır; ilgilenilmeyen anahtarlar kapalı. */
function run(code, env = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TOGETHER_API_KEY: '', HUGGINGFACE_API_KEY: '',
      CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '',
      ...env,
    },
  });
}

// 3000 bayt eşiğini geçen sahte görsel (altındakiler "boş/geçersiz" sayılır).
const IMG = "new Uint8Array(5000).fill(7)";

test('ilk sağlayıcı çalışıyorsa sonrakiler denenmez', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => { hits.push(new URL(url).host); return new Response(${IMG}, { status: 200 }); };
    const m = await import('${moduleUrl}');
    const out = await m.generateAiImage('p', '/tmp/ic1.jpg', { width: 8, height: 8, seed: 1 });
    console.log('RESULT=' + JSON.stringify({ hits, provider: out.provider }));
  `);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.provider, 'pollinations');
  assert.deepEqual(p.hits, ['image.pollinations.ai']);
});

test('Pollinations düşerse Cloudflare devralır (aynı kimlik bilgileri)', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => {
      hits.push(new URL(url).host);
      if (url.includes('pollinations')) return new Response('', { status: 503 });
      return new Response(${IMG}, { status: 200, headers: { 'content-type': 'image/png' } });
    };
    const m = await import('${moduleUrl}');
    const out = await m.generateAiImage('p', '/tmp/ic2.jpg', { width: 8, height: 8, seed: 1 });
    console.log('RESULT=' + JSON.stringify({ hits, provider: out.provider }));
  `, { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: 'acct9' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.provider, 'cloudflare');
  assert.deepEqual(p.hits, ['image.pollinations.ai', 'api.cloudflare.com']);
});

test('Cloudflare base64 JSON yanıtını da çözer', () => {
  const r = run(`
    globalThis.fetch = async (url) => {
      if (url.includes('pollinations')) return new Response('', { status: 500 });
      const b64 = Buffer.from(new Uint8Array(5000).fill(3)).toString('base64');
      return new Response(JSON.stringify({ result: { image: b64 } }), {
        status: 200, headers: { 'content-type': 'application/json' } });
    };
    const m = await import('${moduleUrl}');
    const out = await m.generateAiImage('p', '/tmp/ic3.jpg', { width: 8, height: 8, seed: 1 });
    const { statSync } = await import('node:fs');
    console.log('RESULT=' + JSON.stringify({ provider: out.provider, bytes: statSync('/tmp/ic3.jpg').size }));
  `, { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: 'acct9' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.provider, 'cloudflare');
  assert.equal(p.bytes, 5000, 'base64 çözülüp diske yazılmadı');
});

test('anahtarsız sağlayıcı atlanır, Together devreye girer', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => {
      hits.push(new URL(url).host);
      if (url.includes('pollinations')) return new Response('', { status: 500 });
      const b64 = Buffer.from(new Uint8Array(5000).fill(1)).toString('base64');
      return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });
    };
    const m = await import('${moduleUrl}');
    const out = await m.generateAiImage('p', '/tmp/ic4.jpg', { width: 8, height: 8, seed: 1 });
    console.log('RESULT=' + JSON.stringify({ hits, provider: out.provider }));
  `, { TOGETHER_API_KEY: 'tg' }); // cloudflare anahtarsız → atlanmalı
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.provider, 'together');
  assert.deepEqual(p.hits, ['image.pollinations.ai', 'api.together.xyz'],
    'anahtarsız cloudflare çağrıldı');
});

test('429 yiyen sağlayıcı aynı koşuda TEKRAR denenmez', () => {
  const r = run(`
    let polli = 0;
    globalThis.fetch = async (url) => {
      if (url.includes('pollinations')) { polli += 1; return new Response('', { status: 429 }); }
      const b64 = Buffer.from(new Uint8Array(5000).fill(1)).toString('base64');
      return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });
    };
    const m = await import('${moduleUrl}');
    for (let i = 0; i < 3; i += 1) await m.generateAiImage('p', '/tmp/ic5.jpg', { width: 8, height: 8, seed: i });
    console.log('RESULT=' + JSON.stringify({ polli }));
  `, { TOGETHER_API_KEY: 'tg' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.polli, 1, `kota dolan sağlayıcı ${p.polli} kez denendi`);
});

test('hepsi düşerse anlamlı hata atar (çağıran stok yedeğine iner)', () => {
  const r = run(`
    globalThis.fetch = async () => new Response('', { status: 500 });
    const m = await import('${moduleUrl}');
    try {
      await m.generateAiImage('p', '/tmp/ic6.jpg', { width: 8, height: 8, seed: 1 });
      console.log('RESULT=' + JSON.stringify({ threw: false }));
    } catch (e) {
      console.log('RESULT=' + JSON.stringify({ threw: true, msg: e.message.slice(0, 60) }));
    }
  `);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.threw, true, 'hepsi düştüğü hâlde hata atılmadı');
  assert.match(p.msg, /tüm görsel sağlayıcıları düştü/);
});

test('çok küçük yanıt geçerli görsel sayılmaz', () => {
  const r = run(`
    const hits = [];
    globalThis.fetch = async (url) => {
      hits.push(new URL(url).host);
      if (url.includes('pollinations')) return new Response(new Uint8Array(100), { status: 200 });
      const b64 = Buffer.from(new Uint8Array(5000).fill(1)).toString('base64');
      return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });
    };
    const m = await import('${moduleUrl}');
    const out = await m.generateAiImage('p', '/tmp/ic7.jpg', { width: 8, height: 8, seed: 1 });
    console.log('RESULT=' + JSON.stringify({ hits, provider: out.provider }));
  `, { TOGETHER_API_KEY: 'tg' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout.match(/RESULT=(.*)/)[1]);
  assert.equal(p.provider, 'together', '100 baytlık çöp görsel kabul edildi');
});
