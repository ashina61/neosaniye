import { mkdir, rm } from 'node:fs/promises';
import { config } from '../config.js';
import { synthesizeEdge } from './edgeTts.js';
import { synthesizePiper } from './piper.js';
import { alignWords } from './align.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prepareNarrationForTts, validateNarrationPhrasing } from './phrasing.js';

const run = promisify(execFile);

export { parseSrt } from './edgeTts.js';

/**
 * Faz 2 — Ses (TTS) orkestratörü.
 *
 * Motor stratejisi (config.tts.engine):
 *   - 'auto'  : önce edge-tts; başarısız olursa (403/ağ/kurulu değil) Piper'a düşer.
 *   - 'edge'  : sadece edge-tts.
 *   - 'piper' : sadece Piper (çevrimdışı).
 *
 * Kelime zamanlaması:
 *   - edge-tts kendi WordBoundary altyazısını verir (whisper gerekmez).
 *   - Piper vermez; bu durumda faster-whisper ile hizalama yapılır.
 */

/** Anlatı script'inin seslendirilecek metin parçalarını sırayla döndürür.
 *  Yalnızca sahne anlatımları seslendirilir — cta (abone ol) SESLENDİRİLMEZ;
 *  o yalnızca açıklama metninde ve görsel abone pilinde kullanılır. */
export function scriptSegments(script) {
  if (Array.isArray(script.scenes) && script.scenes.length) {
    return script.scenes.map((s) => (s.narration || '').trim()).filter(Boolean);
  }
  return [script.hook, script.body].filter(Boolean).map((s) => s.trim());
}

/** Bir script nesnesini seslendirilecek tek düz metne çevirir. */
export function scriptToNarration(script) {
  return scriptSegments(script).join(' ').replace(/\s+/g, ' ').trim();
}

/** Konu tipine göre TTS taban hızını ayarlar.
 *  - Heyecanlı/aksiyon konuları (mystery, history, nature + story/facts3/whatif):
 *    +rateExcitedDelta (%10) → daha enerjik tempo.
 *  - Bilimsel/açıklayıcı konular (science, space, human body, technology +
 *    howworks/process): +rateScientificDelta (-%5) → daha anlaşılır tempo.
 *  Diğer durumlarda taban hız korunur.
 *  @returns {string} edge-tts rate ("+18%", "+3%" gibi)
 */
export function ttsRateForTopic(script, baseRate = config.tts.rate) {
  const base = Number.parseInt(String(baseRate).replace('%', ''), 10) || 0;
  const category = String(script?.category || '').toLowerCase();
  const format = String(script?.format || '').toLowerCase();
  const EXCITED = ['mystery', 'history', 'nature'];
  const SCIENTIFIC = ['science', 'space', 'human body', 'technology'];
  const EXCITED_FMT = ['story', 'facts3', 'whatif'];
  const SCIENTIFIC_FMT = ['howworks', 'process'];
  let delta = 0;
  if (EXCITED.includes(category) || EXCITED_FMT.includes(format)) {
    delta = config.tts.rateExcitedDelta;
  } else if (SCIENTIFIC.includes(category) || SCIENTIFIC_FMT.includes(format)) {
    delta = config.tts.rateScientificDelta;
  }
  const total = base + delta;
  return `${total >= 0 ? '+' : ''}${total}%`;
}

function timingDuration(wordTimings = []) {
  return wordTimings.reduce((max, item) => Math.max(max, Number(item?.end) || 0), 0);
}

function parseFfmpegDuration(stderr = '') {
  const matches = [...String(stderr).matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (!matches.length) return 0;
  const [, hours, minutes, seconds] = matches[matches.length - 1];
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * FFmpeg'in gerçekten çözdüğü süre varsa onu kullanır. MP3 metadata süresi,
 * Edge TTS'in parça parça yazdığı dosyalarda yalnız ilk parçayı (ör. 8.1s)
 * gösterebilir. Decode ölçümü yoksa metadata ve SRT zamanının büyüğüne düşer.
 */
export function selectAuthoritativeDuration({ decoded = 0, metadata = 0, timing = 0 } = {}) {
  const decodedSeconds = Number(decoded) || 0;
  if (decodedSeconds > 0) return decodedSeconds;
  return Math.max(Number(metadata) || 0, Number(timing) || 0);
}

async function probeMetadataDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ]);
  return Number.parseFloat(stdout) || 0;
}

async function probeDecodedDuration(file) {
  let stderr = '';
  try {
    ({ stderr = '' } = await run('ffmpeg', [
      '-hide_banner',
      '-i', file,
      '-map', '0:a:0',
      '-f', 'null',
      '-',
    ], { maxBuffer: 10 * 1024 * 1024 }));
  } catch (error) {
    stderr = error?.stderr || '';
  }
  return parseFfmpegDuration(stderr);
}

async function probeDuration(file, wordTimings = []) {
  const [metadata, decoded] = await Promise.all([
    probeMetadataDuration(file).catch(() => 0),
    probeDecodedDuration(file).catch(() => 0),
  ]);
  const timing = timingDuration(wordTimings);
  const selected = selectAuthoritativeDuration({ decoded, metadata, timing });

  if (selected > 0 && metadata > 0 && Math.abs(selected - metadata) > 2) {
    console.warn(
      `[tts] MP3 metadata süresi güvenilmez (${metadata.toFixed(1)}s); ` +
      `decode ölçümü ${selected.toFixed(1)}s kullanılıyor.`,
    );
  }
  return selected;
}

async function removeGeneratedFiles(result) {
  const files = [result?.audioPath, result?.subtitlePath].filter(Boolean);
  await Promise.all(files.map((file) => rm(file, { force: true }).catch(() => {})));
}

/**
 * @param {object} script - generateScript çıktısı (en az {hook,body,cta}).
 * @param {object} [opts]
 * @param {string} [opts.outDir='output']
 * @param {string} [opts.basename] - Dosya adı kökü (varsayılan normalizedTopic).
 * @param {'auto'|'edge'|'piper'} [opts.engine] - config.tts.engine'i geçersiz kılar.
 * @returns {Promise<{engine:string, audioPath:string, subtitlePath:(string|null), wordTimings:Array, text:string, durationEstimate:number}>}
 */
export async function generateAudio(script, opts = {}) {
  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    engine = config.tts.engine,
  } = opts;

  await mkdir(outDir, { recursive: true });
  const language = script.language || config.content?.language || 'en';
  const rawText = scriptToNarration(script);
  const segmentTexts = scriptSegments(script).map((segment) => prepareNarrationForTts(segment, { language }));
  const text = segmentTexts.join(' ').replace(/\s+/g, ' ').trim();
  // Konu tipine göre TTS hızı (heyecanlı +%10 / bilimsel -%5). edge-tts yolu
  // bu hızı kullanır; Piper (çevrimdışı yedek) sabit hızda çalışır.
  const topicRate = ttsRateForTopic(script);
  if (topicRate !== config.tts.rate) {
    console.log(`[tts] konu hızı: ${config.tts.rate} → ${topicRate} (kategori: ${script.category || '-'}, format: ${script.format || '-'})`);
  }
  const base = { outDir, basename, rate: topicRate };

  let result;

  if (engine === 'edge') {
    result = await synthesizeEdge(text, base);
  } else if (engine === 'piper') {
    result = await synthesizePiper(text, base);
  } else {
    // auto: edge-tts dene, olmazsa Piper'a düş.
    try {
      result = await synthesizeEdge(text, base);
    } catch (edgeErr) {
      console.warn(
        `[tts] edge-tts başarısız, Piper'a düşülüyor: ${
          (edgeErr.stderr || edgeErr.message || '').split('\n')[0]
        }`,
      );
      try {
        result = await synthesizePiper(text, base);
      } catch (piperErr) {
        throw new Error(
          `Her iki TTS motoru da başarısız.\n- edge-tts: ${
            edgeErr.stderr || edgeErr.message
          }\n- piper: ${piperErr.stderr || piperErr.message}`,
        );
      }
    }
  }

  // ============ SÜRE KURTARMA — İKİ YÖNLÜ ============
  //
  // Bu blok bir tek yönü biliyordu: ses ÇOK KISA ise yavaşlatıp kurtarıyordu.
  // Uzun tarafta karşılığı yoktu, yani 58s tavanını aşan her koşu boru hattını
  // düşürüyordu — canlı örnek: 61.0s ölçüldü, üretim medya ve render'a hiç
  // gelmeden AUDIO_TOO_LONG ile öldü.
  //
  // Asimetri kendi başına bir hataydı, çünkü uzun tarafın çözümü daha da kolay:
  // konu hızı zaten anlaşılırlık için YAVAŞLATILMIŞTI (-7%), yani geri almak
  // için bolca doğal alan var. Kısa tarafta yavaşlatmanın doğal bir tabanı
  // (0.82) olduğu gibi uzun tarafta da hızlanmanın doğal bir tavanı (1.22)
  // vardır; ötesi anlatıcıyı sıkıştırılmış sese çevirir ve retention'ı yer.
  //
  // Kurtarma adayı ayrı dosyaya yazılır; bandın içine girmiyorsa asıl ses
  // korunur — yanlış bir kurtarma, dürüst bir hatadan kötüdür.
  let firstProbe = await probeDuration(result.audioPath, result.wordTimings).catch(() => 0);
  const minSec = config.content?.minDurationSeconds ?? 35;
  const maxSec = config.content?.maxDurationSeconds ?? 58;
  const tooShort = firstProbe > 0 && firstProbe < minSec;
  const tooLong = firstProbe > 0 && firstProbe > maxSec;

  if (result.engine === 'edge-tts' && (tooShort || tooLong)) {
    // Hedef bandın ucuna değil, İÇİNE nişan alınır: tam sınıra oynamak ölçüm
    // gürültüsünde tekrar dışarı düşer.
    const targetSec = tooShort
      ? Math.min(maxSec - 2, minSec + 4)
      : Math.max(minSec + 4, maxSec - 3);
    const curPct = Number.parseInt(String(topicRate).replace('%', ''), 10) || 0;
    const curFactor = 1 + curPct / 100;
    const requestedFactor = curFactor * (firstProbe / targetSec);
    const naturalFloor = 0.82;
    const naturalCeiling = 1.22;

    if (requestedFactor < naturalFloor || requestedFactor > naturalCeiling) {
      console.warn(
        `[tts] ölçülen ${firstProbe.toFixed(1)}s; doğal konuşma hızıyla ${targetSec.toFixed(1)}s ` +
        `hedeflenemez (gereken çarpan ${requestedFactor.toFixed(2)}). Yapay hız değişimi yapılmayacak — ` +
        `çözüm script uzunluğunda.`,
      );
    } else {
      // Kısa tarafta yalnız yavaşlatılır, uzun tarafta yalnız hızlandırılır;
      // yanlış yöne kayan bir "kurtarma" sesi bandın öbür ucundan çıkarırdı.
      const newFactor = tooShort ? Math.min(curFactor, requestedFactor) : Math.max(curFactor, requestedFactor);
      const newPct = Math.round((newFactor - 1) * 100);
      const newRate = `${newPct >= 0 ? '+' : ''}${newPct}%`;

      if (newRate !== topicRate) {
        console.warn(
          `[tts] ölçülen ${firstProbe.toFixed(1)}s ${tooShort ? `< ${minSec}s` : `> ${maxSec}s`} — ` +
          `${topicRate}→${newRate} ile kontrollü yeniden sentez.`,
        );
        let rescue;
        try {
          rescue = await synthesizeEdge(text, {
            ...base,
            basename: `${basename}-duration-rescue`,
            rate: newRate,
          });
          const rescueDur = await probeDuration(rescue.audioPath, rescue.wordTimings).catch(() => 0);
          if (rescueDur >= minSec && rescueDur <= maxSec) {
            console.log(`[tts] kurtarma kabul edildi: ${rescueDur.toFixed(1)}s (${newRate}).`);
            result = rescue;
            firstProbe = rescueDur;
          } else {
            console.warn(
              `[tts] kurtarma adayı reddedildi: ${rescueDur.toFixed(1)}s; ` +
              `geçerli aralık ${minSec}-${maxSec}s. Asıl ses korunuyor.`,
            );
            await removeGeneratedFiles(rescue);
          }
        } catch (e) {
          if (rescue) await removeGeneratedFiles(rescue);
          console.warn(
            `[tts] yeniden sentez başarısız, mevcut ses korunuyor: ` +
            `${String(e.stderr || e.message || '').split('\n')[0]}`,
          );
        }
      }
    }
  }

  // Piper yolunda kelime zamanlaması yok -> whisper ile çıkar.
  if (!result.wordTimings) {
    result.wordTimings = await alignWords(result.audioPath).catch((err) => {
      console.warn(
        `[tts] whisper hizalaması başarısız (altyazı zamanlaması boş): ${err.message}`,
      );
      return [];
    });
  }

  const measuredDuration = firstProbe || await probeDuration(result.audioPath, result.wordTimings).catch(() => 0);
  const durationEstimate = measuredDuration || (result.wordTimings.length
    ? result.wordTimings[result.wordTimings.length - 1].end
    : 0);
  const timingSource = result.engine === 'edge-tts'
    ? 'edge-srt-segment-interpolated'
    : result.wordTimings.length ? 'whisper-word-alignment' : 'estimated-word-count-fallback';

  return {
    ...result,
    text,
    rawText,
    segmentTexts,
    duration: durationEstimate,
    durationEstimate,
    timingSource,
    phrasingIssues: validateNarrationPhrasing(text),
  };
}
