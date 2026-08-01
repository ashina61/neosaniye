#!/usr/bin/env node
/**
 * OTOMATİK KONU SEÇİCİ
 *
 * ============ NE YAPAR ============
 *
 * `content/story-*.json` dosyalarını tarar, sıradaki konuyu seçer ve YOLUNU
 * basar. `render.yml` bunu `topic: auto` girdisiyle çağırıp çıktısını
 * `build-storyboard.mjs`e verir — yani Actions'ı çalıştırmak için artık dosya
 * adı yazmak gerekmiyor.
 *
 * AĞA ÇIKMAZ, API ÇAĞIRMAZ, KONU UYDURMAZ. Yaptığı tek şey, zaten depoda duran
 * konular arasından SIRADAKİNİ seçmek.
 *
 * ============ NEDEN KONU ÜRETMİYOR ============
 *
 * "Otomatik konu seçimi"nin cazip yorumu, konuyu bir dil modeline yazdırmak.
 * Bu depo bunu yapamaz ve gerekçesi konu dosyalarının kendi başlığında yazılı:
 * "OLGU KAYDI — bu kanal belgesel iddiasıyla yayın yapıyor". Doğrulanmamış bir
 * anlatıyı otomatik olarak yayına sokmak, kanalın tek iddiasını çürütür.
 *
 * O yüzden seçici üretmiyor, SIRAYA sokuyor; ve sıraya girme koşulu insan
 * denetimi:
 *
 *   "status": "ready"  → sıraya girer
 *   "status": "draft"  → ATLANIR, listede "beklemede" olarak görünür
 *   status yok         → ready sayılır (elle yazılmış eski dosyalar)
 *
 * Depoya sekiz taslak konu kondu (Çernobil, Apollo 13, Vasa, Pompeii,
 * Antikythera, Roanoke, Tacoma, radyum kızları). Hepsi `draft`: olgularını
 * doğrulayıp `ready` yapmak insanın işi, seçicinin değil.
 *
 * ============ TEKRARI NASIL ÖNLÜYOR ============
 *
 * İki mekanizma, çünkü ikisinin de tek başına deliği var:
 *
 *   1. DEFTER — `data/used-topics.json`. Üretilen konu buraya yazılır ve bir
 *      daha seçilmez. Tam çözüm ama Actions'ta ÇALIŞMAZ: workflow'un
 *      `permissions: contents: read` ve commit atmıyor, yani koşu bitince
 *      defter kayboluyor. Defteri yerelde `--mark` ile güncelleyip commit'lemek
 *      gerekiyor.
 *
 *   2. ROTASYON — `--rotate=<n>`. Defter yoksa `n % konu_sayısı` ile seçer.
 *      Workflow buraya `github.run_number` veriyor: durum tutmadan, commit
 *      gerektirmeden her koşuda başka konu. Actions'ta gerçekten çalışan yol
 *      bu.
 *
 * ============ KULLANIM ============
 *
 *   node pipeline/pick-topic.mjs --list        → sırayı yazdır, seçim yapma
 *   node pipeline/pick-topic.mjs               → sıradakini seç, yolunu bas
 *   node pipeline/pick-topic.mjs --rotate=17   → 17. koşunun konusu
 *   node pipeline/pick-topic.mjs --mark vasa   → deftere "üretildi" yaz
 *   node pipeline/pick-topic.mjs --ready vasa  → taslağı sıraya sok (İNSAN ONAYI)
 *   node pipeline/pick-topic.mjs --hold vasa   → sıradan çıkar, taslağa geri al
 *   node pipeline/pick-topic.mjs --any         → taslakları da aday say
 */

import {readFile, writeFile, mkdir, readdir, appendFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const LEDGER = path.join(ROOT, 'data', 'used-topics.json');

/** `content/story-db-cooper.json` → `db-cooper`. */
function slugOf(file) {
  return path.basename(file, '.json').replace(/^story-/, '');
}

async function loadTopics() {
  const files = (await readdir(CONTENT))
    .filter((f) => /^story-.+\.json$/.test(f))
    .sort();
  const out = [];
  for (const f of files) {
    let raw;
    try {
      raw = JSON.parse(await readFile(path.join(CONTENT, f), 'utf8'));
    } catch (e) {
      // Bozuk bir dosya bütün sırayı düşürmemeli; adı raporda görünsün yeter.
      out.push({slug: slugOf(f), file: f, broken: String(e.message)});
      continue;
    }
    out.push({
      slug: slugOf(f),
      file: f,
      title: raw.title ?? '(başlıksız)',
      // status YOKSA ready: bu depodaki iki elle yazılmış konu böyle ve onları
      // geriye dönük olarak beklemeye almak, çalışan hattı durdururdu.
      status: raw.status ?? 'ready',
      words: String(raw.narration ?? '').trim().split(/\s+/).filter(Boolean).length,
    });
  }
  return out;
}

async function loadLedger() {
  if (!existsSync(LEDGER)) return {used: []};
  try {
    const j = JSON.parse(await readFile(LEDGER, 'utf8'));
    return {used: Array.isArray(j.used) ? j.used : []};
  } catch {
    return {used: []};
  }
}

/**
 * ADAYLAR — üretilebilir konular.
 *
 * `words === 0` olan dosya sıraya GİRMEZ: anlatısı boş bir konuyu seçmek,
 * derleyiciyi hata verdirmek demek ve hata koşunun 20. dakikasında değil
 * burada, bir satırda görünmeli.
 */
function candidates(topics, {any}) {
  return topics.filter((t) => !t.broken && t.words > 0 && (any || t.status === 'ready'));
}

function pick(list, ledger, rotate) {
  const usedSlugs = ledger.used.map((u) => (typeof u === 'string' ? u : u.slug));
  const fresh = list.filter((t) => !usedSlugs.includes(t.slug));
  if (fresh.length) {
    // Defter varsa "hiç üretilmemiş ilk konu"; yoksa rotasyon.
    if (usedSlugs.length === 0 && rotate !== null) {
      return {topic: fresh[rotate % fresh.length], why: `rotasyon (${rotate} mod ${fresh.length})`};
    }
    return {topic: fresh[0], why: usedSlugs.length ? 'defterde yok' : 'sıradaki'};
  }
  // Hepsi üretilmiş: EN ESKİ üretilene dön. Sıra biterse durmak yerine
  // döngüye girmek doğru davranış — kanalın konusu bitmez, sırası biter.
  const order = new Map(usedSlugs.map((s, i) => [s, i]));
  const oldest = [...list].sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0))[0];
  return {topic: oldest, why: 'sıra tamamlandı, en eskiye dönüldü'};
}

function report(topics, list) {
  console.log('\nKONU SIRASI');
  console.log(`  ${'konu'.padEnd(18)} ${'durum'.padEnd(10)} ${'kelime'.padStart(6)}   başlık`);
  for (const t of topics) {
    if (t.broken) {
      console.log(`  ${t.slug.padEnd(18)} ${'BOZUK'.padEnd(10)} ${''.padStart(6)}   ${t.broken}`);
      continue;
    }
    const state = t.words === 0 ? 'anlatısız' : t.status === 'ready' ? 'hazır' : 'beklemede';
    console.log(`  ${t.slug.padEnd(18)} ${state.padEnd(10)} ${String(t.words).padStart(6)}   ${t.title}`);
  }
  console.log(`\n  ${list.length} konu üretilebilir, ${topics.length - list.length} tanesi değil.`);
}

/**
 * TASLAĞI SIRAYA SOK.
 *
 * Elle JSON düzenlemek yerine tek komut, çünkü sürtünme burada otomasyonu
 * durduruyordu: havuzda on konu var, ikisi hazır, sekizi elle açılmayı
 * bekliyor. Yaptığı iş yalnızca `status` alanını çevirmek — OLGULARI
 * DOĞRULAMAZ ve doğrulayamaz. Onay insanın imzasıdır; bu komut o imzayı
 * atmayı kolaylaştırır, yerine geçmez.
 */
async function setStatus(slug, status) {
  const file = path.join(CONTENT, `story-${slug}.json`);
  if (!existsSync(file)) {
    console.error(`böyle bir konu yok: ${slug}`);
    process.exit(2);
  }
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const before = raw.status ?? 'ready';
  raw.status = status;
  await writeFile(file, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`${slug}: ${before} → ${status}`);
  if (status === 'ready') {
    console.log('  Olguları senin doğruladığını varsayıyor. Bu komut doğrulama YAPMAZ.');
  }
}

async function mark(slug) {
  const topics = await loadTopics();
  if (!topics.some((t) => t.slug === slug)) {
    console.error(`böyle bir konu yok: ${slug}`);
    process.exit(2);
  }
  const ledger = await loadLedger();
  ledger.used = ledger.used.filter((u) => (typeof u === 'string' ? u : u.slug) !== slug);
  ledger.used.push({slug, at: new Date().toISOString().slice(0, 10)});
  await mkdir(path.dirname(LEDGER), {recursive: true});
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`deftere yazıldı: ${slug} (${ledger.used.length} konu üretilmiş)`);
  console.log('NOT: defter ancak COMMIT EDİLİRSE kalıcı. Actions bu dosyayı yazamaz.');
}

async function main() {
  const args = process.argv.slice(2);
  const markAt = args.indexOf('--mark');
  if (markAt >= 0) return mark(args[markAt + 1]);
  const readyAt = args.indexOf('--ready');
  if (readyAt >= 0) return setStatus(args[readyAt + 1], 'ready');
  const holdAt = args.indexOf('--hold');
  if (holdAt >= 0) return setStatus(args[holdAt + 1], 'draft');

  const any = args.includes('--any');
  const rotArg = args.find((a) => a.startsWith('--rotate='));
  const rotRaw = rotArg ? Number.parseInt(rotArg.slice('--rotate='.length), 10) : NaN;
  const rotate = Number.isFinite(rotRaw) && rotRaw >= 0 ? rotRaw : null;

  const topics = await loadTopics();
  const list = candidates(topics, {any});

  if (args.includes('--list')) {
    report(topics, list);
    return;
  }

  if (!list.length) {
    report(topics, list);
    console.error(
      '\nÜRETİLEBİLİR KONU YOK.\n' +
        '  Taslakları sıraya sokmak için konu dosyasında olguları doğrulayıp\n' +
        '  "status": "draft" satırını "status": "ready" yap.\n' +
        '  Denemelik bir koşu için: --any (taslakları da aday sayar).',
    );
    process.exit(2);
  }

  const ledger = await loadLedger();
  const {topic, why} = pick(list, ledger, rotate);
  const rel = `content/${topic.file}`;

  report(topics, list);
  console.log(`\n  SEÇİLDİ: ${topic.slug} — ${why}`);
  console.log(`  ${topic.title}`);
  if (topic.status !== 'ready') {
    console.log('  UYARI: bu konu TASLAK. Olguları doğrulanmadı.');
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `topic=${rel}\nslug=${topic.slug}\n`);
  }
  // Son satır SADECE yol: `$(node pipeline/pick-topic.mjs | tail -1)` çalışsın.
  console.log(rel);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
