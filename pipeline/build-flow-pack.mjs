#!/usr/bin/env node
/**
 * GÖRSEL ÜRETİM DEVİR PAKETİ
 *
 * storyboard.json → out/flow-pack/ altında elle görsel modeline atılacak her şey.
 *
 * İKİ YOL, AYNI PAKETTE
 *
 *   B YOLU (VARSAYILAN) — parça parça. Beat başına bir PLAKA (boş zemin) ve
 *   2-4 PARÇA (magenta zeminde tek nesne). Remotion parçaları katman katman
 *   dizer, yani "build-on assembly" KODDA olur.
 *       NN-kind-plate.txt · NN-kind-a.txt … NN-kind-d.txt
 *
 *   A YOLU (YEDEK) — tek bitmiş kare + Google Flow'da i2v. Bir beat için parça
 *   üretmek zahmetliyse bu kullanılır; o sahne build-on yapmaz.
 *       NN-kind-FALLBACK-single-frame.txt · NN-kind-MOTION.txt
 *
 * NEDEN B VARSAYILAN: Flow çıktısı ÖLÇÜLDÜ ve "görseli birebir koru" talimatını
 * tutmuyor — gravür harita renkli haritayla değişti, tarife metni yeniden
 * yazıldı. Parçalar ayrı gelince kamera gerçekten kilitli, tarih ve sayı
 * Remotion'ın çizdiği metinde kalıyor, çıktı deterministik.
 *
 * ORTAK DOSYALAR
 *   ALL-PROMPTS.txt   B yolunun bütün blokları, boş satırla ayrılmış (temiz besleme)
 *   ASSET-LIST.txt    o blokların sırası ↔ kaydedilecek dosya adı
 *   README.txt        adım adım talimat
 *   manifest.json     makine tarafı: beat ↔ dosya eşlemesi (`ingest-collage.mjs` okur)
 *
 * Hangi görselin hangi beat'e ait olduğu karışırsa montaj sırası sessizce
 * bozulur; bu yüzden dosya adları beat sırasını taşıyor ve manifest geri
 * okunabilir.
 *
 * AĞA ÇIKMAZ, ÜCRETLİ ÇAĞRI YAPMAZ. Yalnızca metin üretir.
 */

import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  composedCollagePrompt,
  universalVideoPrompt,
  UNIVERSAL_VIDEO_PROMPT,
  platePrompt,
  piecePrompts,
  eraOf,
} from './collage-prompt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, 'out', 'flow-pack');
const FPS = 30;

/**
 * Hangi beat'ler Flow'a gider, hangileri kodla çizilir?
 *
 * Kod-çizimli şablonlar veri anlarında görsel modelinden DAHA doğru: bir model
 * doğru bir rota oku ya da okunur bir 5/20 ızgarası çizemez. O sahneler
 * Remotion'da kalır. Gerisi — anlatının olgusal/arşiv anları — Flow'a gider.
 */
const CODE_DRAWN = new Set(['map_route', 'grid_scale', 'data_annotate', 'archival_timeline', 'split_compare', 'stick_beat']);

/**
 * ============ GÖRSEL BÜTÇESİ ============
 *
 * Kullanıcının sorusu doğru soruydu: "kaç tane görsel üreteceğiz biliyorsun
 * dimi". Sayıldı ve hat yanlış ölçekte çalışıyordu.
 *
 * 74 saniyelik bir Short = 19 beat. Eski hâl her beat için görsel istiyordu:
 * B yolunda 21 parça, A yolunda 17 kare. Günde 1 Short = ayda 630 görsel.
 * Ölçülen başarı oranı: 7. turda 0/5, 6. turda kesim 5/5 ama ÖZNE 0/5.
 * O ölçekte elle ayıklama imkânsız.
 *
 * Oysa ölçüm başka bir şey daha gösterdi: 15 şablonun 13'ü fotoğrafsız da tam
 * çiziyor (ya tamamen kod, ya prosedürel siluete düşüyor). Yalnızca
 * `collage_build` ve `archive_clip` malzemeye MUHTAÇ. Yani sistem BUGÜN sıfır
 * görselle eksiksiz bir Short üretebiliyor; fotoğraf bir bağımlılık değil,
 * bir YÜKSELTME.
 *
 * Bütçe referansın kendi oranından geliyor (AGENTS.md, ölçülmüş):
 * "referans videonun çekimlerinin yaklaşık ÜÇTE İKİSİNDE hiç fotoğraf yok".
 * 19 beat x 1/3 ≈ 6 fotoğraf/Short — ayda 630 değil, 180.
 */
const PHOTO_BUDGET_RATIO = 1 / 3;

/**
 * Gerçek bir fotoğrafın KODUN ÇİZEMEYECEĞİ şey kattığı şekiller.
 *
 * Dışarıda kalanlar bilinçli: belge, damga, harita, tablo, yıldız — bunları
 * kod daha iyi çiziyor ve ölçüldü (`evidence_board`: tarih, damga, tarife,
 * gravür harita, hepsi kodda ve kusursuz). Onlar için fotoğraf istemek kotayı
 * modelin en kötü olduğu yere harcamak olurdu.
 */
const PHOTO_WORTH = new Set(['figure', 'building', 'vehicle', 'aircraft', 'rail', 'vessel', 'terrain']);

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }
  const sb = JSON.parse(await readFile(sbPath, 'utf8'));
  const story = JSON.parse(await readFile(path.join(ROOT, 'content', 'story.json'), 'utf8'));
  /**
   * Dönem çıpası STORYBOARD'dan çıkarılır, `story.json`'dan değil: yıl genelde
   * yalnızca cold_open'da geçiyor ama her parçanın dönem-doğru olması gerekiyor,
   * ve storyboard hangi konu render ediliyorsa onu taşıyor. Ölçüldü — çıpa
   * olmayınca 1971 anlatısına tişörtlü modern portre geliyor.
   */
  const era = eraOf(sb);

  await rm(PACK, {recursive: true, force: true});
  await mkdir(PACK, {recursive: true});

  const flow = [];
  const code = [];
  let t = 0;

  for (const [i, scene] of sb.scenes.entries()) {
    const seconds = scene.durationInFrames / FPS;
    const row = {
      n: i + 1,
      template: scene.template,
      kind: scene._beat?.kind ?? 'fact',
      text: scene._beat?.text ?? '',
      start: Number(t.toFixed(2)),
      seconds: Number(seconds.toFixed(2)),
    };
    t += seconds;

    if (CODE_DRAWN.has(scene.template)) {
      code.push(row);
    } else {
      row.file = `${pad(row.n)}-${row.kind}`;
      row.shape = scene.payload?.shape ?? null;
      row.needsMaterial = scene.template === 'collage_build' || scene.template === 'archive_clip';
      flow.push(row);
    }
  }

  /**
   * BÜTÇEYİ UYGULA — promt yalnızca seçilen beat'lere yazılır.
   *
   * Sıra: önce malzemeye MUHTAÇ sahneler (onlarsız kare boş kalır), sonra
   * fotoğrafın gerçekten fark yarattığı şekiller. Bütçe dolunca kalanlar
   * prosedürel siluetle çiziliyor — bu bir kayıp değil, referansın kendi oranı.
   */
  const budget = Math.max(1, Math.ceil((flow.length + code.length) * PHOTO_BUDGET_RATIO));
  const ranked = [...flow].sort((a, b) => {
    const score = (r) => (r.needsMaterial ? 2 : PHOTO_WORTH.has(r.shape) ? 1 : 0);
    return score(b) - score(a) || a.n - b.n;
  });
  const chosen = new Set(ranked.slice(0, budget).filter((r) => r.needsMaterial || PHOTO_WORTH.has(r.shape)).map((r) => r.n));

  for (const row of flow) {
    if (!chosen.has(row.n)) continue;
    const beat = {text: row.text, kind: row.kind};
    /**
     * `withText: true` — BU DOSYA FLOW'A GİDİYOR.
     *
     * Metin varsayılan olarak kapalıydı ve gerekçesi ölçülmüştü: bedava uçtaki
     * model okunur harf üretemiyor, şerit çizip üstünü uydurma harfle
     * dolduruyor ("YOOLNI IIILNIIRIGLLLID").
     *
     * Ama o ölçüm BEDAVA UÇ için geçerli. Bu dosya (`NN-kind-FALLBACK-single-
     * frame`) kullanıcının Flow'a elle verdiği promt ve Flow'un okunur harf
     * ürettiği KANITLI: gönderdiği referans karede alt şeritte "FEDERAL POLICE
     * BRIEFING" tertemiz diziliydi. Kapalı tutmak, kanıtlanmış bir yeteneği
     * kullanmamak olurdu — üstelik şerit karenin en editoryal öğesi.
     *
     * Bedava uç hâlâ B yolundan (parçalar) besleniyor ve orada metin YOK.
     */
    row.fallbackPrompt = composedCollagePrompt(beat, story, {era, withText: true});
    row.platePrompt = platePrompt(beat);
    row.pieces = piecePrompts(beat, {era});
  }

  const skipped = flow.filter((r) => !chosen.has(r.n));

  /**
   * DOSYALAR BEAT BAŞINA
   *
   *   NN-kind-plate.txt              boş zemin plakası (B yolu)
   *   NN-kind-a.txt … -d.txt         parçalar, ilki hero (B yolu)
   *   NN-kind-FALLBACK-single-frame  tek bitmiş kare (A yolu)
   *   NN-kind-MOTION.txt             yalnızca A yolunda anlamlı: o beat'in
   *                                  SÜRESİNE göre yazılmış Flow hareket metni.
   *                                  Süre beat'ten geliyor çünkü metin
   *                                  "kurulum %70 / tutuş %30" diyor ve 10
   *                                  saniyelik klibi 4 saniyeye kırpmak ya
   *                                  kurulumu ya da oturmuş kareyi öldürüyor.
   *
   * `assets` listesi ALL-PROMPTS.txt'nin blok sırasıyla BİREBİR aynı sırada
   * tutuluyor — kullanıcının kaydettiği N'inci görselin adı bu listenin
   * N'inci satırı. Sıra kayarsa montaj sessizce bozulur.
   */
  const assets = [];
  // Bütçe dışında kalan beat için promt dosyası YAZILMAZ: yazılırsa üretim
  // adımı onu da kuyruğa alır ve bütçe kağıt üstünde kalır.
  for (const r of flow.filter((x) => x.pieces)) {
    await writeFile(path.join(PACK, `${r.file}-plate.txt`), `${r.platePrompt}\n`);
    assets.push({file: `${r.file}-plate`, n: r.n, role: 'plate', prompt: r.platePrompt});
    for (const p of r.pieces) {
      await writeFile(path.join(PACK, `${r.file}-${p.slot}.txt`), `${p.prompt}\n`);
      assets.push({file: `${r.file}-${p.slot}`, n: r.n, role: p.role, slot: p.slot, prompt: p.prompt});
    }
    await writeFile(path.join(PACK, `${r.file}-FALLBACK-single-frame.txt`), `${r.fallbackPrompt}\n`);
    await writeFile(path.join(PACK, `${r.file}-MOTION.txt`), `${universalVideoPrompt(r.seconds)}\n`);
  }

  // Toplu üretim beslemesi: numaralandırma YOK, bloklar boş satırla ayrılmış.
  // Referans PDF'in "Textify feed" biçimi bu; her blok tek başına çalışır.
  // Adları AYRI dosyada duruyor ki besleme metni kirlenmesin.
  await writeFile(path.join(PACK, 'ALL-PROMPTS.txt'), `${assets.map((a) => a.prompt).join('\n\n')}\n`);

  /**
   * A YOLUNUN PROMTLARI AYRI DOSYADA.
   *
   * ALL-PROMPTS.txt yalnızca B yolunu (plaka + parçalar) taşıyor. 7. turda
   * bu eksik somut bir zarar verdi: artefakta ALL-PROMPTS.txt konmuştu ve
   * A yolu koşmasına rağmen ÜRETİLEN karelerin promtu artefaktta yoktu —
   * "hangi promt bunu üretti" sorusu artefakttan cevaplanamadı.
   */
  await writeFile(
    path.join(PACK, 'FRAME-PROMPTS.txt'),
    `${flow.filter((r) => r.fallbackPrompt).map((r) => r.fallbackPrompt).join('\n\n')}\n`,
  );
  await writeFile(
    path.join(PACK, 'ASSET-LIST.txt'),
    `${assets.map((a, i) => `${String(i + 1).padStart(3)}. ${a.file}.png   (${a.role})`).join('\n')}\n`,
  );
  /**
   * ENGINE BESLEMESİ — kaynak PDF Section 7'nin dosya biçimi.
   *
   * "Each image prompt is one block. Blocks separated by a single blank line.
   * NO numbering, NO headers, NO labels, NO commentary between blocks. Every
   * block fully self-contained." Dosya adı da belgede: [topic-slug]-prompts.txt
   *
   * Bu, beat başına TEK BİTMİŞ KARE üreten akış — engine'in asıl yolu.
   * `ALL-PROMPTS.txt` (parça parça B yolu) yanında duruyor, silinmedi: ikisi
   * farklı sorulara cevap veriyor ve hangisinin kullanılacağı kullanıcının
   * kararı.
   */
  const slug = String(sb.title || 'topic')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  await writeFile(
    path.join(PACK, `${slug}-prompts.txt`),
    `${flow.map((r) => r.fallbackPrompt).join('\n\n')}\n`,
  );
  await writeFile(path.join(PACK, 'UNIVERSAL-VIDEO-PROMPT.txt'), `${UNIVERSAL_VIDEO_PROMPT}\n`);

  const readme = [
    `NEOSANIYE — GÖRSEL ÜRETİM DEVİR PAKETİ`,
    `konu: ${sb.title}`,
    `video süresi: ${(sb.totalFrames / FPS).toFixed(1)} s · ${sb.scenes.length} sahne`,
    ``,
    `═══ B YOLU — PARÇA PARÇA (VARSAYILAN, BUNU KULLAN) ═══`,
    ``,
    `Beat başına 1 PLAKA (boş kağıt zemin) + ${flow.find((r) => r.pieces)?.pieces.length ?? 3} kadar PARÇA`,
    `(düz BEYAZ zeminde tek nesne). Remotion parçaları tek tek, arkadan öne,`,
    `anlatı sırasıyla diziyor — yani kolajın kendi kendini kurması KODDA oluyor.`,
    `Flow'a hiç gerek yok.`,
    ``,
    `1. ALL-PROMPTS.txt içindeki ${assets.length} bloğu görsel modeline ver.`,
    `   Her blok bir görsel. Sıra korunmalı.`,
    `2. Dönen görselleri ASSET-LIST.txt'deki adlarla collage-raw/ altına kaydet.`,
    `   N'inci blok = listenin N'inci satırı. Sıra kayarsa montaj sessizce bozulur.`,
    `3. npm run collage`,
    `   Bu adım parçaların zeminini silip alfa PNG üretiyor (cutout.py, matte`,
    `   modu), plakayı olduğu gibi alıyor ve storyboard'a bağlıyor.`,
    `   Eksik parça sorun değil: o sahne mevcut şablonuyla kodla çizilmeye devam eder.`,
    `4. npm run sheet   (tek kareye bak, 93 dakikalık render'a girmeden)`,
    `5. npm run render`,
    ``,
    `PARÇA PROMT'UNDA DEĞİŞTİRME: "BACKGROUND: blank flat white" cümlesi süs`,
    `değil, alfa çıkarımının TEK dayanağı. Magenta iki canlı çalıştırmada da`,
    `tutmadı — model magenta'yı zemine değil öznenin İÇİNE koydu — ve beyaz`,
    `ölçümle daha güvenilir çıktı.`,
    ``,
    `═══ A YOLU — TEK KARE + GOOGLE FLOW (YEDEK) ═══`,
    ``,
    `Bir beat için parça üretmek zahmetliyse: NN-kind-FALLBACK-single-frame.txt`,
    `tek bitmiş kareyi ister; NN-kind-MOTION.txt o beat'in SÜRESİNE göre yazılmış`,
    `Flow hareket metnidir. Klipleri AYNI ADLA public/clips/ altına .mp4 koy ve`,
    `npm run clips. O sahne build-on yapmaz, yalnızca film katmanı ve sürüklenme alır.`,
    ``,
    `DİKKAT — ÖLÇÜLDÜ: Flow "görseli birebir koru" talimatını tutmuyor. Bir`,
    `denemede gravür harita renkli bir haritayla değişti, tarife içeriği yeniden`,
    `yazıldı ve orijinalde olmayan sayfa kıvrımı eklendi. Çıktıdaki TARİH ve`,
    `SAYILARI gözle kontrol et; anlatımla çelişen bir tarih yanlış bilgi demektir.`,
    `B yolunda bu risk yok, çünkü metni Remotion çiziyor.`,
    ``,
    `GÖRSEL ÜRETİLECEK BEAT'LER (${chosen.size} / ${flow.length + code.length}) — BÜTÇE`,
    `Bütçe referansın kendi oranından: çekimlerin üçte ikisinde hiç fotoğraf yok.`,
    ...flow
      .filter((r) => r.pieces)
      .map(
        (r) =>
          `  ${pad(r.n)}  ${r.start.toFixed(1)}s +${r.seconds.toFixed(1)}s  ${r.kind.padEnd(11)}` +
          ` ${r.pieces.length} parça  ${JSON.stringify(r.text)}`,
      ),
    ``,
    `BÜTÇE DIŞI (${skipped.length}) — prosedürel siluetle çizilecek`,
    ...skipped.map(
      (r) => `  ${pad(r.n)}  ${r.kind.padEnd(11)} şekil=${r.shape ?? '-'}  ${JSON.stringify(r.text)}`,
    ),
    ``,
    `KODLA ÇİZİLEN BEAT'LER (${code.length}) — görsel üretilmez`,
    `Bu sahnelerde görsel modeli doğru olamıyor: rota oku, sayılabilir ızgara,`,
    `grafik, zaman çizelgesi. Remotion çiziyor.`,
    ...code.map((r) => `  ${pad(r.n)}  ${r.start.toFixed(1)}s +${r.seconds.toFixed(1)}s  ${r.template.padEnd(17)} ${JSON.stringify(r.text)}`),
    ``,
  ].join('\n');
  await writeFile(path.join(PACK, 'README.txt'), readme);

  await writeFile(
    path.join(PACK, 'manifest.json'),
    `${JSON.stringify({title: sb.title, fps: FPS, flow, code, assets}, null, 2)}\n`,
  );

  const budgeted = flow.filter((r) => r.pieces);
  const pieceCount = budgeted.reduce((s, r) => s + r.pieces.length, 0);
  const total = flow.length + code.length;
  console.log(`paket yazıldı: out/flow-pack/`);
  console.log(`  beat                : ${total}`);
  console.log(`  GÖRSEL BÜTÇESİ      : ${budgeted.length} beat (${Math.round((budgeted.length / total) * 100)}%) — hedef ~%33`);
  console.log(`  bütçe dışı          : ${skipped.length} beat, prosedürel siluetle çizilecek`);
  console.log(`  kodla çizilen       : ${code.length} beat (${[...new Set(code.map((c) => c.template))].join(', ')})`);
  console.log(`  B yolu varlıkları   : ${budgeted.length} plaka + ${pieceCount} parça = ${assets.length} görsel`);
  console.log(`  A yolu kareleri     : ${budgeted.length}`);
  // Örnekler BÜTÇEDEKİ ilk beat'ten: bütçe dışı beat'in promtu yok.
  const sample = budgeted[0];
  if (sample) {
    console.log(`\nÖrnek plaka (${sample.file}-plate):\n`);
    console.log(sample.platePrompt);
    console.log(`\nÖrnek hero parçası (${sample.file}-a):\n`);
    console.log(sample.pieces[0]?.prompt);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
