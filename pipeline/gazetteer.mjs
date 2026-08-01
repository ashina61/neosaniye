/**
 * YER ADI → GERÇEK KOORDİNAT
 *
 * ============ NEDEN VAR ============
 *
 * `map_route` ve `evidence_board` rota çiziyordu ama koordinatlar SABİTTİ:
 *
 *     p.route = [
 *       {x: 0.14, y: 0.74, label: places[0]},
 *       {x: 0.52, y: 0.46},
 *       {x: 0.86, y: 0.22, label: places[1]},
 *     ];
 *
 * Yani Portland → Seattle ile Londra → Tokyo BİREBİR AYNI çizgiyi çiziyordu.
 * Etiketler doğruydu, geometri uydurmaydı. Kullanıcı bunu şöyle söyledi:
 * "mesela seattle diyorya orda amerikan seaatle işaretli şekilde çizim gelse
 * çok iyi olur."
 *
 * Haritanın tek işi zaten geometriyi taşımak. Yanlış geometrili bir harita,
 * bu deponun kendi kuralına göre uydurma nesne çizmekle aynı sınıf hata —
 * üstelik daha sinsi, çünkü doğru etiket yanlış konumu meşrulaştırıyor.
 *
 * ============ NEDEN KIYI ÇİZGİSİ YOK ============
 *
 * Gerçek kıyı çizgisi vektör coğrafya verisi ister (yüzlerce KB) ve bu depoya
 * girmesi hem ağır hem gereksiz: referans dil zaten GRAVÜR HARİTA PARÇASI, tam
 * bir atlas değil. Burada üretilen şey doğru BAĞIL KONUM ve doğru YÖN — iki
 * yerin birbirine göre nerede durduğu. Sahte bir kıta silueti çizmektense
 * hiç çizmemek doğru: harita iddiası taşımayan bir rota diyagramı dürüsttür.
 *
 * ============ KONUYA ÖZGÜ DEĞİL ============
 *
 * Depo kuralı: "konuya özgü kod ya da veri yazılmaz". Bu sözlük `subject.mjs`
 * ile aynı sınıf: GENEL bir sözlük, belgesel anlatılarında geçen yerler.
 * Tek bir konunun yerlerini buraya yazmak o kuralı ihlal ederdi.
 *
 * Koordinatlar ondalık derece, [enlem, boylam]. Kuzey ve doğu artı.
 */

/**
 * Anahtarlar küçük harf. Çok kelimeli adlar tek boşlukla yazılır; arayıcı
 * gelen adı aynı biçime indirger.
 */
const PLACES = {
  // ---- Kuzey Amerika ----
  'seattle': [47.61, -122.33],
  'portland': [45.52, -122.68],
  'tacoma': [47.25, -122.44],
  'vancouver': [49.28, -123.12],
  'san francisco': [37.77, -122.42],
  'los angeles': [34.05, -118.24],
  'san diego': [32.72, -117.16],
  'las vegas': [36.17, -115.14],
  'phoenix': [33.45, -112.07],
  'denver': [39.74, -104.99],
  'salt lake city': [40.76, -111.89],
  'dallas': [32.78, -96.80],
  'houston': [29.76, -95.37],
  'new orleans': [29.95, -90.07],
  'miami': [25.76, -80.19],
  'atlanta': [33.75, -84.39],
  'chicago': [41.88, -87.63],
  'detroit': [42.33, -83.05],
  'minneapolis': [44.98, -93.27],
  'st louis': [38.63, -90.20],
  'kansas city': [39.10, -94.58],
  'new york': [40.71, -74.01],
  'boston': [42.36, -71.06],
  'philadelphia': [39.95, -75.17],
  'washington': [38.91, -77.04],
  'baltimore': [39.29, -76.61],
  'pittsburgh': [40.44, -79.996],
  'cleveland': [41.50, -81.69],
  'anchorage': [61.22, -149.90],
  'honolulu': [21.31, -157.86],
  'toronto': [43.65, -79.38],
  'montreal': [45.50, -73.57],
  'ottawa': [45.42, -75.70],
  'mexico city': [19.43, -99.13],
  'havana': [23.11, -82.37],
  // Eyalet ve bölgeler: merkez noktaları.
  'california': [36.78, -119.42],
  'texas': [31.97, -99.90],
  'florida': [27.99, -81.76],
  'alaska': [64.20, -149.49],
  'nevada': [38.80, -116.42],
  'oregon': [43.80, -120.55],
  'idaho': [44.07, -114.74],
  'montana': [46.88, -110.36],
  'colorado': [39.06, -105.31],
  'arizona': [34.05, -111.09],
  'utah': [39.32, -111.09],
  'kansas': [38.50, -98.38],
  'nebraska': [41.49, -99.90],
  'iowa': [42.01, -93.21],
  'ohio': [40.42, -82.91],
  'virginia': [37.43, -78.66],
  'carolina': [35.76, -79.02],
  'georgia': [32.17, -82.90],
  'alabama': [32.32, -86.90],
  'mississippi': [32.35, -89.40],
  'tennessee': [35.52, -86.58],
  'kentucky': [37.84, -84.27],
  'missouri': [38.46, -92.29],
  'oklahoma': [35.01, -97.09],
  'arkansas': [34.80, -92.20],
  'wisconsin': [43.78, -88.79],
  'michigan': [44.31, -85.60],
  'illinois': [40.63, -89.40],
  'indiana': [40.27, -86.13],
  'pennsylvania': [41.20, -77.19],
  'maine': [45.25, -69.45],
  'vermont': [44.56, -72.58],
  'wyoming': [43.08, -107.29],
  'dakota': [44.30, -100.44],
  'washington state': [47.75, -120.74],
  'united states': [39.83, -98.58],
  'america': [39.83, -98.58],
  'canada': [56.13, -106.35],
  'mexico': [23.63, -102.55],
  'alberta': [53.93, -116.58],
  'quebec': [52.94, -73.55],
  'yukon': [64.28, -135.00],

  // ---- Avrupa ----
  'london': [51.51, -0.13],
  'aylesbury': [51.82, -0.81],
  'oxford': [51.75, -1.26],
  'cambridge': [52.21, 0.12],
  'birmingham': [52.49, -1.89],
  'manchester': [53.48, -2.24],
  'liverpool': [53.41, -2.98],
  'leeds': [53.80, -1.55],
  'glasgow': [55.86, -4.25],
  'edinburgh': [55.95, -3.19],
  'bristol': [51.45, -2.59],
  'dublin': [53.35, -6.26],
  'belfast': [54.60, -5.93],
  'cardiff': [51.48, -3.18],
  'paris': [48.86, 2.35],
  'marseille': [43.30, 5.37],
  'lyon': [45.76, 4.84],
  'calais': [50.95, 1.86],
  'normandy': [49.18, -0.37],
  'berlin': [52.52, 13.40],
  'munich': [48.14, 11.58],
  'hamburg': [53.55, 9.99],
  'cologne': [50.94, 6.96],
  'frankfurt': [50.11, 8.68],
  'dresden': [51.05, 13.74],
  'vienna': [48.21, 16.37],
  'prague': [50.08, 14.44],
  'warsaw': [52.23, 21.01],
  'krakow': [50.06, 19.94],
  'budapest': [47.50, 19.04],
  'bucharest': [44.43, 26.10],
  'belgrade': [44.79, 20.45],
  'sofia': [42.70, 23.32],
  'athens': [37.98, 23.73],
  'rome': [41.90, 12.50],
  'milan': [45.46, 9.19],
  'naples': [40.85, 14.27],
  'venice': [45.44, 12.32],
  'florence': [43.77, 11.26],
  'pompeii': [40.75, 14.49],
  'madrid': [40.42, -3.70],
  'barcelona': [41.39, 2.17],
  'lisbon': [38.72, -9.14],
  'amsterdam': [52.37, 4.90],
  'rotterdam': [51.92, 4.48],
  'brussels': [50.85, 4.35],
  'zurich': [47.38, 8.54],
  'geneva': [46.20, 6.14],
  'copenhagen': [55.68, 12.57],
  'stockholm': [59.33, 18.07],
  'oslo': [59.91, 10.75],
  'bergen': [60.39, 5.32],
  'helsinki': [60.17, 24.94],
  'reykjavik': [64.15, -21.94],
  'moscow': [55.76, 37.62],
  'leningrad': [59.94, 30.31],
  'petersburg': [59.94, 30.31],
  'kyiv': [50.45, 30.52],
  'kiev': [50.45, 30.52],
  'chernobyl': [51.28, 30.22],
  'pripyat': [51.41, 30.06],
  'istanbul': [41.01, 28.98],
  'ankara': [39.93, 32.86],
  'england': [52.36, -1.17],
  'scotland': [56.49, -4.20],
  'wales': [52.13, -3.78],
  'ireland': [53.41, -8.24],
  'britain': [54.00, -2.00],
  'france': [46.23, 2.21],
  'germany': [51.17, 10.45],
  'italy': [41.87, 12.57],
  'spain': [40.46, -3.75],
  'portugal': [39.40, -8.22],
  'poland': [51.92, 19.15],
  'sweden': [60.13, 18.64],
  'norway': [60.47, 8.47],
  'denmark': [56.26, 9.50],
  'finland': [61.92, 25.75],
  'netherlands': [52.13, 5.29],
  'belgium': [50.50, 4.47],
  'switzerland': [46.82, 8.23],
  'austria': [47.52, 14.55],
  'greece': [39.07, 21.82],
  'russia': [61.52, 105.32],
  'ukraine': [48.38, 31.17],
  'turkey': [38.96, 35.24],
  'iceland': [64.96, -19.02],

  // ---- Asya, Afrika, Okyanusya, Güney Amerika ----
  'tokyo': [35.68, 139.69],
  'osaka': [34.69, 135.50],
  'hiroshima': [34.39, 132.46],
  'nagasaki': [32.75, 129.87],
  'kyoto': [35.01, 135.77],
  'beijing': [39.90, 116.41],
  'shanghai': [31.23, 121.47],
  'hong kong': [22.32, 114.17],
  'seoul': [37.57, 126.98],
  'taipei': [25.03, 121.57],
  'manila': [14.60, 120.98],
  'jakarta': [-6.21, 106.85],
  'singapore': [1.35, 103.82],
  'bangkok': [13.76, 100.50],
  'hanoi': [21.03, 105.85],
  'saigon': [10.82, 106.63],
  'delhi': [28.70, 77.10],
  'mumbai': [19.08, 72.88],
  'bombay': [19.08, 72.88],
  'calcutta': [22.57, 88.36],
  'karachi': [24.86, 67.00],
  'kabul': [34.56, 69.21],
  'tehran': [35.69, 51.39],
  'baghdad': [33.31, 44.37],
  'jerusalem': [31.77, 35.21],
  'cairo': [30.04, 31.24],
  'alexandria': [31.20, 29.92],
  'nairobi': [-1.29, 36.82],
  'lagos': [6.52, 3.38],
  'casablanca': [33.57, -7.59],
  'cape town': [-33.92, 18.42],
  'johannesburg': [-26.20, 28.05],
  'sydney': [-33.87, 151.21],
  'melbourne': [-37.81, 144.96],
  'perth': [-31.95, 115.86],
  'auckland': [-36.85, 174.76],
  'wellington': [-41.29, 174.78],
  'buenos aires': [-34.60, -58.38],
  'rio de janeiro': [-22.91, -43.17],
  'sao paulo': [-23.55, -46.63],
  'lima': [-12.05, -77.04],
  'santiago': [-33.45, -70.67],
  'bogota': [4.71, -74.07],
  'caracas': [10.48, -66.90],
  'japan': [36.20, 138.25],
  'china': [35.86, 104.20],
  'india': [20.59, 78.96],
  'korea': [35.91, 127.77],
  'vietnam': [14.06, 108.28],
  'indonesia': [-0.79, 113.92],
  'australia': [-25.27, 133.78],
  'new zealand': [-40.90, 174.89],
  'brazil': [-14.24, -51.93],
  'argentina': [-38.42, -63.62],
  'chile': [-35.68, -71.54],
  'peru': [-9.19, -75.02],
  'egypt': [26.82, 30.80],
  'kenya': [-0.02, 37.91],
  'nigeria': [9.08, 8.68],
  'morocco': [31.79, -7.09],
  'iran': [32.43, 53.69],
  'iraq': [33.22, 43.68],
  'israel': [31.05, 34.85],
  'pakistan': [30.38, 69.35],
  'afghanistan': [33.94, 67.71],
  'thailand': [15.87, 100.99],
  'philippines': [12.88, 121.77],

  // ---- Denizler, adalar, kutuplar ----
  'hawaii': [19.90, -155.58],
  'tahiti': [-17.65, -149.43],
  'fiji': [-17.71, 178.07],
  'samoa': [-13.76, -172.10],
  'easter island': [-27.11, -109.35],
  'galapagos': [-0.95, -90.97],
  'iceland sea': [66.00, -18.00],
  'greenland': [71.71, -42.60],
  'antarctica': [-82.86, 135.00],
  'siberia': [66.00, 105.00],
  'roanoke': [35.87, -75.70],
  'bermuda': [32.32, -64.76],
  'azores': [37.74, -25.68],
  'canary islands': [28.29, -16.63],
  'madagascar': [-18.77, 46.87],
  'crete': [35.24, 24.81],
  'sicily': [37.60, 14.02],
  'sardinia': [40.12, 9.01],
  'corsica': [42.04, 9.01],
  'cyprus': [35.13, 33.43],
  'malta': [35.94, 14.38],
};

/** "Seattle," → "seattle". Nokta, virgül, tırnak ve fazla boşluk atılır. */
function normalise(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.,;:!?'"“”’()]/g, '')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Yer adı → `{lat, lon}` ya da `null`.
 *
 * Bilinmeyen ada NULL döner ve bu KASITLI: çağıran taraf o zaman harita
 * çizmemeli. Bilinmeyen yeri "ortaya koymak" tam olarak düzeltmeye çalıştığımız
 * hata olur.
 */
export function locate(name) {
  const key = normalise(name);
  if (!key) return null;
  const hit = PLACES[key];
  if (hit) return {lat: hit[0], lon: hit[1]};
  /**
   * "New York City" → "new york". Sondaki jenerik ekler atılıp bir kez daha
   * denenir; baştan atmak yanlış olurdu ("New Orleans"ın "orleans"ı ayrı yer).
   */
  const trimmed = key.replace(/\s+(city|state|island|islands|county|province|river|bay|harbour|harbor)$/, '');
  if (trimmed !== key && PLACES[trimmed]) {
    return {lat: PLACES[trimmed][0], lon: PLACES[trimmed][1]};
  }
  return null;
}

/**
 * ROTAYI KAREYE OTURT.
 *
 * Eşdikdörtgen izdüşüm, enlem düzeltmeli: boylam farkı kutuplara doğru
 * daraldığı için `cos(ortalama enlem)` ile ölçeklenir. Bu düzeltme olmadan
 * Seattle-Portland gibi yüksek enlemli kısa bir rota olduğundan geniş çıkar.
 *
 * Sonuç 0..1 aralığında `{x, y}`; y AŞAĞI artar (ekran koordinatı), enlem ise
 * yukarı, o yüzden ters çevriliyor.
 *
 * `pad`: noktaların kenara yapışmaması için kenar payı. Etiketler noktanın
 * yanına yazıldığı için pay cömert.
 *
 * Tek nokta ya da üst üste iki nokta gelirse ölçek sıfıra bölünür; o durumda
 * nokta(lar) ortaya konur — bu bir kaçamak değil, tek yerin haritada tek yeri
 * vardır.
 */
export function projectRoute(names, {pad = 0.18} = {}) {
  const found = names.map((n) => ({name: n, pos: locate(n)}));
  if (found.some((f) => !f.pos)) return null;

  const lats = found.map((f) => f.pos.lat);
  const lons = found.map((f) => f.pos.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.max(0.15, Math.cos((midLat * Math.PI) / 180));

  // Boylamı enlem düzeltmesiyle ölçekle, sonra ikisini de aynı kutuya sığdır.
  const xs = lons.map((lo) => lo * k);
  const ys = lats;
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  // ORANI KORU: ayrı ayrı normalize etmek kuzey-güney bir rotayı çapraz
  // gösterirdi. Tek ölçek kullanılır, kısa eksen ortalanır.
  const span = Math.max(spanX, spanY) || 1;
  const usable = 1 - pad * 2;

  return found.map((f, i) => ({
    name: f.name,
    x: pad + usable * (0.5 + (xs[i] - (Math.min(...xs) + spanX / 2)) / span),
    y: pad + usable * (0.5 - (ys[i] - (Math.min(...ys) + spanY / 2)) / span),
  }));
}
