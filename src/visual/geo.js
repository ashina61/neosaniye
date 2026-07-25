/**
 * GERÇEK COĞRAFYA — yer adını GERÇEK haritada doğru konuma oturtur.
 *
 * Önceki "harita" sahteydi: ızgara çizip işareti panelin rastgele bir yerine
 * koyuyordu. Bir yer adı söylenip ekranda anlamsız bir kutu gösterilmesi,
 * hiç göstermemekten kötüdür. Bu modül Natural Earth (kamu malı) sınırlarını
 * kullanarak gerçek kara parçalarını çizer ve işareti gerçek enlem/boylama
 * koyar; yer adı tanınmıyorsa NULL döner (uydurma harita çizilmez).
 *
 * Veri: src/visual/geoData.json (scripts/build-geo-data.js ile üretilir).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GEO = require('./geoData.json');

/** Yer adı eşleştirme için normalize. */
function norm(s) {
  return String(s || '').toUpperCase().replace(/[^\p{L}\s]/gu, '').trim();
}

/** Ülke adı → geometri anahtarı (gazetteer ADI büyük harf tutar). */
const COUNTRY_BY_UPPER = Object.fromEntries(
  Object.keys(GEO.countries).map((k) => [k.toUpperCase(), k]),
);

/**
 * Yer adını gerçek koordinata ve (varsa) ülke geometrisine çöz.
 * @param {string} place
 * @returns {{lon:number, lat:number, country:string|null, name:string}|null}
 */
export function resolvePlace(place) {
  const key = norm(place);
  if (!key) return null;

  // 1) Doğrudan gazetteer (ülke adı, ISO kodu, okyanus/bölge).
  let coords = GEO.gazetteer[key];
  let country = COUNTRY_BY_UPPER[key] || null;

  // 2) Kısmi eşleşme: "GREAT BARRIER REEF" gibi çok kelimeli adlarda
  //    ya da "AUSTRALIAN" → "AUSTRALIA" gibi eklerde.
  if (!coords) {
    const hit = Object.keys(GEO.gazetteer).find(
      (k) => k === key || (k.length > 3 && (key.startsWith(k) || k.startsWith(key))),
    );
    if (hit) {
      coords = GEO.gazetteer[hit];
      country = COUNTRY_BY_UPPER[hit] || null;
    }
  }
  if (!coords) return null;
  return { lon: coords[0], lat: coords[1], country, name: key };
}

/** Hedefin çevresinde gösterilecek harita penceresi (derece cinsinden). */
function viewWindow(target) {
  const rings = target.country ? GEO.countries[target.country] : null;
  let spanLon = 90;
  let spanLat = 55;
  if (rings && rings.length) {
    let minX = 180; let maxX = -180; let minY = 90; let maxY = -90;
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    // Ülke panelin ~%45'ini kaplasın; çevresi bağlam için görünsün.
    spanLon = Math.max(28, (maxX - minX) * 2.2);
    spanLat = Math.max(18, (maxY - minY) * 2.2);
  }
  // 2:1 en-boy oranını koru (equirectangular).
  if (spanLon < spanLat * 2) spanLon = spanLat * 2;
  else spanLat = spanLon / 2;
  spanLon = Math.min(360, spanLon);
  spanLat = Math.min(180, spanLat);

  let cLon = target.lon;
  let cLat = target.lat;
  // Pencereyi dünya sınırlarının içinde tut.
  cLon = Math.max(-180 + spanLon / 2, Math.min(180 - spanLon / 2, cLon));
  cLat = Math.max(-90 + spanLat / 2, Math.min(90 - spanLat / 2, cLat));
  return { cLon, cLat, spanLon, spanLat };
}

/**
 * Yer adı için ASS çizim yolları üret (panel-yerel koordinatlar).
 *
 * @param {string} place
 * @param {{w:number, h:number}} size panel ölçüsü (piksel)
 * @returns {{land:string, target:string|null, marker:{x:number,y:number},
 *            country:string|null, lon:number, lat:number}|null}
 */
export function buildMapPaths(place, { w = 640, h = 320 } = {}) {
  const target = resolvePlace(place);
  if (!target) return null;

  const { cLon, cLat, spanLon, spanLat } = viewWindow(target);
  const lon0 = cLon - spanLon / 2;
  const lat1 = cLat + spanLat / 2;
  const sx = w / spanLon;
  const sy = h / spanLat;
  const px = (lon) => Math.round((lon - lon0) * sx);
  const py = (lat) => Math.round((lat1 - lat) * sy);

  // Görünür pencereye düşen kara parçaları (tek ASS çizimi, çok alt-yol).
  const landParts = [];
  const targetParts = [];
  for (const [name, rings] of Object.entries(GEO.countries)) {
    const isTarget = name === target.country;
    for (const ring of rings) {
      // Pencereyle kesişmiyorsa atla (çizim boyutunu küçük tutar).
      let minX = 180; let maxX = -180; let minY = 90; let maxY = -90;
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (maxX < lon0 - 5 || minX > lon0 + spanLon + 5) continue;
      if (maxY < lat1 - spanLat - 5 || minY > lat1 + 5) continue;

      let d = `m ${px(ring[0][0])} ${py(ring[0][1])}`;
      for (let i = 1; i < ring.length; i += 1) d += ` l ${px(ring[i][0])} ${py(ring[i][1])}`;
      if (isTarget) targetParts.push(d);
      else landParts.push(d);
    }
  }
  if (!landParts.length && !targetParts.length) return null;

  return {
    land: landParts.join(' '),
    target: targetParts.length ? targetParts.join(' ') : null,
    marker: { x: px(target.lon), y: py(target.lat) },
    country: target.country,
    lon: target.lon,
    lat: target.lat,
  };
}

/** Enlem/boylamın insan-okur biçimi ("23.8°S 133.2°E") — künye/doğrulama için. */
export function formatCoords(lon, lat) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}
