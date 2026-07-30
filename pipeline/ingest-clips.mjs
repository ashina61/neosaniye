#!/usr/bin/env node
/**
 * FLOW KLİP YUTUCU
 *
 * public/clips/ altındaki MP4'leri okur, süresini/boyutunu ölçer ve
 * storyboard'a bağlar. Klibi olan sahnenin şablonu `archive_clip`'e çevrilir;
 * olmayan sahne mevcut şablonuyla (kodla çizilerek) kalır.
 *
 * Dosya adı eşlemesi manifest'ten gelir: out/flow-pack/manifest.json içindeki
 * `flow[].file` ne diyorsa klip o adla aranır (örn. `01-cold_open.mp4`).
 * Ad eşleşmesi kritik — karışırsa montaj sırası sessizce bozulur.
 *
 * ==================== KLİP NEREDEN KESİLİR ====================
 *
 * Flow klipleri 5 saniye ve iç yapısı şu: 0→3.5 s kurulum (öğeler tek tek
 * giriyor), 3.5→5 s tutuş (yaşayan poster). Beat süreleri ise anlatımdan
 * geliyor ve genelde 1.6-3.6 s, yani klipten KISA.
 *
 * Baştan oynatmak yanlış olurdu: kurulum 3.5 saniyede bitiyor, 2.4 saniyelik
 * bir beat'te kare hiç oturmaz ve izleyici yarım kurulmuş bir kolaj görür —
 * üstelik o kompozisyon uğruna görsel üretilmişti.
 *
 * Bu yüzden klibin SONU beat'in sonuna hizalanır:
 *     trimBefore = klipKaresi - beatKaresi
 * 5 s klip + 2.4 s beat → 2.6 s'den başlar: kurulumun son ~0.9 saniyesi
 * (hareket) + 1.5 saniye tutuş (oturmuş kare). Hem hareket var hem kare oturuyor.
 */

import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const CLIPS = path.join(ROOT, 'public', 'clips');
const FPS = 30;

/** Hedef kare: klip bundan belirgin küçükse ölçekleme yumuşaklık getirir. */
const TARGET = {width: 1080, height: 1920};

async function probe(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration,nb_frames,r_frame_rate',
    '-show_entries', 'format=duration',
    '-of', 'json',
    file,
  ]);
  const j = JSON.parse(stdout);
  const s = j.streams?.[0] ?? {};
  const [num, den] = String(s.r_frame_rate ?? '30/1').split('/');
  const fps = Number(num) / Number(den || 1);
  const duration = Number(s.duration ?? j.format?.duration ?? 0);
  return {
    width: Number(s.width ?? 0),
    height: Number(s.height ?? 0),
    fps,
    duration,
  };
}

/** Sesi olan klip var mı? Flow ASMR üretiyor, montaj sırasında kısılacak. */
async function hasAudio(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ]);
  return stdout.trim().length > 0;
}

async function main() {
  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  const manPath = path.join(ROOT, 'out', 'flow-pack', 'manifest.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }
  if (!existsSync(manPath)) {
    console.error('out/flow-pack/manifest.json yok — önce `npm run flow:pack`.');
    process.exit(1);
  }

  const sb = JSON.parse(await readFile(sbPath, 'utf8'));
  const man = JSON.parse(await readFile(manPath, 'utf8'));

  const found = [];
  const missing = [];
  const problems = [];

  for (const row of man.flow) {
    const scene = sb.scenes[row.n - 1];
    if (!scene) continue;
    const file = path.join(CLIPS, `${row.file}.mp4`);
    if (!existsSync(file)) {
      missing.push(row);
      continue;
    }

    const info = await probe(file);
    const audio = await hasAudio(file);
    const beatFrames = scene.durationInFrames;
    const clipFrames = Math.max(1, Math.floor(info.duration * FPS));

    // Klibin SONU beat'in sonuna hizalanır. Gerekçe dosya başında.
    const trimBefore = Math.max(0, clipFrames - beatFrames);

    if (clipFrames < beatFrames) {
      // Klip beat'ten kısa: son kare donacak. Döngüye almak YANLIŞ olurdu —
      // kurulum baştan tekrar oynar ve izleyici tekrarı görür.
      problems.push(
        `${row.file}: klip ${(clipFrames / FPS).toFixed(1)}s < beat ${(beatFrames / FPS).toFixed(1)}s ` +
          `→ ${((beatFrames - clipFrames) / FPS).toFixed(1)}s donmuş kare`,
      );
    }
    if (info.width < TARGET.width) {
      problems.push(
        `${row.file}: ${info.width}x${info.height} → ${TARGET.width}x${TARGET.height} ` +
          `(${(TARGET.width / info.width).toFixed(2)}x büyütme, yumuşama olur)`,
      );
    }
    const ratio = info.height ? info.width / info.height : 0;
    if (Math.abs(ratio - 9 / 16) > 0.02) {
      problems.push(`${row.file}: en-boy ${ratio.toFixed(3)}, 9:16 (0.5625) değil → kırpılacak`);
    }

    scene.template = 'archive_clip';
    scene.payload.clip = {
      src: `clips/${row.file}.mp4`,
      trimBefore,
      clipFrames,
      width: info.width,
      height: info.height,
      audio,
    };
    found.push({...row, info, trimBefore, audio});
  }

  await writeFile(sbPath, `${JSON.stringify(sb, null, 2)}\n`);

  console.log(`klip yutuldu: ${found.length}/${man.flow.length}`);
  for (const f of found) {
    const beat = sb.scenes[f.n - 1].durationInFrames / FPS;
    console.log(
      `  ${f.file.padEnd(20)} ${f.info.duration.toFixed(1)}s ${f.info.width}x${f.info.height}` +
        `  → beat ${beat.toFixed(1)}s, ${(f.trimBefore / FPS).toFixed(1)}s'den kesiliyor` +
        `${f.audio ? ' (ses var)' : ''}`,
    );
  }
  if (missing.length) {
    console.log(`\neksik klip (${missing.length}) — bu sahneler kodla çizilecek:`);
    for (const m of missing) console.log(`  ${m.file}.mp4`);
  }
  if (problems.length) {
    console.log(`\nUYARI (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
  }
  if (!found.length) {
    console.log(`\npublic/clips/ boş. Flow'dan dönen MP4'leri manifest'teki adlarla oraya koy.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
