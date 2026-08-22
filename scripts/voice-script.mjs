#!/usr/bin/env node
/**
 * THE RECORDING SHEET.
 *
 *   node scripts/voice-script.mjs --episode=<id>
 *
 * The picture side of this pipeline hands over a list of filenames and prompts.
 * This is the same handover for the half that matters more: every TTS host this
 * machine can reach answers 403, so a real voice — a person, or a generator in
 * somebody's browser — has to come from outside, and the narrower that handover
 * is, the fewer ways it can go wrong.
 *
 * IT IS ALSO THE MOST IMPORTANT FILE IN THE EPISODE. Scene lengths are measured
 * off the recording; the cut does not decide how long a shot is, the narration
 * does. Which means a re-record is not "swapping the audio" — it re-times the
 * entire film, and everything downstream has to survive that. It does: every
 * timing inside a shot is a share of the shot.
 *
 * THE ONE INSTRUCTION THAT MATTERS IS THE PAUSE. Line boundaries are found by
 * looking for the longest silences in the file and taking exactly (lines − 1)
 * of them. Read the lines back to back and there is nothing to find; leave a
 * clear beat between them and the measurement is exact. It is the difference
 * between a cut that lands on the sentence and one that lands a second late for
 * the rest of the film.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';

const WORDS_PER_SECOND = 2.5;

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/voice-script.mjs --episode=<episode-id>');
    process.exit(1);
  }
  const dir = episodeDir(id);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const spoken = brief.lines ?? brief.beats ?? [];
  if (!spoken.length) throw new Error('brief.json has no lines to speak');

  await mkdir(path.join(dir, 'audio'), {recursive: true});

  const words = spoken.reduce((n, line) => n + line.vo.trim().split(/\s+/).filter(Boolean).length, 0);
  const estimate = words / WORDS_PER_SECOND;

  const out = [
    `# ${brief.title ?? id} — okuma metni`,
    '',
    `**${spoken.length} satır, ${words} kelime.** Rahat bir tempoda yaklaşık ${Math.round(estimate)} saniye.`,
    '',
    '## Nasıl okunacak',
    '',
    '1. **Hepsini tek seferde, tek dosyada oku.** Satır satır kaydedip birleştirme —',
    '   her klibin kenarında farklı miktarda hava kalır, oysa ölçülen şey tam olarak',
    '   satırlar ARASINDAKİ boşluk.',
    `2. **Her satırın arasında net bir es ver** — bir buçuk, iki saniye. Sahne`,
    `   sınırları bu sessizliklerden bulunuyor: tam ${spoken.length - 1} tane aranıyor.`,
    '   Es yoksa bulunacak sınır da yok.',
    '3. Cümlenin ortasında nefes alman sorun değil — en uzun duraklar aranıyor,',
    '   herhangi bir duraklama değil.',
    '4. Esin uzunluğu kesimi kaydırmaz: kesim, esin sonuna sabit bir mesafede,',
    '   yeni cümleden hemen önce yapılıyor. Uzun es vermen ölçümü kolaylaştırır,',
    '   videoda sessiz bir boşluk bırakmaz.',
    '5. Sessiz bir odada, tek mikrofon mesafesinde. Arka planda müzik olmasın;',
    '   müziği ve oda tonunu bu taraf koyuyor.',
    '',
    '## Dosyayı nereye',
    '',
    '```',
    `episodes/${id}/audio/vo.mp3      (ya da vo.wav — ikisi de olur)`,
    '```',
    '',
    'Sonra:',
    '',
    '```bash',
    `node scripts/voice-episode.mjs --episode=${id} --measure`,
    `npm run broll:render -- --episode=${id}`,
    '```',
    '',
    'Birincisi dosyayı ölçüp `vo.json` yazar, ikincisi bütün filmi ona göre yeniden',
    'keser. Kurguda elle düzeltilecek hiçbir sayı yok.',
    '',
    '---',
    '',
    '## Metin',
    '',
  ];

  for (const [i, line] of spoken.entries()) {
    const n = String(i + 1).padStart(2, '0');
    out.push(`**${n}.**  ${line.vo.trim()}`);
    out.push('');
    if (i < spoken.length - 1) out.push('_(es)_');
    out.push('');
  }

  out.push('---');
  out.push('');
  out.push('Metni değiştirmek istersen `brief.json` içindeki `vo` satırlarını değiştir,');
  out.push('sonra bu listeyi yeniden üret. Konuşulan metin tek bir yerde duruyor.');

  const file = path.join(dir, 'SCRIPT.md');
  await writeFile(file, `${out.join('\n')}\n`, 'utf8');

  console.log(`${id}: ${spoken.length} satır, ${words} kelime, ~${Math.round(estimate)}s`);
  console.log(`\n→ ${path.relative(ROOT, file)}  — okuma metni burada.`);
  console.log(`→ kaydı şuraya koy: episodes/${id}/audio/vo.mp3`);
  console.log(`→ sonra: node scripts/voice-episode.mjs --episode=${id} --measure`);
}

main().catch((error) => {
  console.error(`✗ ${error?.message ?? error}`);
  process.exit(1);
});
