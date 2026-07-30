#!/usr/bin/env node
/**
 * KONTAKT SAYFASI — her sahneden bir kare, tek PNG'de ızgara.
 *
 * NEDEN VAR
 *
 * Her görsel kontrol için TAM VİDEO render ediliyordu ve bu makinede tam render
 * ÖLÇÜLDÜ: 4 çekirdek, 2388 kare, 2.3 sn/kare → 93 dakika. Yani "şu şekil doğru
 * çizilmiş mi" sorusunu cevaplamak bir buçuk saat sürüyordu. Kullanıcı haklı
 * olarak isyan etti.
 *
 * Oysa soru genellikle HAREKETLE ilgili değil: "bomba mı çizilmiş kutu mu",
 * "başlık okunuyor mu", "kompozisyon boş mu". Bunlar tek kareden görülür.
 *
 * Bu betik zaten render edilmiş bir mp4'ten her sahnenin ORTASINDAN bir kare
 * alıp tek bir ızgaraya diziyor. Maliyeti birkaç saniye, çünkü render değil
 * çıkarma işi.
 *
 * Video henüz yoksa `--render` bayrağı önce DÜŞÜK ÖLÇEKTE bir önizleme render
 * eder (--scale=0.3). Ölçek düşürmek kare başına maliyeti karenin alanıyla
 * orantılı düşürür: 1080x1920 yerine 324x576, yani ~11 kat az piksel.
 * Kompozisyon ve şekil kontrolü için fazlasıyla yeter; yayın için değil.
 *
 * KULLANIM
 *   node pipeline/contact-sheet.mjs out/Cooper3.mp4
 *   node pipeline/contact-sheet.mjs --render          (önce önizleme render et)
 */

import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const FPS = 30;

async function main() {
  const args = process.argv.slice(2);
  const wantRender = args.includes('--render');
  const videoArg = args.find((a) => !a.startsWith('-'));
  const out = path.join(ROOT, 'out', 'contact-sheet.png');

  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }
  const sb = JSON.parse(await readFile(sbPath, 'utf8'));

  let video = videoArg ? path.resolve(ROOT, videoArg) : path.join(ROOT, 'out', 'preview.mp4');
  if (wantRender || !existsSync(video)) {
    video = path.join(ROOT, 'out', 'preview.mp4');
    console.log('düşük ölçekli önizleme render ediliyor (--scale=0.3)…');
    const t0 = Date.now();
    await run(
      'npx',
      [
        'remotion',
        'render',
        'src/index.ts',
        'Short',
        path.relative(ROOT, video),
        '--codec=h264',
        '--crf=30',
        '--pixel-format=yuv420p',
        '--scale=0.3',
      ],
      {cwd: ROOT, maxBuffer: 1 << 26},
    );
    console.log(`  bitti: ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  }
  if (!existsSync(video)) {
    console.error(`video yok: ${video}`);
    process.exit(1);
  }

  // Sahne ORTASINDAN kare al: giriş animasyonu bitmiş, kompozisyon tam kurulmuş.
  const times = [];
  let t = 0;
  for (const s of sb.scenes) {
    const d = s.durationInFrames / FPS;
    times.push({t: t + d * 0.62, template: s.template, shape: s.payload?.shape ?? '-'});
    t += d;
  }

  const tmp = await mkdtemp(path.join(tmpdir(), 'neo-sheet-'));
  try {
    const files = [];
    for (const [i, item] of times.entries()) {
      const f = path.join(tmp, `s${String(i + 1).padStart(2, '0')}.png`);
      await run(
        'ffmpeg',
        ['-v', 'error', '-ss', item.t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=300:-1', f, '-y'],
        {cwd: ROOT},
      );
      files.push(f);
      console.log(`  ${String(i + 1).padStart(2)} ${item.template.padEnd(16)} ${item.shape}`);
    }

    // Izgara: 5 sütun. tile filtresi tek geçişte birleştirir.
    const cols = 5;
    await run(
      'ffmpeg',
      [
        '-v', 'error',
        '-pattern_type', 'glob',
        '-i', path.join(tmp, 's*.png'),
        '-filter_complex', `tile=${cols}x${Math.ceil(files.length / cols)}:margin=8:padding=6:color=0x222222`,
        '-frames:v', '1',
        out,
        '-y',
      ],
      {cwd: ROOT},
    );
    console.log(`\nkontakt sayfası: ${path.relative(ROOT, out)}  (${files.length} sahne)`);
  } finally {
    await rm(tmp, {recursive: true, force: true});
  }
}

main().catch((e) => {
  console.error(String(e.stderr || e.message || e).slice(0, 500));
  process.exit(1);
});
