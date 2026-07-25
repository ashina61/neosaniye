/**
 * GERÇEK HARİTA VERİSİ ÜRETİCİ (tek seferlik/bakım aracı).
 *
 * Natural Earth 110m ülke sınırlarını (kamu malı) alır, Shorts ekranında
 * gereken çözünürlüğe indirger ve src/visual/geoData.json olarak yazar.
 * Amaç: sahte ızgara yerine GERÇEK coğrafya çizmek — bir yer adı geçtiğinde
 * o ülke haritada doğru yerinde işaretlenir.
 *
 * Kullanım:
 *   node scripts/build-geo-data.js <ne_110m_admin_0_countries.geojson>
 *
 * Kaynak veri: https://github.com/nvkelso/natural-earth-vector
 * Lisans: Natural Earth — public domain (atıf gerekmez, serbest kullanım).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) {
  console.error('Kullanım: node scripts/build-geo-data.js <geojson>');
  process.exit(1);
}

/** Douglas-Peucker: çokgeni görsel olarak bozmadan nokta sayısını düşürür. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const denom = dx * dx + dy * dy;
    const t = denom ? ((px - ax) * dx + (py - ay) * dy) / denom : 0;
    const cx = ax + Math.max(0, Math.min(1, t)) * dx;
    const cy = ay + Math.max(0, Math.min(1, t)) * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** Halka alanı (centroid ağırlığı + en büyük parçayı seçmek için). */
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(a / 2);
}

const geo = JSON.parse(readFileSync(SRC, 'utf8'));
const countries = {};
const gazetteer = {};

for (const f of geo.features) {
  const p = f.properties || {};
  const name = String(p.NAME || p.name || p.ADMIN || '').trim();
  if (!name) continue;
  const iso = String(p.ISO_A3 || p.iso_a3 || '').trim();

  // Çok parçalı ülkelerde tüm halkaları al, küçük adacıkları ele.
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
    : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  const rings = [];
  let biggest = null;
  let biggestArea = 0;
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const area = ringArea(outer);
    if (area < 0.8) continue; // görünmeyecek kadar küçük parça
    const simp = simplify(outer.map(([x, y]) => [x, y]), 0.55)
      .map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    if (simp.length >= 4) rings.push(simp);
    if (area > biggestArea) { biggestArea = area; biggest = outer; }
  }
  if (!rings.length) continue;
  countries[name] = rings;

  // Gazetteer: ana kara parçasının ağırlık merkezi (işaretin gerçek konumu).
  if (biggest) {
    let sx = 0; let sy = 0;
    for (const [x, y] of biggest) { sx += x; sy += y; }
    gazetteer[name.toUpperCase()] = [
      Math.round((sx / biggest.length) * 10) / 10,
      Math.round((sy / biggest.length) * 10) / 10,
    ];
    if (iso && iso !== '-99') gazetteer[iso] = gazetteer[name.toUpperCase()];
  }
}

// Ülke olmayan ama anlatımda sık geçen coğrafi adlar (gerçek koordinatlar).
Object.assign(gazetteer, {
  PACIFIC: [-160, 0], 'PACIFIC OCEAN': [-160, 0],
  ATLANTIC: [-30, 10], 'ATLANTIC OCEAN': [-30, 10],
  INDIAN: [75, -20], 'INDIAN OCEAN': [75, -20],
  ARCTIC: [0, 80], 'ARCTIC OCEAN': [0, 80],
  SOUTHERN: [0, -65], ANTARCTICA: [0, -80], ANTARCTIC: [0, -80],
  AMAZON: [-60, -3], SAHARA: [10, 23], HIMALAYA: [86, 28], HIMALAYAS: [86, 28],
  ANDES: [-70, -20], ALPS: [10, 46], NILE: [31, 20], SIBERIA: [100, 62],
  AFRICA: [20, 2], ASIA: [90, 45], EUROPE: [15, 52], OCEANIA: [140, -25],
  'SOUTH AMERICA': [-60, -15], 'NORTH AMERICA': [-100, 45],
  'MIDDLE EAST': [45, 28], SCANDINAVIA: [15, 62], CARIBBEAN: [-75, 15],
  MEDITERRANEAN: [18, 35], 'GREAT BARRIER REEF': [147, -18],
  AMAZONIA: [-60, -3], PATAGONIA: [-70, -45], BALKANS: [21, 43],
});

const out = {
  _source: 'Natural Earth 110m admin_0_countries (public domain)',
  _note: 'scripts/build-geo-data.js ile üretildi; elle düzenlemeyin.',
  countries,
  gazetteer,
};
const dest = path.join('src', 'visual', 'geoData.json');
writeFileSync(dest, JSON.stringify(out));
const pts = Object.values(countries).flat().reduce((a, r) => a + r.length, 0);
console.log(`${dest}: ${Object.keys(countries).length} ülke, ${pts} nokta, ` +
  `${Object.keys(gazetteer).length} yer adı, ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`);
