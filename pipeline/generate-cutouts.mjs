#!/usr/bin/env node
/**
 * CUTOUT ÜRETİMİ
 *
 * storyboard.json → sahne başına halftone cutout prompt'u → görsel sağlayıcı →
 * arka plan silme (pipeline/cutout.py) → public/cutouts/*.png → storyboard'a
 * `payload.images` olarak geri yazılır.
 *
 * =================== ANAHTAR RENK YAKLAŞIMI ===================
 *
 * Modelden ŞEFFAF arka plan istemiyoruz — istemek işe yaramıyor. Bunun yerine
 * DOYGUN MAGENTA zemin istiyoruz. Sebebi: özne siyah-beyaz halftone, yani
 * kroması sıfıra yakın. Magenta'nın kroması 1.0. Ayrım tonda değil kromada
 * yapılıyor ve kesin oluyor.
 *
 * Prompt'a "transparent PNG" yazıp modelden JPEG istemek (bir başka
 * yaklaşımda olan) fiziksel olarak imkânsızdır: JPEG'in alfa kanalı yoktur.
 *
 * =================== ÜCRET POLİTİKASI ===================
 *
 * AGENTS.md: kullanıcı açıkça istemedikçe ücretli API çağrılmaz. Bu yüzden
 * varsayılan `--dry-run`: prompt'lar basılır, ağa çıkılmaz. Gerçek üretim
 * `--live` ile açılır.
 */

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {subjectFor as subjectOf} from './subject.mjs';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'cutouts');

/** Anahtar renk. Halftone bir öznede asla görünmez. */
const KEY_COLOUR = 'pure saturated magenta (#FF00FF)';

/**
 * Hangi şablonlar fotoğraf cutout'undan fayda görür?
 *
 * Kod-çizimli şablonlar (harita, ızgara, grafik, zaman çizelgesi, alıntı)
 * listede YOK: onlar kendi görsellerini çiziyor ve fotoğraf eklemek
 * kompozisyonu bozar. Referans videoda da o çekimlerde fotoğraf yok.
 */
const WANTS_IMAGE = new Set(['hero_cutout', 'headline_card', 'star_field', 'wide_establish', 'labeled_diagram']);

/**
 * SOMUT ÖZNE ÇIKARIMI
 *
 * Özne şablonun VARSAYIMINDAN değil cümlenin İÇERİĞİNDEN çıkar.
 *
 * NEDEN: ilk sürüm şablona göre sabit bir ipucu veriyordu ve prova çıktısında
 * şu saçmalıklar göründü —
 *   "a portrait of the person named" + "no charts, and no radio."
 *   "the vessel named"              + "four thousand kilometres of open water."
 *   "a portrait of the person named" + "the swell, and the flight of birds."
 * Hiçbirinde talep edilen özne cümlede yok. Model boşluğu uydurur ve sahne
 * anlatımla ilgisiz bir görsel taşır.
 *
 * Kural: cümlede somut bir özne bulunamıyorsa cutout İSTENMEZ. O sahne
 * yalnızca kodla çizilir. Uydurmaktan iyidir.
 */

/**
 * Somut özne sözlüğü ARTIK BURADA DEĞİL: `pipeline/subject.mjs`.
 *
 * NEDEN TAŞINDI: liste yalnızca burada duruyordu, yani görsel modeline "kano"
 * tarif ediliyordu ama render tarafı o sahneye insan silueti çiziyordu. İki
 * taraf aynı cümleden farklı sonuç çıkarıyordu. Kullanıcının "çizilen şekiller
 * yanlış" dediği kusurun kökü buydu.
 */

/** Sahnenin cutout öznesi. `null` dönerse o sahne için görsel istenmez. */
export function subjectFor(scene) {
  return subjectOf((scene._beat?.text ?? scene.payload?.headline ?? '').replace(/[*"]/g, ''));
}

/**
 * Bir sahne için cutout prompt'u kur.
 *
 * Referans PDF'in stil bloğu korunuyor ama iki şey değişti:
 *   - arka plan: "aged newsprint" DEĞİL, anahtar renk. Zemin kağıdını Remotion
 *     çiziyor; modelden zemin istemek iki kat kağıt demek olurdu.
 *   - metin: kesinlikle yok. Etiketleri de Remotion çiziyor ve model metni
 *     bozuyor.
 */
export function cutoutPrompt(scene) {
  const subject = subjectFor(scene);
  if (!subject) return null;
  return [
    `A single hand-cut paper collage element: ${subject}.`,
    'Rendered as a black and white halftone photograph cutout with rough scissor-cut edges,',
    'coarse print dots, visible paper fiber and grain, matte, flat even documentary lighting.',
    'Desaturated ink black and halftone gray only. No colour in the subject.',
    `BACKGROUND: fill the entire background with ${KEY_COLOUR}, a single flat uniform field.`,
    'The subject must not touch the frame edges; leave a clear margin of background on all sides.',
    'NO text, NO letters, NO numbers, NO watermark, NO logo, NO border, NO paper sheet behind the subject,',
    'NO drop shadow, NO vignette, NO gradient in the background.',
    'NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy.',
    'Vertical 9:16 framing, ultra-detailed.',
  ].join(' ');
}

/* ------------------------------------------------------------------ */
/* Sağlayıcılar — bedava/ücretsiz katman önce                          */
/* ------------------------------------------------------------------ */

function secret(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

const PROVIDERS = {
  /** Anahtarsız, ücretsiz. İlk sırada olması bilinçli. */
  pollinations: {
    needs: () => true,
    async generate(prompt, seed) {
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=768&height=1024&seed=${seed}&nologo=true&model=flux`;
      const r = await fetch(url, {headers: {accept: 'image/png,image/jpeg'}});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    },
  },
  gemini: {
    needs: () => secret('GEMINI_API_KEY', 'GOOGLE_API_KEY'),
    async generate(prompt) {
      const key = secret('GEMINI_API_KEY', 'GOOGLE_API_KEY');
      const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({contents: [{parts: [{text: prompt}]}]}),
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json();
      const parts = j?.candidates?.[0]?.content?.parts ?? [];
      // PNG istenir; alfa gelmese de kroma anahtarı işi çözer, ama JPEG
      // sıkıştırması anahtar kenarını bozduğu için PNG tercih edilir.
      const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline) throw new Error('yanıtta görsel yok');
      return Buffer.from(inline.data, 'base64');
    },
  },
  together: {
    needs: () => secret('TOGETHER_API_KEY'),
    async generate(prompt, seed) {
      const r = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${secret('TOGETHER_API_KEY')}`,
        },
        body: JSON.stringify({
          model: process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free',
          prompt,
          width: 768,
          height: 1024,
          seed,
          response_format: 'base64',
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      if (!b64) throw new Error('yanıtta görsel yok');
      return Buffer.from(b64, 'base64');
    },
  },
};

const DEFAULT_CHAIN = ['pollinations', 'together', 'gemini'];

/* ------------------------------------------------------------------ */

async function makeCutout(rawPath, outPath) {
  // Arka plan silme Python tarafında; alfa doğrulaması --strict ile zorunlu.
  const {stdout} = await run('python3', [
    path.join(ROOT, 'pipeline', 'cutout.py'),
    rawPath,
    outPath,
    '--mode',
    'chroma',
    '--strict',
  ]);
  return stdout.trim();
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const only = (args.find((a) => a.startsWith('--only='))?.split('=')[1] ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number);

  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats` çalıştır.');
    process.exit(1);
  }
  const sb = JSON.parse(await readFile(sbPath, 'utf8'));

  // Şablon görsel isteyebilir ama cümlede somut özne yoksa cutout ÜRETİLMEZ:
  // uydurma özne, anlatımla ilgisiz görsel demektir.
  const wanted = sb.scenes.map((s, i) => ({s, i})).filter(({s}) => WANTS_IMAGE.has(s.template));
  const targets = wanted.filter(({s, i}) => subjectFor(s) && (!only.length || only.includes(i + 1)));
  const skipped = wanted.filter(({s}) => !subjectFor(s));

  console.log(`${sb.scenes.length} sahne, ${wanted.length} tanesi şablon olarak görsel isteyebilir.`);
  console.log(`  ${targets.length} sahnede somut özne bulundu.`);
  console.log(`  ${skipped.length} sahnede özne YOK → cutout istenmiyor, yalnızca kodla çizilecek:`);
  for (const {s, i} of skipped) console.log(`      sahne ${i + 1} (${s.template}) — ${JSON.stringify(s._beat?.text ?? '')}`);
  console.log(`mod: ${live ? 'CANLI (ağa çıkar, kota harcar)' : 'PROVA (ağa çıkmaz)'}`);

  if (!live) {
    console.log('\nÜretilecek prompt\'lar:\n');
    for (const {s, i} of targets) {
      console.log(`--- sahne ${i + 1} (${s.template})`);
      console.log(cutoutPrompt(s));
      console.log();
    }
    console.log('Gerçekten üretmek için: node pipeline/generate-cutouts.mjs --live');
    return;
  }

  const chain = (process.env.IMAGE_PROVIDER_CHAIN || DEFAULT_CHAIN.join(','))
    .split(',')
    .map((x) => x.trim())
    .filter((x) => PROVIDERS[x]);

  await mkdir(OUT_DIR, {recursive: true});
  let ok = 0;
  const failures = [];

  for (const {s, i} of targets) {
    const prompt = cutoutPrompt(s);
    const raw = path.join(OUT_DIR, `.raw-${String(i + 1).padStart(2, '0')}.png`);
    const out = path.join(OUT_DIR, `scene-${String(i + 1).padStart(2, '0')}.png`);
    let done = false;

    for (const name of chain) {
      const p = PROVIDERS[name];
      if (!p.needs()) {
        console.log(`  sahne ${i + 1}: ${name} atlandı (anahtar yok)`);
        continue;
      }
      try {
        const buf = await p.generate(prompt, s.seed);
        await writeFile(raw, buf);
        // Alfa doğrulaması burada: geçmezse bu sağlayıcının çıktısı işe yaramaz
        // ve sıradakine düşülür. Sessizce opak katman yazmak yasak.
        const line = await makeCutout(raw, out);
        console.log(`  sahne ${i + 1}: ${name} → ${line}`);
        // Remotion staticFile() public/ köküne göre çözer.
        s.payload.images = [`cutouts/${path.basename(out)}`];
        ok += 1;
        done = true;
        break;
      } catch (e) {
        const msg = String(e.stderr || e.message || e).split('\n')[0].slice(0, 160);
        console.log(`  sahne ${i + 1}: ${name} başarısız — ${msg}`);
      }
    }
    if (!done) failures.push(i + 1);
  }

  await writeFile(sbPath, `${JSON.stringify(sb, null, 2)}\n`);
  console.log(`\n${ok}/${targets.length} cutout üretildi, storyboard güncellendi.`);
  if (failures.length) {
    console.log(`üretilemeyen sahneler: ${failures.join(', ')} — bu sahneler prosedürel siluetle render edilir.`);
  }
}

// Doğrudan çalıştırıldığında main; import edildiğinde yalnızca cutoutPrompt.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
