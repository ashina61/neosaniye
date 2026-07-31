import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const CUTOUT = path.join(ROOT, 'pipeline', 'cutout.py');

/**
 * CUTOUT TESTLERİ
 *
 * Sentetik fikstürler Python tarafında üretiliyor (numpy zaten gerekli), sonra
 * cutout.py çağrılıp çıktının alfası ÖLÇÜLÜYOR. Testin bütün amacı şu: alfa
 * ürettiğini iddia etmek ile üretmek arasındaki farkı kapatmak.
 */

let dir;
test('fikstürler hazırlanır', async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cut-'));
  const gen = path.join(dir, 'gen.py');
  await writeFile(
    gen,
    `
import numpy as np, sys
from PIL import Image
D = sys.argv[1]
h, w = 400, 320
yy, xx = np.mgrid[0:h, 0:w]
subj = ((xx-160)**2/80**2 + (yy-250)**2/120**2 < 1) | ((xx-160)**2/48**2 + (yy-110)**2/48**2 < 1)
# siyahtan beyaza gradyan: hem koyu hem açık ton içerir
shade = np.clip(((xx-90)/140)*255, 0, 255).astype(np.uint8)

# 1) magenta anahtar zemin + gürültü (chroma modunun hedefi)
a = np.zeros((h, w, 3), np.uint8); a[:, :] = [255, 0, 255]
for c in range(3): a[:, :, c] = np.where(subj, shade, a[:, :, c])
rs = np.random.RandomState(5)
a = np.clip(a.astype(np.int16) + (rs.randn(h, w, 3)*7).astype(np.int16), 0, 255).astype(np.uint8)
Image.fromarray(a).save(f"{D}/chroma.png")

# 2) beyaz kağıtta halftone mürekkep (ink modunun hedefi)
b = np.full((h, w, 3), 247, np.uint8)
dots = (xx % 4 < 2) & (yy % 4 < 2)
b[subj & dots] = 24
Image.fromarray(b).save(f"{D}/ink.png")

# 3) tuzak: arka planı olmayan düz renk — reddedilmeli
Image.fromarray(np.full((160, 160, 3), 88, np.uint8)).save(f"{D}/solid.png")

# 4) tuzak: her yeri doygun magenta — her şey silinir, reddedilmeli
Image.fromarray(np.tile(np.array([255,0,255],np.uint8),(160,160,1))).save(f"{D}/allkey.png")

# 5) KOPUK PARÇA: baş gövdeden ayrı. Halftone bir kesikte baş ile omuz arasında
#    beyaz boşluk olması olağan; damganın iç halkası, iğne, "i" noktası da ayrı
#    bileşen. "En büyük bileşeni tut" bunları siliyordu.
c = np.zeros((h, w, 3), np.uint8); c[:, :] = [255, 0, 255]
head = ((xx-160)**2/44**2 + (yy-90)**2/44**2) < 1     # y 46..134
body = (np.abs(xx-160) < 90) & (yy > 180) & (yy < 360)  # 46 px boşluk
for ch in range(3): c[:, :, ch] = np.where(head | body, 30, c[:, :, ch])
Image.fromarray(c).save(f"{D}/detached.png")

# 6) KAPALI BOŞLUK: halka. İçi dıştan erişilemez ve anahtar renktedir.
#    "İç boşlukları doldur" burada magenta'yı OPAKLAŞTIRIYORDU.
e = np.zeros((h, w, 3), np.uint8); e[:, :] = [255, 0, 255]
rr = np.sqrt((xx-160)**2 + (yy-200)**2)
ring = (rr > 70) & (rr < 130)
for ch in range(3): e[:, :, ch] = np.where(ring, 30, e[:, :, ch])
Image.fromarray(e).save(f"{D}/ring.png")
`,
  );
  await run('python3', [gen, dir]);
});

async function cut(src, out, mode, extra = []) {
  const dst = path.join(dir, out);
  const {stdout} = await run('python3', [CUTOUT, path.join(dir, src), dst, '--mode', mode, ...extra]);
  return {stdout, dst};
}

/** Çıktı PNG'sinin alfa istatistiğini Python ile ölç. */
async function alphaStats(file) {
  const probe = path.join(dir, 'probe.py');
  await writeFile(
    probe,
    `
import sys, json
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGBA"))[:, :, 3].astype(float) / 255.0
print(json.dumps({
  "opaque": float((a > 0.6).mean()),
  "transparent": float((a < 0.1).mean()),
  "has_alpha_channel": True,
  "width": int(a.shape[1]), "height": int(a.shape[0]),
}))
`,
  );
  const {stdout} = await run('python3', [probe, file]);
  return JSON.parse(stdout);
}

test('chroma modu: doygun anahtar zemin silinir, öznenin tam tonu kalır', async () => {
  const {dst} = await cut('chroma.png', 'o_chroma.png', 'chroma', ['--strict']);
  const s = await alphaStats(dst);
  // ÖNEMLİ: ölçüm KIRPMA SONRASI yapılıyor. Çıktı öznenin sınır kutusuna
  // kırpıldığı için opak oran yüksektir — bir elips kendi sınır kutusunun
  // yaklaşık %78'ini doldurur. İlk yazılan `< 0.60` iddiası kırpmayı hesaba
  // katmadığı için kodu haksız yere başarısız gösteriyordu.
  assert.ok(s.opaque > 0.45 && s.opaque < 0.90, `opak oran beklenmedik: ${s.opaque}`);
  // Kırpma sonrası bile köşeler şeffaf kalmalı: elipsin dışı.
  assert.ok(s.transparent > 0.08, `zemin silinmemiş: şeffaf ${s.transparent}`);
});

test('chroma modu koyu bölgede çökmez (mutlak kroma, göreli doygunluk değil)', async () => {
  // Göreli doygunluk kullanılırsa siyaha yakın piksellerde gürültü %60
  // doygunluk gösterir ve öznenin koyu kenarı tırtıklı gürültüye döner.
  // Ölçü: silinen bölge tek parça olmalı, özne delik deşik olmamalı.
  const {dst} = await cut('chroma.png', 'o_chroma2.png', 'chroma');
  const probe = path.join(dir, 'holes.py');
  await writeFile(
    probe,
    `
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGBA"))[:, :, 3] > 150
# gövdenin içindeki delikleri say: satır bazında opak-şeffaf-opak geçişleri
holes = 0
for row in a:
    idx = np.where(row)[0]
    if len(idx) > 1:
        holes += int(((~row[idx.min():idx.max()+1]).sum()) > 0)
print(holes, a.shape[0])
`,
  );
  const {stdout} = await run('python3', [probe, dst]);
  const [holeRows, totalRows] = stdout.trim().split(/\s+/).map(Number);
  assert.ok(
    holeRows / totalRows < 0.15,
    `gövdenin içi delik: ${holeRows}/${totalRows} satırda boşluk var (koyu bölge çöküyor)`,
  );
});

test('ink modu: beyaz kağıt şeffaf, mürekkep opak', async () => {
  const {dst} = await cut('ink.png', 'o_ink.png', 'ink', ['--strict']);
  const s = await alphaStats(dst);
  assert.ok(s.transparent > 0.4, `kağıt şeffaflaşmamış: ${s.transparent}`);
  assert.ok(s.opaque > 0.02, `mürekkep kaybolmuş: ${s.opaque}`);
});

test('arka planı olmayan görsel REDDEDİLİR (--strict exit 2)', async () => {
  // Bu testin varlık sebebi: alfa üretimini iddia etmek yetmez, ölçülür.
  await assert.rejects(
    () => cut('solid.png', 'o_solid.png', 'matte', ['--strict']),
    (e) => e.code === 2,
    'düz renkli girdi strict modda hata vermeliydi',
  );
});

test('her yeri anahtar renk olan görsel REDDEDİLİR', async () => {
  await assert.rejects(
    () => cut('allkey.png', 'o_allkey.png', 'chroma', ['--strict']),
    (e) => e.code === 2,
    'tamamı silinen girdi strict modda hata vermeliydi',
  );
});

test('çıktı PNG gerçekten alfa kanallı (JPEG tuzağı)', async () => {
  // Bir başka yaklaşımda prompt'a "TRANSPARENCY IS MANDATORY" yazılmış ama
  // modelden image/jpeg istenmişti. JPEG'in alfa kanalı yoktur; katmanlar
  // sessizce opak binmişti. Burada dosyanın kendisi kontrol edilir.
  const {dst} = await cut('chroma.png', 'o_fmt.png', 'chroma');
  const buf = await readFile(dst);
  // PNG imzası + IHDR renk tipi 6 (truecolour + alpha)
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', 'çıktı PNG değil');
  assert.equal(buf[25], 6, `IHDR renk tipi 6 (RGBA) olmalı, ${buf[25]} bulundu`);
});

test('şeffaf kenar boşluğu kırpılır', async () => {
  // Model özneyi karenin ortasına küçük koyar; kırpılmazsa Remotion'da
  // cutout'un görünen boyutu istenenin çok altında kalır.
  const {dst} = await cut('chroma.png', 'o_trim.png', 'chroma');
  const s = await alphaStats(dst);
  assert.ok(s.width < 320 && s.height < 400, `kırpılmamış: ${s.width}x${s.height}`);
});

/**
 * Opak piksellerin RENGİNİ ölç.
 *
 * Alfa doğru olup RENK yanlış kalabiliyor: kroma anahtarlamada kalıntı magenta
 * hem kesiğin çevresinde mor bir hâle bırakıyor hem de kapalı boşluk
 * doldurulduğunda ekrana bir mor disk koyuyor. İkisi de ölçüldü.
 */
async function opaqueColourStats(file) {
  const probe = path.join(dir, 'colour.py');
  await writeFile(
    probe,
    `
import sys, json
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(int)
m = a[:, :, 3] > 150
rgb = a[:, :, :3][m]
print(json.dumps({
  "opaque_px": int(m.sum()),
  "max_chroma": int((rgb.max(1) - rgb.min(1)).max()) if len(rgb) else 0,
  "keyish_share": float(((rgb[:,0]-rgb[:,1] > 60) & (rgb[:,2]-rgb[:,1] > 60)).mean()) if len(rgb) else 0.0,
}))
`,
  );
  const {stdout} = await run('python3', [probe, file]);
  return JSON.parse(stdout);
}

/**
 * REGRESYON: `chroma` modu `keep_largest_blob` çağırıyordu ve öznenin kopuk
 * parçasını siliyordu. Sentetik figürde baş tamamen düştü — çıktı 435x689
 * geldi, gövdenin sınır kutusu. Doğru ölçüt "en büyük" değil, "çöp sayılacak
 * kadar küçük".
 */
test('chroma modu öznenin KOPUK parçasını silmez (baş + gövde)', async () => {
  const {dst} = await cut('detached.png', 'o_detached.png', 'chroma', ['--strict']);
  const s = await alphaStats(dst);
  // Baş y 46'da başlıyor, gövde y 360'ta bitiyor: birlikte ~314 px yükseklik.
  // Yalnızca gövde kalsaydı ~180 px olurdu.
  assert.ok(s.height > 280, `kopuk parça silinmiş: yükseklik ${s.height}, ikisi birden ~314 olmalı`);
  assert.ok(s.width > 170, `gövde genişliği kaybolmuş: ${s.width}`);
});

/**
 * REGRESYON: `keep_largest_blob`'un "iç boşlukları doldur" adımı halkanın içini
 * opaklaştırıyordu ve oradaki RGB anahtar rengin ta kendisiydi. Kanıt karesinde
 * ekranın ortasına parlak mor bir disk çıktı; o parçanın opak piksellerinin
 * %62'si magenta ölçüldü. Kroma anahtarlamanın tek şartı anahtar rengin ASLA
 * hayatta kalmaması.
 */
test('chroma modu KAPALI boşluğu doldurmaz (halkanın içi şeffaf kalır)', async () => {
  const {dst} = await cut('ring.png', 'o_ring.png', 'chroma', ['--strict']);
  const s = await alphaStats(dst);
  // Halka kendi sınır kutusunun ~%56'sını kaplar; içi dolsaydı ~%78 olurdu.
  assert.ok(s.opaque < 0.70, `halkanın içi doldurulmuş: opak ${s.opaque}`);
  assert.ok(s.transparent > 0.25, `içerideki boşluk şeffaf değil: ${s.transparent}`);
});

test('chroma modu çıktısında anahtar renk HİÇ hayatta kalmaz', async () => {
  for (const src of ['ring.png', 'detached.png', 'chroma.png']) {
    const {dst} = await cut(src, `o_key_${src}`, 'chroma');
    const c = await opaqueColourStats(dst);
    assert.equal(c.keyish_share, 0, `${src}: opak piksellerde magenta kaldı (%${c.keyish_share * 100})`);
    // Despill her opak pikseli nötrler: kolaj paleti zaten siyah-beyaz halftone.
    assert.equal(c.max_chroma, 0, `${src}: opak pikselde renk kalıntısı var (kroma ${c.max_chroma})`);
  }
});

test('deterministik: aynı girdi iki kez aynı çıktıyı verir', async () => {
  const a = await cut('chroma.png', 'd1.png', 'chroma');
  const b = await cut('chroma.png', 'd2.png', 'chroma');
  const [x, y] = await Promise.all([readFile(a.dst), readFile(b.dst)]);
  assert.ok(x.equals(y), 'aynı girdi farklı çıktı verdi');
});
