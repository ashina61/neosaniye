# NeoSaniye Reel Bible

Bu dosya bütün NeoSaniye reel'lerinde korunacak hareket dilini tanımlar. Makine
karşılığı `remotion/src/engine/`, `remotion/src/rigs/` ve `ReelSpec`tir.

## 1. Format

- 1080×1920, 9:16
- 30 fps render, **12 fps posterize adımı** (hareket kayar değil zıplar)
- H.264, `yuv420p`
- ana hedef 30–58 saniye
- telefon ekranında tek odak

## 2. Seslendirme kaynak koddur

Her satır bir beat, her beat bir rig. Bir satır yazılmadan sahne düşünülmez.
Beat sheet (`beat-sheet.md`) her koşuda üretilir ve şunu taşır: satır → rig →
ekrandaki kelimeler → varlıklar → SFX → pencere.

Ekrandaki kelimeler satırın **birebir parçasıdır**. Anlatıcının söylemediği bir
altyazı, birinciyle yarışan ikinci bir sestir.

## 3. Rig kütüphanesi

| Rig | İzleyicinin gördüğü olay | İmza hareketi |
| --- | --- | --- |
| `portal-zoom` | hikâye açılır | çerçeveli fotoğrafın İÇİNE uçmak (weld → detach) |
| `villain-punch` | biri reddeder, alay eder, dayatır | yükselen figür, slot makinesi, negatif flicker |
| `paper-drop` | satır bir LİSTE taşır | üç yönden düşen manşet kartları |
| `grounded-punch` | düşüş, kapanış, çöküş | ayakta çapalanmış parallax punch + karakterin kendi gölgesi |
| `money-room` | ödeme, sayı, zafer | kodla çizilen lamba ışığı + hold-keyframe parlama |
| `finale-clone` | kapanış cümlesi | `grounded-punch` klonu + sönümlenen jest |

Kurallar:

- İlk satır her zaman `portal-zoom`, son satır her zaman `finale-clone`.
- Aradaki rigi satırın kelimeleri seçer; sıra değil.
- Aynı mekanik üst üste üç beat çalışamaz (ikinci kez motif, üçüncü kez hata).
- Yeni mekanik eklemek yerine mevcut rigi klonla ve yeniden giydir.

## 4. Hareket motoru

`remotion/src/engine/motion.ts` — her rigin kullandığı tek kaynak:

- `posterizeTime` — 12 fps adımı; bütün hareket bunun üstünde çalışır
- `boil` — cutout'un nefesi (±%0.5 ölçek, ±0.5° salınım)
- `drift` / `pingpong` — parallax ve sarkaç
- `entrance` — düşük sertlik + biraz kütle: eller gibi bırakır, çarpmaz
- `dampedWag` — sönümlenen sallanma (jest)
- `holdKeyframes` — anlık aç/kapa; flicker'da geçiş YOK

## 5. Film görünümü

`remotion/src/engine/FilmLook.tsx`, sırayla: scan çizgileri → grain (multiply,
ters çevrilmiş) → grunge (color-burn) → vignette; üstüne gate weave ve grade.
Dokular kodla çizilir; koşu sırasında kaybolacak doku dosyası yoktur.

Grade dört değerdir (`saturate`, `contrast`, `sepia`, `brightness`) ve beat
başına açıktır: düşüş beat'i diğerlerinden daha çok doygunluk kaybeder.

## 5b. Kimlik — video başına, sahne başına değil

`src/story/look.js` konudan deterministik olarak seçer:

- **renk dünyası** — altı aile (suç, felaket, bilim, doğa, para, arşiv), her
  ailede birden çok vurgu rengi
- **film işlemesinin şiddeti** — grain, scan aralığı, vignette, weave miktarı
- **prop çizimleri** — çerçeve (ornate/museum/brass), gazete başlığı, jest
  (köpük el / açık avuç / damga), ışın sayısı
- **koreografi yönü** — hangi kenardan giriş, lamba hangi tarafta, kartlar
  hangi sırayla, punch ne kadar sert

Değişmezler:

- Bir rig kendi rengini yazamaz; palet context'ten gelir ve testle korunur.
- Rig grade'i videonun grade'ini ÇARPAR (`gradeDelta`), yerine geçmez.
- Görünüm video içinde tektir: sahne başına renk değiştirmek çeşitlilik değil,
  altı ayrı videodan kesilmiş hissi üretir.
- Seçim konudan gelir, rastgele değildir: aynı üretim her koşuda ve her
  paralel Remotion işçisinde aynı kareyi verir.

## 6. Malzeme dili

- Fotoğraf BULUNUR, grafik ÇİZİLİR.
- Sahne başına 3–4 varlık yeter: arka plan, karakter, bir-iki prop.
- **Her rigin çizilmiş bir DEKORU vardır** (`remotion/src/engine/stage.tsx`):
  galeri duvarı, patron odası, masa, sokak, çalışma odası. Bulunan fotoğraf bu
  dekorun ÜSTÜNE biner; fotoğraf yoksa kadraj yine kurulmuş bir mekândır.
- Dekoru mekân yapan üç şey: ufuk çizgisi (perspektifli zemin), TEK ışık
  kaynağı (gerisi karanlığa düşer) ve derinlik sırası (fon → mimari → ön
  karanlık).
- Karakter fotoğrafı yoksa figür ÇİZİLMEZ; mobilya çizilir (boş koltuk, hâlâ
  tüten duman). Prosedürel siluet her denemede tabela piktogramı oldu.
- Gölge ayrı varlık değildir: karakterin kopyası siyaha boyanır, ayaktan
  aşağı çevrilir, zemine yatırılır.
- Işık fotoğrafta yoktur: screen blend gradyanlarla çizilir ve odak kaçarken
  büyür (gerçek defocus parlaması büyür).

## 7. Tipografi

- Aynı anda tek fragman kadrajı sahiplenir; altyazılar üst üste yığılmaz.
- Serif italik anlatı sesi, sticker/slot sayı sesidir.
- Bir propun gösterdiği metni altyazı tekrar etmez.
- Kelimeler kendi karanlık halesini taşır; altyazı kutusu kullanılmaz.
- Shorts arayüzünün alt ve sağ güvenli alanları boş bırakılır.

## 8. Ses

- Narration en üstte, tam seviyede.
- Müzik konuşma penceresinde kısılır, boşluklarda yükselir.
- SFX yalnız rigin olayında vurur: deklanşör fotoğraf anında, kâğıt kart
  yere değdiğinde, cha-ching sayı okunduğunda.
- Aynı aile art arda kullanılmaz; final boom konuşmayı örtmez.

## 9. Kalite kabulü

Bir video ancak şunları sağladığında üretim adayıdır:

- her beat `production.json` içinde tanımlı,
- her altyazı kendi satırında birebir geçiyor,
- yerleşimlerin çoğu ölçülmüş konuşmadan geliyor (`timing` alanı),
- final dosya 1080×1920 ve sesli,
- decode hatası yok, uzun siyah/donma/sessizlik penceresi yok,
- final MP4 hash'i analiz edilen dosyayla aynı,
- kaynak/lisans manifesti mevcut,
- hook ilk üç saniyede görsel olay başlatıyor,
- final beat hook'taki soruyu gerçekten kapatıyor.

Eski FFmpeg montaj, ASS overlay, ayrı CTA post-pass, outro kartı ve kolaj
şablon hattı bu mimarinin parçası değildir.
