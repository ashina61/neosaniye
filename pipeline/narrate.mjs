#!/usr/bin/env node
/**
 * SESLENDİRME — PIPER, OFFLINE VE BEDAVA
 *
 * ============ NEDEN PIPER ============
 *
 * Kanal bedava kalmak zorunda ve bu depo "anahtarsız, kotasız" ölçütünü daha
 * önce arşiv kolunda kullandı. TTS için aynı ölçüt üç seçeneği eliyor:
 * bulut TTS'leri anahtar ister, Google'ın çeviri ucu 200 karakterde kesiyor ve
 * kullanım şartları gri, Pollinations'ın ses ucu ise bu oturumda görsel
 * tarafında güvenilmez ölçüldü.
 *
 * Piper offline çalışır: model bir kez inip diske yazılır, sonra ağ yok, kota
 * yok, hız CPU'ya bağlı. MIT lisanslı ve sesler CC0/CC-BY.
 *
 * ============ ASIL MESELE SES DEĞİL, ZAMANLAMA ============
 *
 * Bu betiğin kritik işi ses dosyası üretmek DEĞİL, beat sürelerini GERÇEK
 * KONUŞMA SÜRESİNDEN yeniden hesaplamak.
 *
 * Şu an süreler `WORDS_PER_SECOND = 1.7` tahmininden geliyor ve o sayı SESSİZ
 * OKUMA için seçildi — izleyici her kelimeyi gözüyle okuyor diye yavaşlatıldı
 * (1.2 → 3.0 → 3.6 → 6.0 sn taban). `beats.mjs` bunu zaten yazmış:
 *
 *   "Seslendirme eklendiğinde bu değer 2.5'e GERİ ÇIKMALI ve beat süreleri
 *    gerçek ses dosyasından ölçülmeli — o zaman kısıt okuma hızı değil,
 *    konuşma hızı olur."
 *
 * Tahmini süreyle üretilmiş bir ses, görüntüyle kayar ve kayma birikir: 13
 * sahnede yarım saniyelik hata 6.5 saniyeye çıkar. O yüzden sıra şu:
 *
 *   1. her beat AYRI seslendirilir
 *   2. her parçanın süresi ffprobe ile ÖLÇÜLÜR
 *   3. sahne süresi o ölçümden yazılır (+ nefes payı)
 *   4. parçalar tek parçaya, sahne sınırlarına göre sessizlikle dizilir
 *
 * Böylece ses ile görüntü tanım gereği hizalı; senkron bir umut değil, bir
 * sonuç.
 *
 * ============ MODEL YOKSA İŞ DURMAZ ============
 *
 * Piper kurulu değilse ya da model inmediyse betik UYARIP çıkar ve storyboard'a
 * dokunmaz. Video yine sessiz çıkar — bu deponun her sağlayıcı kolunda aynı
 * kural: eksik araç videoyu düşürmez.
 */

import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const TMP = path.join(ROOT, 'out', 'tts');
const FPS = 30;

/**
 * NEFES PAYI — sahne, cümle bittiği anda kesilmemeli.
 *
 * Kesme noktası konuşmanın son hecesine yapışırsa izleyici cümlenin bittiğini
 * anlamadan sahne değişiyor. 0.45 saniye, iki cümle arasındaki doğal duraklama.
 */
const TAIL_SECONDS = 0.45;

/**
 * SAHNE TABANI SESLİ KİPTE DÜŞÜYOR.
 *
 * Sessiz kipte taban 6.0 saniyeydi ve gerekçesi okuma yüküydü. Ses varken o yük
 * yok: izleyici dinliyor, ekrandaki metin destek. Taban yalnızca çok kısa bir
 * cümlenin göz açıp kapayana kadar geçmesini engelliyor.
 */
const MIN_SECONDS = 2.8;

async function have(cmd, args = ['--help']) {
  try {
    await run(cmd, args);
    return true;
  } catch (e) {
    // Yardım metni bazı araçlarda çıkış kodu 1 veriyor; ENOENT gerçek yokluk.
    return e.code !== 'ENOENT';
  }
}

async function durationOf(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function main() {
  const args = process.argv.slice(2);
  const model = args.find((a) => a.startsWith('--model='))?.split('=')[1]
    ?? process.env.PIPER_MODEL
    ?? path.join(ROOT, 'out', 'voices', 'en_US-lessac-medium.onnx');

  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }

  if (!(await have('piper', ['--help']))) {
    console.log('piper kurulu değil — seslendirme ATLANIYOR, video sessiz çıkacak.');
    return;
  }
  if (!existsSync(model)) {
    console.log(`ses modeli yok (${model}) — seslendirme ATLANIYOR.`);
    return;
  }

  const sb = JSON.parse(await readFile(sbPath, 'utf8'));
  await rm(TMP, {recursive: true, force: true});
  await mkdir(TMP, {recursive: true});
  await mkdir(AUDIO_DIR, {recursive: true});

  /* ---- 1. Her beat ayrı seslendirilir, süresi ölçülür ---- */
  const parts = [];
  for (const [i, scene] of sb.scenes.entries()) {
    const text = String(scene._beat?.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) {
      parts.push({i, file: null, seconds: 0});
      continue;
    }
    const file = path.join(TMP, `${String(i + 1).padStart(2, '0')}.wav`);
    // Metin STDIN'den: komut satırına gömmek tırnak ve kesme işaretlerinde
    // kırılıyor ve anlatı ikisini de taşıyor.
    await run('sh', ['-c',
      `printf '%s' ${JSON.stringify(text)} | piper --model ${JSON.stringify(model)} --output_file ${JSON.stringify(file)}`,
    ]);
    const seconds = await durationOf(file);
    parts.push({i, file, seconds});
    console.log(`  sahne ${String(i + 1).padStart(2)} — ${seconds.toFixed(2)}s  "${text.slice(0, 48)}"`);
  }

  /* ---- 2. Sahne süreleri ÖLÇÜMDEN yazılır ---- */
  let changed = 0;
  for (const p of parts) {
    const want = Math.max(MIN_SECONDS, p.seconds + TAIL_SECONDS);
    const frames = Math.round(want * FPS);
    if (frames !== sb.scenes[p.i].durationInFrames) changed += 1;
    sb.scenes[p.i].durationInFrames = frames;
  }
  sb.totalFrames = sb.scenes.reduce((a, s) => a + s.durationInFrames, 0);

  /* ---- 3. Tek parçaya diz: her parça kendi sahnesinin BAŞINDA ---- */
  //
  // `adelay` ile her parça sahne başlangıcına kaydırılıp `amix` yerine
  // `amerge`/`concat` değil TOPLAMA kullanılıyor: parçalar çakışmıyor, o yüzden
  // toplama kayıpsız ve zamanlama tam.
  let offsetMs = 0;
  const inputs = [];
  const filters = [];
  let n = 0;
  for (const p of parts) {
    const sceneMs = Math.round((sb.scenes[p.i].durationInFrames / FPS) * 1000);
    if (p.file) {
      inputs.push('-i', p.file);
      filters.push(`[${n}:a]adelay=${offsetMs}|${offsetMs}[a${n}]`);
      n += 1;
    }
    offsetMs += sceneMs;
  }

  const out = path.join(AUDIO_DIR, 'narration.wav');
  if (n === 0) {
    console.log('seslendirilecek metin yok.');
    return;
  }
  const mix = `${filters.join(';')};${Array.from({length: n}, (_, k) => `[a${k}]`).join('')}amix=inputs=${n}:normalize=0[out]`;
  await run('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex', mix, '-map', '[out]',
    '-ar', '44100', '-ac', '1',
    out,
  ]);

  sb.audio = 'audio/narration.wav';
  await writeFile(sbPath, `${JSON.stringify(sb, null, 2)}\n`);

  const total = sb.totalFrames / FPS;
  console.log(`\nseslendirme yazıldı: public/audio/narration.wav`);
  console.log(`  ${n} sahne seslendirildi, ${changed} sahnenin süresi ölçümden yeniden yazıldı`);
  console.log(`  toplam süre: ${total.toFixed(1)}s (${sb.scenes.length} sahne, ort ${(total / sb.scenes.length).toFixed(1)}s)`);
}

main().catch((e) => {
  console.error(String(e.stderr || e.message || e).slice(0, 400));
  process.exit(1);
});
