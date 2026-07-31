#!/usr/bin/env node
/**
 * PARÇA YUTUCU — B YOLU
 *
 * `collage-raw/` altına atılan ham görselleri alır, parçaların magenta zeminini
 * silip alfa PNG'ye çevirir, `public/collage/` altına yazar ve storyboard'a
 * bağlar. Malzemesi tamamlanan sahnenin şablonu `collage_build`'e döner.
 *
 * ==================== NEDEN İKİ AYRI KLASÖR ====================
 *
 * HAM görsel (`collage-raw/`) magenta zeminli ve OPAK. İŞLENMİŞ görsel
 * (`public/collage/`) alfa kanallı. İkisi aynı klasörde dursaydı Remotion
 * bundle'ı ham magenta kareleri de paketlerdi ve yanlış dosyayı sahneye
 * bağlamak tek harflik bir hata olurdu — ekranda mor bir dikdörtgen.
 *
 * `collage-raw/` .gitignore'da: ham görseller büyük ve türetilmiş veri.
 *
 * ==================== EKSİK PARÇA HATA DEĞİL ====================
 *
 * Bu adım ne bulursa onu bağlar. Bir sahnenin parçası yoksa şablonu
 * DEĞİŞMEZ — mevcut kod-çizimli şablonuyla render edilir. Yani paketin
 * tamamını üretmeden tek sahneyle deneme yapılabiliyor, ki B yolunun ilk
 * denemesi tam olarak bu.
 *
 * Plaka olmadan da çalışır: `CollageBuild` plakası yoksa `PaperBase`'in kendi
 * kağıdını kullanır. Yani en küçük geçerli malzeme TEK parça.
 *
 * ==================== ALFA ÖLÇÜLÜR, İDDİA EDİLMEZ ====================
 *
 * `cutout.py --strict` ile çağrılıyor: tamamen opak ya da tamamen şeffaf çıktı
 * hata verir ve o parça bağlanmaz. Bu deponun daha önce ölçtüğü sessiz bozukluk
 * tam buydu — alfa üretildiği iddia edilip hiç kontrol edilmemesi.
 *
 * KULLANIM
 *   node pipeline/ingest-collage.mjs
 *
 * AĞA ÇIKMAZ, ÜCRETLİ ÇAĞRI YAPMAZ.
 */

import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'collage-raw');
const OUT = path.join(ROOT, 'public', 'collage');

/** Görsel modelleri hangi uzantıyla dönerse dönsün bulunsun. */
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function findRaw(base) {
  for (const ext of EXTS) {
    const p = path.join(RAW, base + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Parçayı alfa PNG'ye çevir.
 *
 * `chroma` modu: girdiyi BİZ sipariş ettiğimiz için en dayanıklı olan bu —
 * prompt düz magenta zemin istiyor, burada o renk siliniyor. `ink` modu
 * parlaklıktan alfa türetir ve öznenin açık tonlarını da deler.
 *
 * `--no-halftone`: parça zaten halftone olarak üretildi. İkinci kez uygulamak
 * nokta üstüne nokta bindirip gri bir bulanıklık yapıyor. Aynı gerekçe
 * `CollageBuild`'in `halftone={false}` tercihinde de yazılı.
 */
async function cutout(src, dst) {
  const {stdout} = await run(
    'python3',
    [path.join(ROOT, 'pipeline', 'cutout.py'), src, dst, '--mode', 'chroma', '--no-halftone', '--strict'],
    {cwd: ROOT},
  );
  return stdout.trim();
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
  if (!existsSync(RAW)) {
    console.error(
      `collage-raw/ yok. Üretilen görselleri oraya, out/flow-pack/ASSET-LIST.txt'deki adlarla koy.`,
    );
    process.exit(1);
  }

  const sb = JSON.parse(await readFile(sbPath, 'utf8'));
  const man = JSON.parse(await readFile(manPath, 'utf8'));
  await mkdir(OUT, {recursive: true});

  const wired = [];
  const empty = [];
  const problems = [];

  for (const row of man.flow) {
    const scene = sb.scenes[row.n - 1];
    if (!scene) continue;

    /**
     * PLAKA opak kopyalanır, cutout'tan GEÇMEZ. Zeminin işi zaten örtmek;
     * alfa açmak plakayı delik deşik ederdi.
     */
    let plate;
    const plateRaw = findRaw(`${row.file}-plate`);
    if (plateRaw) {
      const dst = path.join(OUT, `${row.file}-plate.png`);
      await copyFile(plateRaw, dst);
      plate = `collage/${row.file}-plate.png`;
    }

    const pieces = [];
    for (const p of row.pieces ?? []) {
      const raw = findRaw(`${row.file}-${p.slot}`);
      if (!raw) continue;
      const dst = path.join(OUT, `${row.file}-${p.slot}.png`);
      try {
        const line = await cutout(raw, dst);
        pieces.push({src: `collage/${row.file}-${p.slot}.png`, role: p.role});
        console.log(`  ${line}`);
      } catch (e) {
        // Alfa doğrulaması düştü: parça BAĞLANMAZ. Bağlamak, ekranda mor bir
        // dikdörtgen ya da görünmez bir katman demek olurdu.
        problems.push(`${row.file}-${p.slot}: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
      }
    }

    if (!pieces.length && !plate) {
      empty.push(row);
      continue;
    }

    scene.template = 'collage_build';
    scene.payload.layers = {...(plate ? {plate} : {}), pieces};
    wired.push({row, plate, pieces});
  }

  await writeFile(sbPath, `${JSON.stringify(sb, null, 2)}\n`);

  console.log(`\nkolaj bağlandı: ${wired.length}/${man.flow.length} sahne`);
  for (const w of wired) {
    console.log(
      `  ${String(w.row.n).padStart(2)} ${w.row.file.padEnd(20)} ` +
        `${w.plate ? 'plaka+' : 'plakasız '}${w.pieces.length} parça`,
    );
  }
  if (empty.length) {
    console.log(`\nmalzemesi olmayan sahne (${empty.length}) — kodla çizilmeye devam edecek:`);
    for (const e of empty) console.log(`  ${e.file}`);
  }
  if (problems.length) {
    console.log(`\nALFA REDDEDİLDİ (${problems.length}) — bu parçalar bağlanmadı:`);
    for (const p of problems) console.log(`  ${p}`);
    console.log(`  Sebep genelde tek: zemin düz magenta değil. Prompt'taki BACKGROUND cümlesi`);
    console.log(`  alfa çıkarımının tek dayanağı; değiştirilirse maske boş çıkar.`);
  }
  if (!wired.length) {
    console.log(`\ncollage-raw/ boş görünüyor. ASSET-LIST.txt'deki adlarla oraya koy.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
