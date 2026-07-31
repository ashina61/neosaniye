#!/usr/bin/env node
/**
 * PARÇA YUTUCU — B YOLU
 *
 * `collage-raw/` altına atılan ham görselleri alır, zemini silip alfa PNG'ye
 * çevirir, `public/collage/` altına yazar ve storyboard'a bağlar. Malzemesi tamamlanan sahnenin şablonu `collage_build`'e döner.
 *
 * ==================== NEDEN İKİ AYRI KLASÖR ====================
 *
 * HAM görsel (`collage-raw/`) zeminli ve OPAK. İŞLENMİŞ görsel
 * (`public/collage/`) alfa kanallı. İkisi aynı klasörde dursaydı Remotion
 * bundle'ı ham kareleri de paketlerdi ve yanlış dosyayı sahneye bağlamak tek
 * harflik bir hata olurdu — ekranda zeminiyle birlikte bir dikdörtgen.
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
 * MOD ZİNCİRİ — ÖLÇÜLEREK KONDU.
 *
 * İlk sürüm yalnızca `chroma` deniyordu. Canlı çalıştırmada 5 görselin beşi de
 * düştü: model magenta zemin üretmemişti (köşe medyanları gri/beyaz ya da
 * soluk pembe, anahtar skoru 0-37, eşik 87). Sonuç: hiçbir parça bağlanmadı ve
 * video eski siluetlerle render edilecekti.
 *
 * Aynı beş görselde üç mod ölçüldü:
 *   chroma → 0/5 geçti   (zemin magenta değil, silinecek bir şey yok)
 *   matte  → 5/5 geçti   (kenardan taşma-doldurma; zemin ne renk olursa olsun)
 *   ink    → 3/5 geçti   (parlaklıktan alfa; koyu zeminli görselde çöküyor)
 *
 * İKİNCİ tur magenta'yı tamamen bitirdi: model bu sefer magenta'yı ZEMİNE
 * değil ÖZNENİN İÇİNE koydu (kenar medyanı 0/-5, MERKEZ medyanı 16/42) ve
 * kesilen parçalarda opak piksellerin %82'si pembeydi. Prompt artık düz BEYAZ
 * stüdyo zemini istiyor, sıra da ona göre: matte önce.
 *
 * DİKKAT — YEDEK MOD BEDAVA DEĞİL. Sayısal kapıyı geçmek kesiğin DOĞRU olduğu
 * anlamına gelmiyor: 1. turda matte'in geçirdiği 5 parçanın yalnızca 2'si
 * görsel olarak kullanılabilirdi. Bu yüzden beklenen mod dışında bir mod
 * kazandığında adım yüksek sesle uyarıyor.
 *
 * ============ 5. TUR: ZEMİN VARSAYIMININ TAMAMI ÇÖKTÜ ============
 *
 * matte, chroma ve ink'in ÜÇÜ DE aynı şeye bel bağlıyor: modelin tekdüze bir
 * zemin ürettiğine. 5. turda o varsayım ölçülüp yıkıldı — beş görselin beşinde
 * dış %4 şeridinde kenar-beyaz oranı %0.0, kenar ortalaması yaşlanmış kağıt
 * (RGB 213/193/160 gibi) ve görüntünün TAMAMI dolu bir arşiv sayfası. Zemin
 * yoksa kenardan taşma-doldurmanın sileceği bir şey de yok: `matte` sayısal
 * kapıyı geçip DİKDÖRTGENİN TAMAMINI bağladı ve kompoze kare çerçeve içinde
 * çerçeve içinde çerçeve olarak çıktı.
 *
 * Bu yüzden zincirin başına `seg` geldi: zeminden bağımsız çalışır, çünkü
 * zemini silmez — ÖZNEYİ bulur. Gerekçesi ve ölçümü `pipeline/segment.py`.
 */
const MODES = ['seg', 'matte', 'chroma', 'ink'];

/**
 * BEKLENEN MOD `seg`.
 *
 * Diğer üçü artık YEDEK: yalnızca rembg/onnxruntime kurulu değilse ya da model
 * inemediyse devreye girerler. O durumda uyarı yüksek sesle basılır, çünkü
 * 5. turda ölçüldü ki bu görsellerde matte'in "geçmesi" kesildiğini değil,
 * hiçbir şeyin silinmediğini gösteriyor.
 */
const EXPECTED_MODE = 'seg';

async function cutout(src, dst) {
  const problems = [];
  for (const mode of MODES) {
    try {
      const {stdout} = await run(
        'python3',
        [path.join(ROOT, 'pipeline', 'cutout.py'), src, dst, '--mode', mode, '--no-halftone', '--strict'],
        {cwd: ROOT},
      );
      return {line: stdout.trim(), mode};
    } catch (e) {
      problems.push(`${mode}: ${String(e.stdout || e.stderr || e.message).trim().split('\n').pop()}`);
    }
  }
  throw new Error(problems.join(' | '));
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
  const fallbacks = [];

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
        const {line, mode} = await cutout(raw, dst);
        pieces.push({src: `collage/${row.file}-${p.slot}.png`, role: p.role});
        // Beklenen mod dışında biri kazandıysa prompt tutmamış: yüksek sesle söyle.
        console.log(`  ${line}${mode === EXPECTED_MODE ? '' : `   << YEDEK MOD (${mode}) — segmentasyon çalışmadı`}`);
        if (mode !== EXPECTED_MODE) fallbacks.push(`${row.file}-${p.slot} → ${mode}`);
      } catch (e) {
        // Üç mod da düştü: parça BAĞLANMAZ. Bağlamak, ekranda zeminiyle
        // birlikte bir dikdörtgen ya da görünmez bir katman demek olurdu.
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
  if (fallbacks.length) {
    console.log(`\nYEDEK MOD KULLANILDI (${fallbacks.length}) — bu parçalarda zemin düz BEYAZ değildi:`);
    for (const f of fallbacks) console.log(`  ${f}`);
    console.log(`  Sayısal kapıyı geçmek kesiğin DOĞRU olduğu anlamına gelmiyor: ölçümde`);
    console.log(`  matte'in geçtiği 5 parçanın yalnızca 2'si görsel olarak kullanılabilirdi.`);
    console.log(`  Bu parçalara GÖZLE bak; çoğu böyleyse düzeltilecek yer prompt.`);
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
