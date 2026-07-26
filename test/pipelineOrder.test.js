/**
 * TDZ KORUMASI — "Cannot access 'X' before initialization".
 *
 * 26 Tem 15:57 cron koşusu bu hatayla düştü: `finalVideo` değişkeni
 * `runRetentionQC` çağrısına geçirilmişti ama `const finalVideo = ...`
 * satırı O ÇAĞRIDAN SONRA geliyordu. Bu hata SADECE çalışma anında görünür:
 * parse temiz, import temiz, tüm birim testler yeşil — ve boru hattı 10 dakika
 * render yaptıktan sonra son adımda patlıyor.
 *
 * Test paketi runPipeline'ı uçtan uca çalıştıramadığı için (sağlayıcı, TTS,
 * ffmpeg zinciri) bu sınıf hatayı STATİK olarak yakalamak gerekiyor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * Bir kaynak dosyada "bildiriminden ÖNCE kullanılan const/let" arar.
 *
 * Yalnızca fonksiyon gövdesi düzeyindeki (girintili) bildirimleri inceler;
 * import'lar ve modül düzeyi sabitler kapsam dışıdır. Yorumlar ve string'ler
 * taranmadan önce temizlenir.
 *
 * @param {string} source
 * @returns {Array<{name:string, declaredAt:number, usedAt:number}>}
 */
export function findUseBeforeDeclare(source) {
  const raw = source.split('\n');
  // Yorumları ve string içeriğini sil (isim geçişi sayılmasın).
  let inBlock = false;
  let inTpl = false;
  const lines = raw.map((l) => {
    let s = l;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end === -1) return '';
      s = s.slice(end + 2);
      inBlock = false;
    }
    const open = s.indexOf('/*');
    if (open !== -1) { inBlock = !s.includes('*/', open); s = s.slice(0, open); }
    s = s.replace(/\/\/.*$/, '');
    s = s.replace(/'[^']*'|"[^"]*"/g, "''");
    // ÇOK SATIRLI template literal: satır satır silinemez, durum tutulur.
    let out = '';
    for (const ch of s) {
      if (ch === '`') { inTpl = !inTpl; continue; }
      out += inTpl ? ' ' : ch;
    }
    return out;
  });

  // FONKSİYON KAPSAMLARI. Kapsam ayrımı olmadan farklı fonksiyonlardaki aynı
  // isimler (renderVideo.js'te `opts`, `words`, `total`…) yanlış pozitif verir.
  // Üst düzey fonksiyon gövdeleri süslü parantez sayarak çıkarılır.
  const scopes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]/.test(lines[i])) continue;
    let depth = 0; let started = false; let j = i;
    for (; j < lines.length; j += 1) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth += 1; started = true; }
        else if (ch === '}') depth -= 1;
      }
      if (started && depth <= 0) break;
    }
    scopes.push([i, Math.min(j, lines.length - 1)]);
    i = j;
  }

  const problems = [];
  for (const [from, to] of scopes) {
    const decls = new Map();
    for (let i = from; i <= to; i += 1) {
      const m = lines[i].match(/^\s+(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/);
      // DÜRÜST SINIR: 1-2 harflik isimler (m, n, s, id…) hemen her satırda
      // döngü/geri çağırım değişkeni olarak geçer ve regex tabanlı bir tarayıcı
      // bunları güvenilir ayıramaz. Boru hattı aşama sonuçları (finalVideo,
      // runIntegrity, publishGates…) her zaman daha uzundur; guard onlara
      // odaklanır. Tam kapsama bir JS çözümleyicisi ister.
      if (m && m[1].length >= 3 && !decls.has(m[1])) decls.set(m[1], i);
    }
    for (const [name, declaredAt] of decls) {
      const esc = name.replace(/\$/g, '\\$');
      // Kullanım: nokta ile erişilmeyen ve nesne ANAHTARI olmayan geçiş.
      const use = new RegExp(`(?<![.\\w$])${esc}(?![\\w$])(?!\\s*:)`);
      for (let i = from; i < declaredAt; i += 1) {
        const l = lines[i];
        if (!use.test(l)) continue;
        if (new RegExp(`(?:const|let|var|function)\\s+${esc}\\b`).test(l)) break;
        // OK FONKSİYONU PARAMETRESİ aynı ismi gölgeler: `.map((m) => …)` içindeki
        // `m`, 300 satır sonraki `const m` ile ilgisizdir.
        if (new RegExp(`\\(([^)]*\\b${esc}\\b[^)]*)\\)\\s*=>`).test(l)) break;
        if (new RegExp(`function\\s*[\\w$]*\\s*\\([^)]*\\b${esc}\\b`).test(l)) break;
        problems.push({ name, declaredAt: declaredAt + 1, usedAt: i + 1 });
        break;
      }
    }
  }
  return problems;
}

// ---------------- DEDEKTÖRÜN KENDİSİ ----------------
test('dedektör, bildiriminden önceki kullanımı bulur', () => {
  const bad = [
    'function f() {',
    '  const a = g({ finalVideo });',
    '  const finalVideo = 1;',
    '}',
  ].join('\n');
  const p = findUseBeforeDeclare(bad);
  assert.ok(p.some((x) => x.name === 'finalVideo'), JSON.stringify(p));
});

test('dedektör doğru sıralamada sessiz kalır', () => {
  const good = [
    'function f() {',
    '  const finalVideo = 1;',
    '  const a = g({ finalVideo });',
    '}',
  ].join('\n');
  assert.deepEqual(findUseBeforeDeclare(good), []);
});

test('dedektör yorumdaki ismi kullanım saymaz', () => {
  const src = [
    'function f() {',
    '  // finalVideo burada sadece anlatılıyor',
    '  const finalVideo = 1;',
    '}',
  ].join('\n');
  assert.deepEqual(findUseBeforeDeclare(src), []);
});

// ---------------- GERÇEK BORU HATTI ----------------
test('run.js: hiçbir değişken bildiriminden ÖNCE kullanılmıyor', async () => {
  const src = await readFile('src/pipeline/run.js', 'utf8');
  const problems = findUseBeforeDeclare(src);
  assert.deepEqual(problems, [],
    `TDZ riski:\n${problems.map((p) => `  ${p.name}: ${p.usedAt}. satırda kullanılıyor, ${p.declaredAt}. satırda tanımlanıyor`).join('\n')}`);
});

test('renderVideo.js: hiçbir değişken bildiriminden ÖNCE kullanılmıyor', async () => {
  const src = await readFile('src/video/renderVideo.js', 'utf8');
  const problems = findUseBeforeDeclare(src);
  assert.deepEqual(problems, [],
    `TDZ riski:\n${problems.map((p) => `  ${p.name}: ${p.usedAt}. satırda kullanılıyor, ${p.declaredAt}. satırda tanımlanıyor`).join('\n')}`);
});
