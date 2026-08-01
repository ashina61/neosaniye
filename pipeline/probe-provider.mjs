#!/usr/bin/env node
/**
 * SAĞLAYICI SONDASI — "PROMT GERÇEKTEN KULLANILIYOR MU?"
 *
 * ============ NEDEN VAR ============
 *
 * Kullanıcı iki tur üst üste aynı görseli aldı, oysa promt arada değişmişti,
 * ve şunu söyledi: "bizim promtu yapay zekalar kullanmıyor."
 *
 * Bu bir tahminle kapatılacak soru değil. İki muhtemel sebep var ve ikisi de
 * FARKLI çözüm istiyor:
 *
 *   A) promt kesiliyor  → çözüm: promtu kısalt (yapıldı, 2373 → 499)
 *   B) promt hiç kullanılmıyor → çözüm: sağlayıcıyı değiştir
 *
 * Ölçüm bu ikisini ayırt etmeden yapılan her düzeltme kör atış olur. Bu depoda
 * kör atış zaten iki tur harcadı.
 *
 * ============ DENEY ============
 *
 * AYNI SEED, BİRBİRİNDEN OLABİLDİĞİNCE UZAK İKİ KISA PROMT.
 *
 * Seed'in sabit olması kritik: değişkeni tek bırakıyor. İki kare
 *   · BİREBİR AYNIYSA  → promt hiç okunmuyor (B)
 *   · FARKLIYSA        → promt okunuyor, sorun uzunlukta ya da içerikte (A)
 *
 * Üçüncü bir çağrı UZUN promtla yapılıyor: kısa promtla aynı özneyi isteyip
 * farklı sonuç alıyorsak, aradaki fark uzunluğun kendisidir.
 *
 * Karşılaştırma GÖZLE değil BAYT ile: iki dosyanın SHA-256'sı aynıysa tartışma
 * biter. Gözle bakmak "bana benzer geldi" ile sonuçlanır ve bu depo o hatayı
 * zaten yaptı.
 *
 * AĞA ÇIKAR. Yalnızca elle çalıştırılır ve yalnızca 3 görsel üretir.
 */

import {writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const OUT = path.resolve(import.meta.dirname, '..', 'out', 'probe');
const SEED = 424242;

/** Birbirinden olabildiğince uzak iki kısa promt. */
const A = 'A flat overhead scan of one sheet of aged cream newsprint, empty, no objects.';
const B = 'A close-up photograph of a bright yellow banana on a blue table.';
/** Aynı özne, ama bu deponun tam uzunluktaki promt gövdesi kadar uzun. */
const LONG = `${A} ${'Additional documentary collage styling instructions follow. '.repeat(28)}`;

async function fetchImage(prompt) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=512&height=512&seed=${SEED}&nologo=true&model=flux`;
  const r = await fetch(url, {headers: {accept: 'image/png,image/jpeg'}});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function main() {
  await mkdir(OUT, {recursive: true});
  const cases = [
    ['a-kagit', A],
    ['b-muz', B],
    ['c-uzun', LONG],
  ];

  const results = [];
  for (const [name, prompt] of cases) {
    try {
      const buf = await fetchImage(prompt);
      const file = path.join(OUT, `${name}.png`);
      await writeFile(file, buf);
      results.push({name, hash: sha(buf), bytes: buf.length, chars: prompt.length});
      console.log(`${name.padEnd(9)} ${buf.length} bayt  sha ${sha(buf)}  promt ${prompt.length} krk`);
    } catch (e) {
      console.log(`${name.padEnd(9)} BAŞARISIZ — ${String(e.message).slice(0, 90)}`);
      results.push({name, hash: null});
    }
  }

  console.log('\n================ HÜKÜM ================');
  const [a, b, c] = results;
  if (!a?.hash || !b?.hash) {
    console.log('Sonuçsuz: çağrılar başarısız oldu, sağlayıcıya ulaşılamıyor.');
    return;
  }
  if (a.hash === b.hash) {
    console.log('PROMT KULLANILMIYOR.');
    console.log('  Kağıt ile muz AYNI kareyi verdi. Promtu kısaltmak bu sağlayıcıda');
    console.log('  hiçbir şeyi değiştirmez; sağlayıcı değişmeli.');
  } else {
    console.log('PROMT KULLANILIYOR — kağıt ile muz farklı kareler verdi.');
    if (c?.hash && c.hash === a.hash) {
      console.log('  Uzun promt KISA promtla aynı sonucu verdi: kuyruk okunmuyor,');
      console.log('  yani KESİLME doğrulandı. Kısa promt doğru çözüm.');
    } else if (c?.hash) {
      console.log('  Uzun promt farklı sonuç verdi: kuyruk da okunuyor.');
      console.log('  Sorun uzunlukta değil, promtun İÇERİĞİNDE.');
    }
  }
  console.log('\nGörseller: out/probe/ — gözle de bak, hash tek başına ton farkını göstermez.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
