import test from 'node:test';
import assert from 'node:assert/strict';
import {locate, projectRoute} from '../pipeline/gazetteer.mjs';

/**
 * SABİT KOORDİNAT HATASININ KAPISI.
 *
 * `map_route` ve `evidence_board` rotayı elle yazılmış x/y sabitleriyle
 * çiziyordu, yani Portland → Seattle ile Londra → Tokyo aynı çizgiydi.
 * Etiketler doğru olduğu için hata gözle yakalanmıyordu — doğru etiket yanlış
 * geometriyi meşrulaştırıyor.
 *
 * Bu kapı YÖN denetliyor, piksel değil: ölçek ve kenar payı değişebilir ama
 * Seattle her zaman Portland'ın KUZEYİNDE kalmak zorunda.
 */
test('rota gerçek coğrafyayı taşıyor', () => {
  const [portland, seattle] = projectRoute(['Portland', 'Seattle']);
  assert.ok(seattle.y < portland.y, 'Seattle Portland’ın kuzeyinde olmalı (ekranda yukarıda)');
  assert.ok(
    Math.abs(seattle.x - portland.x) < 0.2,
    `ikisi de aynı boylamda, rota neredeyse dikey olmalı — fark ${Math.abs(seattle.x - portland.x).toFixed(2)}`,
  );

  const [london, tokyo] = projectRoute(['London', 'Tokyo']);
  assert.ok(tokyo.x > london.x, 'Tokyo Londra’nın doğusunda olmalı');
  assert.ok(
    Math.abs(tokyo.x - london.x) > Math.abs(tokyo.y - london.y),
    'doğu-batı mesafesi kuzey-güneyden büyük, rota yatay olmalı',
  );

  // İKİ FARKLI ROTA AYNI ÇİZGİ OLAMAZ — düzeltilen hatanın kendisi buydu.
  const a = projectRoute(['Portland', 'Seattle']);
  const b = projectRoute(['Seattle', 'Miami']);
  assert.notDeepEqual(
    a.map((p) => [p.x.toFixed(2), p.y.toFixed(2)]),
    b.map((p) => [p.x.toFixed(2), p.y.toFixed(2)]),
    'farklı rotalar aynı koordinatları veriyor — sabit koordinat hatası geri gelmiş',
  );
});

/**
 * BİLİNMEYEN YER HARİTA ÇİZDİRMEZ.
 *
 * Bilinmeyen adı karenin ortasına koymak, düzeltilen hatanın aynısı olurdu.
 * `null` dönmesi çağıranın şablonu reddetmesini sağlıyor.
 */
test('bilinmeyen yer null döner', () => {
  assert.equal(locate('Atlantis'), null);
  assert.equal(projectRoute(['Atlantis', 'Seattle']), null);
  assert.equal(projectRoute(['Seattle', '']), null);
  // Jenerik ek atılıp yeniden denenir, ama baştaki kelime korunur:
  // "New Orleans" ile "Orleans" ayrı yerler.
  assert.deepEqual(locate('New York City'), locate('New York'));
});
