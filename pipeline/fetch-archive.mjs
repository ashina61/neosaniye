#!/usr/bin/env node
/**
 * ARŞİV FOTOĞRAFI KOLU — Wikimedia Commons + Library of Congress
 *
 * NEDEN BU VAR
 *
 * Tempo ölçümü şu duvara çarptı: olay aralığı 0.90 saniye, referans 0.66. Fark
 * parametreyle kapanmıyor, çünkü ölçüm eşiği "karenin %6'sı değişti mi" diye
 * bakıyor ve o da yaklaşık 350x350 piksellik bir olay demek. Referans videoda
 * her sahnede altı-sekiz GERÇEK BOYUTLU kolaj parçası var; bizde bir-iki parça
 * artı çizgi resim. Yani eksik olan hareket değil, MALZEME.
 *
 * Üretim modeli tarafı bu boşluğu kapatamadı: sağlayıcı zinciri bu geliştirme
 * konteynerinde ağ politikası yüzünden erişilemez, CI'da ise cutout adımı
 * 27-33 saniyede bitiyor (yani üretim değil, ret). Arşiv kataloğunun üç avantajı
 * var ve üçü de bu hattın gerçek kısıtlarına denk düşüyor:
 *
 *   · ANAHTAR YOK, KOTA YOK — hiçbir sır gerekmiyor
 *   · GERÇEK fotoğraf — "1976'da bir kano" cümlesine gerçekten o dönemin
 *     fotoğrafı geliyor, modelin uydurduğu bir şey değil
 *   · LİSANS BELLİ — kamu malı ya da CC, ve bu betik atıf kaydını tutuyor
 *
 * LİSANS CİDDİYE ALINIYOR
 * CC BY ve CC BY-SA atıf ZORUNLU kılar. Bu betik her indirdiği dosyanın
 * lisansını, yazarını ve kaynak sayfasını `content/credits.json`e yazar.
 * Lisansı tanınamayan sonuç ATLANIR — "muhtemelen serbesttir" diye indirmek
 * telif ihlalidir. Yayın açıldığında video açıklamasına bu dosyadan atıf
 * konulmak zorunda.
 *
 * VARSAYILAN PROVA
 * Ağa çıkmak açık istek gerektiriyor (AGENTS.md). Varsayılan modda yalnızca
 * hangi sahne için hangi sorgunun atılacağını yazar. Gerçek indirme `--live`.
 */

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import process from 'node:process';
import {searchFor} from './subject.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'archive');
const CREDITS = path.join(ROOT, 'content', 'credits.json');

/** Fotoğraf gösterebilen şablonlar. */
const WANTS_IMAGE = new Set([
  'hero_cutout',
  'wide_establish',
  'headline_card',
  'star_field',
  'pull_quote',
  'labeled_diagram',
  'split_compare',
]);

/**
 * Wikimedia her istemciden kendini tanıtan bir User-Agent bekliyor; koymayan
 * istemciler 403 alıyor. Bu bir nezaket değil, API şartı.
 */
const UA = 'NeoSaniyeFactory/1.0 (archival research; https://github.com/ashina61/neosaniye)';

/**
 * Kabul edilen lisanslar.
 *
 * DİKKAT — "NoDerivatives" (ND) ve "NonCommercial" (NC) KABUL EDİLMİYOR:
 * ND türev çalışmayı yasaklar ve biz fotoğrafı kesip kolaja koyuyoruz, yani
 * türev üretiyoruz. NC ise YouTube'da para kazanan bir kanalda kullanılamaz.
 * İkisini de "CC var, olur" diye geçirmek en sık yapılan lisans hatası.
 */
const OK_LICENCE = /(public domain|^pd|pd-|cc0|cc[ -]by(?:[ -]sa)?)/i;
const BAD_LICENCE = /(nd\b|noderiv|nc\b|noncommercial)/i;

function licenceOk(name) {
  const s = String(name || '');
  if (!s) return false;
  if (BAD_LICENCE.test(s)) return false;
  return OK_LICENCE.test(s);
}

/** HTML etiketlerini sök: extmetadata alanları HTML parçası döndürüyor. */
function plain(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* KAYNAK 1 — Wikimedia Commons                                        */
/* ------------------------------------------------------------------ */


/**
 * ============ SORGUDA KONUNUN ADI HİÇ GEÇMİYORDU ============
 *
 * Kullanıcı tam render aldı ve "fotoğraflar alakasız geliyor" dedi. Sebep iki
 * eksikti ve ikisi birlikte çalışıyor:
 *
 * 1. SORGU KONUYU TAŞIMIYORDU. `searchFor` yalnızca cümlenin nesnesini veriyor:
 *    "attendant 1971 historical photograph". Bu sorgunun D.B. Cooper ile hiçbir
 *    bağı yok. Wikimedia tam metin araması o kelimeleri üstünkörü içeren her
 *    şeyi döndürür — yani 1971 anlatısına rastgele 1971 fotoğrafları geliyordu.
 *
 * 2. ALAKA DENETİMİ YOKTU. Dönen ne olursa olsun `hits[seed % 3]` alınıyordu.
 *    Kod hiçbir yerde "bu görsel gerçekten aradığım şey mi" diye sormuyordu.
 *
 * Çıpa konu dosyasının `subject` alanından gelir; yoksa dosya adının
 * slug'ından türetilir ("story-db-cooper.json" → "db cooper"). Slug bir yedek,
 * tercih değil: `subject` insanın yazdığı arama terimidir ("D. B. Cooper
 * hijacking") ve katalogda slug'dan belirgin şekilde iyi çalışır.
 */
function anchorOf(sb) {
  if (sb.subject) return String(sb.subject).trim();
  const src = String(sb.source ?? sb.topic ?? sb.title ?? '');
  const m = src.match(/story-([a-z0-9-]+)\.json/i);
  return m ? m[1].replace(/-/g, ' ') : '';
}

function anchored(q, anchor) {
  if (!q) return q;
  return anchor ? `${anchor} ${q}` : q;
}

/**
 * Sorgunun HER sonucunda geçen, dolayısıyla hiçbir şey ayırt etmeyen kelimeler.
 * Yıl da burada sayılmıyor: "1971" araması yapılınca dönen her sonuçta var.
 */
const GENERIC = new Set(['historical', 'photograph', 'photo', 'engraving', 'portrait', 'archival', 'the', 'and', 'of']);

function keyWords(t) {
  return String(t)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC.has(w) && !/^\d{1,4}$/.test(w));
}

/** Dönen başlık sorgunun AYIRT EDİCİ kelimelerinden en az birini taşıyor mu? */
function overlaps(title, query) {
  const q = new Set(keyWords(query));
  return keyWords(title).some((w) => q.has(w));
}

async function searchCommons(query) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '1400',
    });
  const r = await fetch(url, {headers: {'user-agent': UA}});
  if (!r.ok) throw new Error(`commons HTTP ${r.status}`);
  const j = await r.json();
  const pages = Object.values(j?.query?.pages ?? {});
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    const licence = plain(meta.LicenseShortName?.value);
    if (!licenceOk(licence)) continue;
    // Küçük dosyalar 1080 genişlikte bulanık kalır.
    if ((ii.width ?? 0) < 700) continue;
    out.push({
      source: 'wikimedia-commons',
      title: p.title,
      // thumburl ölçeklenmiş sürüm: özgün dosya 40 MB olabiliyor.
      url: ii.thumburl || ii.url,
      width: ii.thumbwidth || ii.width,
      height: ii.thumbheight || ii.height,
      licence,
      author: plain(meta.Artist?.value) || plain(meta.Credit?.value) || 'bilinmiyor',
      page: ii.descriptionurl,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* KAYNAK 2 — Library of Congress                                      */
/* ------------------------------------------------------------------ */

async function searchLoc(query) {
  const url =
    'https://www.loc.gov/photos/?' +
    new URLSearchParams({q: query, fo: 'json', c: '10', at: 'results'});
  const r = await fetch(url, {headers: {'user-agent': UA}});
  if (!r.ok) throw new Error(`loc HTTP ${r.status}`);
  const j = await r.json();
  const out = [];
  for (const it of j?.results ?? []) {
    const img = Array.isArray(it.image_url) ? it.image_url[it.image_url.length - 1] : it.image_url;
    if (!img) continue;
    /**
     * LoC'un `rights` alanı serbest metin ve çoğu koleksiyon "no known
     * restrictions" diyor. Tanınmayan hiçbir şey geçirilmiyor: kütüphane
     * kataloğunda olması kamu malı olduğu anlamına GELMEZ.
     */
    const rights = plain(it.rights_advisory ?? it.rights ?? '');
    const free = /no known restrictions|public domain/i.test(rights);
    if (!free) continue;
    out.push({
      source: 'library-of-congress',
      title: it.title ?? 'bilinmiyor',
      url: img.startsWith('http') ? img : `https:${img}`,
      width: 0,
      height: 0,
      licence: rights,
      author: (it.contributor ?? []).join(', ') || 'bilinmiyor',
      page: it.id ?? it.url,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

/**
 * İndirilen fotoğrafı kolaj parçasına çevir.
 *
 * MOD SEÇİMİ ÖNEMLİ ve burası ARŞİV için en kritik yer.
 *
 * Eski hâli `matte` kullanıyordu: kenardan taşma-doldurma, yani ancak zemin
 * gerçekten düzse çalışır. Arşiv fotoğrafında zemin ASLA düz değildir — gerçek
 * bir sahne, bir oda, bir pist, bir kalabalık. Yani bu yol pratikte hep
 * "dikdörtgen baskı"ya düşüyordu.
 *
 * `seg` (rembg / isnet-general-use) tam bu iş için doğru araç: zemin ne olursa
 * olsun özneyi bulur. 5. turun görsellerinde ölçüldü — üç parçada da dış çeper
 * %0.0, kaplama %17.7 / %36.6 / %62.6. Zincir seg → matte, çünkü segmentasyon
 * kurulu değilse eski davranış aynen sürsün.
 *
 * `--strict` KULLANILMIYOR ve bu bilinçli: alfa çıkmazsa fotoğraf DİKDÖRTGEN
 * kalır ve bu bir kusur değil. Referans kolajlarda arşiv baskıları zaten krem
 * kenarlı dikdörtgen olarak yapıştırılmış duruyor; `Cutout` bileşeni sticker
 * konturunu ve katman gölgesini o dikdörtgene de uyguluyor.
 */
async function toCollagePiece(rawPath, outPath) {
  const problems = [];
  for (const mode of ['seg', 'matte']) {
    try {
      const {stdout} = await run('python3', [
        path.join(ROOT, 'pipeline', 'cutout.py'),
        rawPath,
        outPath,
        '--mode',
        mode,
      ]);
      return `kesildi (${mode}): ${stdout.trim()}`;
    } catch (e) {
      problems.push(e);
    }
  }
  {
    const e = problems[problems.length - 1];
    // Kesilemedi → dikdörtgen baskı olarak kullan. cutout.py yine PNG yazmış
    // olabilir; yazmadıysa ham dosyayı kopyala.
    if (!existsSync(outPath)) {
      const {copyFile} = await import('node:fs/promises');
      await copyFile(rawPath, outPath);
    }
    const msg = String(e.stderr || e.message).split('\n')[0].slice(0, 90);
    return `dikdörtgen baskı (kesim yok: ${msg})`;
  }
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
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }
  const sb = JSON.parse(await readFile(sbPath, 'utf8'));

  const targets = sb.scenes
    // `sb.era` İKİNCİ ARGÜMAN: cümlede yıl yoksa sorgunun aracı (fotoğraf mı
    // gravür mü) anlatının dönemine göre seçilsin. Bu olmadan 1628 konusu
    // katalogdan "warship 1628 historical photograph" istiyordu.
    .map((s, i) => ({s, i, q: anchored(searchFor((s._beat?.text ?? s.payload?.headline ?? '').replace(/[*"]/g, ''), sb.era), anchorOf(sb))}))
    .filter(({s, i, q}) => WANTS_IMAGE.has(s.template) && q && (!only.length || only.includes(i + 1)));

  console.log(`${sb.scenes.length} sahne · ${targets.length} tanesi için arşiv sorgusu var`);
  console.log(`mod: ${live ? 'CANLI (ağa çıkar)' : 'PROVA (ağa çıkmaz)'}\n`);

  if (!live) {
    for (const {s, i, q} of targets) {
      console.log(`sahne ${String(i + 1).padStart(2)} (${s.template.padEnd(16)}) → "${q}"`);
    }
    const skipped = sb.scenes
      .map((s, i) => ({s, i, q: anchored(searchFor(s._beat?.text ?? '', sb.era), anchorOf(sb))}))
      .filter(({s, q}) => WANTS_IMAGE.has(s.template) && !q);
    if (skipped.length) {
      console.log(`\nsomut nesnesi olmayan ${skipped.length} sahne atlanıyor (uydurma görsel yerine kod çizimi):`);
      for (const {s, i} of skipped) console.log(`  sahne ${i + 1} (${s.template}) — ${JSON.stringify(s._beat?.text ?? '')}`);
    }
    console.log('\nGerçekten indirmek için: node pipeline/fetch-archive.mjs --live');
    return;
  }

  await mkdir(OUT_DIR, {recursive: true});
  const credits = [];
  let ok = 0;

  for (const {s, i, q} of targets) {
    let picked = null;
    for (const [name, search] of [
      ['commons', searchCommons],
      ['loc', searchLoc],
    ]) {
      try {
        const hits = await search(q);
        if (hits.length) {
          // Deterministik seçim: sahne seed'i ilk üç sonuç arasından seçer.
          // Hep ilkini almak aynı fotoğrafın birden çok sahnede çıkmasına yol
          // açıyor; rastgele seçim ise render'ı deterministik olmaktan çıkarır.
          // ALAKA KAPISI: dönen başlık sorgunun ayırt edici kelimelerinden
          // hiçbirini taşımıyorsa o sonuç bu sahneye ait değildir. Eskiden
          // böyle bir denetim YOKTU ve "alakasız fotoğraf" tam buradan geldi.
          const relevant = hits.filter((h) => overlaps(h.title, q));
          if (!relevant.length) {
            console.log(`  sahne ${i + 1}: ${name} — ${hits.length} sonuç, hiçbiri alakalı değil, REDDEDİLDİ`);
            continue;
          }
          picked = relevant[s.seed % Math.min(3, relevant.length)];
          console.log(`  sahne ${i + 1}: ${name} → ${picked.title} [${picked.licence}]`);
          break;
        }
        console.log(`  sahne ${i + 1}: ${name} sonuç yok (lisans süzgecinden sonra)`);
      } catch (e) {
        console.log(`  sahne ${i + 1}: ${name} başarısız — ${String(e.message).slice(0, 120)}`);
      }
    }
    if (!picked) continue;

    try {
      const r = await fetch(picked.url, {headers: {'user-agent': UA}});
      if (!r.ok) throw new Error(`indirme HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      const raw = path.join(OUT_DIR, `.raw-${String(i + 1).padStart(2, '0')}`);
      const out = path.join(OUT_DIR, `scene-${String(i + 1).padStart(2, '0')}.png`);
      await writeFile(raw, buf);
      const note = await toCollagePiece(raw, out);
      console.log(`             ${note}`);
      s.payload.images = [`archive/${path.basename(out)}`];
      credits.push({scene: i + 1, query: q, ...picked});
      ok += 1;
    } catch (e) {
      console.log(`  sahne ${i + 1}: indirilemedi — ${String(e.message).slice(0, 120)}`);
    }
  }

  await writeFile(sbPath, `${JSON.stringify(sb, null, 2)}\n`);
  await writeFile(CREDITS, `${JSON.stringify({generated: new Date().toISOString(), items: credits}, null, 2)}\n`);
  console.log(`\n${ok}/${targets.length} arşiv görseli alındı.`);
  console.log(`Atıf kaydı: content/credits.json — CC BY/BY-SA için atıf ZORUNLU, yayın açıklamasına konmalı.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export {licenceOk, plain};
