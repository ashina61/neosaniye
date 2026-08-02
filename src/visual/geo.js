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
 * ŞEHİRLER ve TARİHÎ/DEMONİM adlar. Bunlar bir MODERN ÜLKE değildir; yalnızca
 * koordinat verirler ve haritada ülke DOLGUSU yapılmaz.
 *
 * Gerekçe (26 Tem, canlı hata): "The Roman Empire" cümlesinden "ROMAN"
 * çıkarılıyor, gevşek önek eşleşmesi ("ROMANIA".startsWith("ROMAN")) bunu
 * ROMANYA'ya bağlıyor ve haritada modern Romanya vurgulanıyordu. Roma
 * İmparatorluğu'nu modern bir ülke sınırıyla göstermek zaten yanlış olurdu;
 * bu yüzden tarihî adlar için ülke doldurulmaz, sadece bölge işaretlenir.
 */
const POINT_ONLY = {
  // Tarihî devletler/uygarlıklar — modern sınırla eşitlemek yanlış olur.
  ROMAN: [12.5, 41.9], 'ROMAN EMPIRE': [12.5, 41.9], ROME: [12.5, 41.9],
  BYZANTINE: [28.98, 41.01], BYZANTIUM: [28.98, 41.01],
  OTTOMAN: [28.98, 41.01], PERSIAN: [52.0, 32.0], PERSIA: [52.0, 32.0],
  MESOPOTAMIA: [44.4, 33.3], BABYLON: [44.42, 32.54], SUMER: [45.6, 31.3],
  'ANCIENT EGYPT': [31.2, 29.9], PHARAOH: [31.2, 29.9],
  MAYA: [-89.6, 20.7], MAYAN: [-89.6, 20.7], AZTEC: [-99.1, 19.4],
  INCA: [-72.5, -13.5], VIKING: [10.7, 59.9], NORSE: [10.7, 59.9],
  SPARTA: [22.43, 37.07], SPARTAN: [22.43, 37.07],
  'ANCIENT GREECE': [23.7, 37.98], GREEK: [23.7, 37.98],
  // Şehirler — nokta işaretidir, ülke dolgusu değil.
  ATHENS: [23.73, 37.98], CAIRO: [31.24, 30.04], LONDON: [-0.13, 51.51],
  PARIS: [2.35, 48.86], BERLIN: [13.4, 52.52], MOSCOW: [37.62, 55.75],
  BEIJING: [116.4, 39.9], TOKYO: [139.7, 35.68], DELHI: [77.2, 28.6],
  ISTANBUL: [28.98, 41.01], JERUSALEM: [35.22, 31.78], BAGHDAD: [44.36, 33.31],
  'NEW YORK': [-74.0, 40.71], POMPEII: [14.49, 40.75], ALEXANDRIA: [29.92, 31.2],
};

/**
 * Yer adını gerçek koordinata ve (varsa) ülke geometrisine çöz.
 *
 * EŞLEŞME KATIDIR: yalnızca tam ad, tam ISO kodu ya da yukarıdaki küratörlü
 * tablo kabul edilir. Gevşek önek eşleştirmesi KALDIRILDI — kısa bir özel ad
 * kendinden uzun herhangi bir ülkeye yapışıp tamamen alakasız bir harita
 * çizdiriyordu (ROMAN → ROMANIA).
 *
 * @param {string} place
 * @returns {{lon:number, lat:number, country:string|null, name:string,
 *            pointOnly:boolean}|null}
 */
export function resolvePlace(place) {
  const key = norm(place);
  if (!key) return null;

  // 1) Şehir / tarihî ad: koordinat evet, ülke dolgusu HAYIR.
  if (POINT_ONLY[key]) {
    const [lon, lat] = POINT_ONLY[key];
    return { lon, lat, country: null, name: key, pointOnly: true };
  }

  // 2) Tam ülke adı ya da ISO kodu (gazetteer'da birebir).
  if (GEO.gazetteer[key]) {
    const [lon, lat] = GEO.gazetteer[key];
    return { lon, lat, country: COUNTRY_BY_UPPER[key] || null, name: key, pointOnly: false };
  }

  // 3) Demonim → ülke ("AUSTRALIAN" → "AUSTRALIA"). YALNIZCA bilinen ekler,
  //    ve kökün kendisi gerçek bir ülke adı olmalı.
  const stem = key.replace(/(IAN|EAN|ISH|ESE|IC|N)$/,'');
  for (const suffix of ['', 'A', 'Y', 'IA']) {
    const candidate = stem + suffix;
    if (candidate.length >= 4 && GEO.gazetteer[candidate] && COUNTRY_BY_UPPER[candidate]) {
      const [lon, lat] = GEO.gazetteer[candidate];
      return { lon, lat, country: COUNTRY_BY_UPPER[candidate], name: candidate, pointOnly: false };
    }
  }

  return null; // tanınmadı → harita ÇİZİLMEZ (uydurma coğrafya yok)
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
    // pointOnly (şehir/tarihî ad) ise HİÇBİR ülke vurgulanmaz: "Roma
    // İmparatorluğu = modern İtalya" gibi yanlış bir iddiada bulunmayız.
    const isTarget = !target.pointOnly && name === target.country;
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
