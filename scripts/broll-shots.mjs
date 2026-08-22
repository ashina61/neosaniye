#!/usr/bin/env node
/**
 * THE SHOPPING LIST.
 *
 *   node scripts/broll-shots.mjs --episode=<id>
 *
 * Reads `brief.json` — the beats you wrote — and writes two things:
 *
 *   PROMPTS.md   a human list: exact filename, exact size, and the prompt to
 *                paste into whichever image generator you use.
 *   shots.json   the same thing for the renderer.
 *
 * This exists because the one thing this machine cannot do is MAKE THE
 * PICTURES. Everything else — keying, layout, timing, the render — is
 * mechanical. So the handover is made as narrow and as explicit as possible:
 * you come back with files named exactly what the list says, drop them in
 * `raw/`, and nothing else has to be decided.
 *
 * THE FILENAME IS THE CONTRACT. Not "put the tank somewhere in the folder" —
 * `s04-mid-tank.png`. A pipeline that has to guess which file is which is a
 * pipeline that puts the White House behind the ocean.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';

/**
 * WHAT EACH LAYER IS ASKED FOR.
 *
 * The suffixes are the reference's three-layer model, and the prompt tails are
 * doing real work: "transparent background, sharp edges" is what makes the
 * keyer's job possible, and "plain flat background" is the fallback for a
 * generator that cannot do alpha at all — the corners are then reliably one
 * colour, which is exactly what the flood fill needs.
 */
const TAIL = {
  bg: 'wide establishing shot, muted desaturated colour, subtle paper grain, no text, no watermark, no people in the foreground',
  mid: 'cut-out subject, isolated, plain flat off-white background, sharp clean edges, no shadow on the background, no text, no watermark',
  fore: 'flat editorial illustration, isolated object, plain flat off-white background, sharp clean edges, no text, no watermark',
};

const SIZE = {
  vertical: {frame: [1080, 1920], bg: [1080, 1920], mid: [1024, 1024], fore: [1024, 1024]},
  landscape: {frame: [1920, 1080], bg: [1920, 1080], mid: [1024, 1024], fore: [1024, 1024]},
};

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u'})[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);

export function shotsOf(brief) {
  const format = brief.format === 'landscape' ? 'landscape' : 'vertical';
  const size = SIZE[format];
  const style = brief.style ?? '';
  const wanted = [];

  const beats = (brief.beats ?? []).map((beat, index) => {
    const n = String(index + 1).padStart(2, '0');
    const layer = (kind, item, order) => {
      /**
       * `use` POINTS AT A PICTURE THAT ALREADY EXISTS.
       *
       * The last shot of a film coming back to its first is an edit, not a
       * shortage — and asking a generator for "the same tanker again" returns a
       * different tanker, which is the one thing that kills the callback. A
       * layer that names a file is simply not on the shopping list.
       */
      if (item.use) return {...item, file: item.use};
      const name = slugify(item.name ?? item.prompt ?? `${kind}-${order + 1}`);
      const file = `s${n}-${kind}-${name}.png`;
      wanted.push({
        file,
        kind,
        beat: beat.slug ?? `beat-${index + 1}`,
        vo: beat.vo ?? '',
        size: size[kind],
        prompt: [item.prompt, style, TAIL[kind]].filter(Boolean).join(', '),
      });
      return {...item, file};
    };

    return {
      slug: beat.slug ?? `beat-${index + 1}`,
      vo: beat.vo ?? '',
      // THE BACKGROUND IS SHARED UNLESS A BEAT ASKS FOR ITS OWN. One locked
      // backdrop across every scene is what makes seven cuts feel like one
      // film rather than seven films.
      bg: beat.bg ? layer('bg', beat.bg, 0) : null,
      mid: (beat.mid ?? []).map((item, i) => layer('mid', item, i)),
      fore: (beat.fore ?? []).map((item, i) => layer('fore', item, i)),
      text: beat.text ?? null,
      camera: beat.camera ?? null,
      anchor: beat.anchor ?? null,
      // Drawn layers ask nothing of the generator, so they ride straight
      // through: the shopping list is for pictures, and a line is not one.
      graphics: beat.graphics ?? null,
    };
  });

  if (brief.background) {
    wanted.unshift({
      file: 'background.png',
      kind: 'bg',
      beat: '(shared)',
      vo: 'every scene',
      size: size.bg,
      prompt: [brief.background, style, TAIL.bg].filter(Boolean).join(', '),
    });
  }

  return {format, frame: size.frame, beats, wanted};
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/broll-shots.mjs --episode=<episode-id>');
    process.exit(1);
  }
  const dir = episodeDir(id);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const plan = shotsOf(brief);

  await mkdir(path.join(dir, 'raw'), {recursive: true});
  await writeFile(path.join(dir, 'shots.json'), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  const lines = [
    `# ${brief.title ?? id} — görsel listesi`,
    '',
    `**${plan.wanted.length} görsel.** Hepsi \`episodes/${id}/raw/\` içine, **tam olarak bu adlarla** atılacak.`,
    '',
    'Arka planı şeffaf verebilen bir üretici kullanıyorsan şeffaf iste — daha temiz olur.',
    'Veremiyorsa sorun değil: **düz, tek renk bir zemin** yeter, keyleme onu siler.',
    '',
    '---',
    '',
  ];
  for (const [i, item] of plan.wanted.entries()) {
    lines.push(`### ${i + 1}. \`${item.file}\``);
    lines.push('');
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| **boyut** | ${item.size[0]} × ${item.size[1]} |`);
    lines.push(`| **katman** | ${item.kind === 'bg' ? 'arka plan' : item.kind === 'mid' ? 'orta (özne)' : 'ön (çapa)'} |`);
    lines.push(`| **hangi satır** | ${item.vo ? `_"${item.vo}"_` : '—'} |`);
    lines.push('');
    lines.push('```');
    lines.push(item.prompt);
    lines.push('```');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('Hepsi `raw/` içine düştükten sonra:');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm run broll:key -- --episode=${id}      # arka planları siler`);
  lines.push(`npm run broll:render -- --episode=${id}   # videoyu toparlar`);
  lines.push('```');
  await writeFile(path.join(dir, 'PROMPTS.md'), `${lines.join('\n')}\n`, 'utf8');

  console.log(`${id}: ${plan.beats.length} beat, ${plan.wanted.length} görsel gerekiyor`);
  for (const item of plan.wanted) {
    console.log(`  ${item.file.padEnd(34)} ${String(item.size[0]).padStart(4)}x${item.size[1]}  ${item.kind}`);
  }
  console.log(`\n→ ${path.relative(ROOT, path.join(dir, 'PROMPTS.md'))}  — promptlar burada, aç ve al gel.`);
  console.log(`→ görselleri şuraya at: ${path.relative(ROOT, path.join(dir, 'raw'))}/`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
