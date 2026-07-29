# NeoSaniye Factory Rules

## Görsel yön

- Tek görsel yön: **editoryal kesik-kağıt kolaj** (Vox / video-essay dili).
- Çıktı **1080x1920, 30 fps, 9:16**. Referans malzeme 16:9 yazıyor; biz Shorts
  kanalıyız, dikey bağlayıcıdır.
- Palet `src/design/tokens.ts` içinde ve **ölçülerek** belirlendi (referans
  videonun 17 çekiminden piksel sayımı). Renk eklenmez, token değiştirilir.
- **Tek aksan rengi** (altın `#D2A03C`) ve cimri kullanılır: karenin en fazla
  %8'i. Referansta ölçülen %3.6. `verify-render.py` bunu denetler.
- Alternatif stil, ikinci palet, ikinci font ailesi eklenmez.

## Neyi kod çizer, neyi görsel modeli üretir

Bu ayrım mimarinin merkezinde:

- **Kod çizer**: harita, rota, zaman çizelgesi, grafik, ok, marker dairesi,
  ikon ızgarası, tipografi, çöp adam figürleri, kağıt dokusu, gölge, kontur.
  Referans videonun çekimlerinin yaklaşık üçte ikisinde hiç fotoğraf yok.
  Bir görsel modeli doğru bir ok ya da okunur bir harita çizemez; kod çizer.
- **Görsel modeli üretir**: yalnızca halftone fotoğraf cutout'ları (kişi, yer,
  nesne), alfa kanallı.
- **Image-to-video modeli kullanılmaz.** Build-on assembly (öğelerin boş kağıt
  zeminden tek tek girmesi) `src/motion/stepped.ts` içinde kodla yapılır.
  Referans prompt'un istediği "kamera kilitli, yerleşen öğe bir daha oynamaz"
  davranışı kodda bedava; bir video modelinden dilenmesi gerekmiyor.

## Hareket

- Stop-motion kadansı: `stepped()` kareyi 12 fps adımına oturtur. Ölçülerek
  doğrulandı (30fps'de 60 karede 24 ayrı konum, tutma deseni 3,2,3,2).
- **Kompozisyon kilitli.** Sahne başına en fazla İKİ katmana `drift()` verilir.
  Her katman oynarsa sonuç kayan slayt gösterisi olur; referansta ölçülen
  davranış arka planın/metnin/okun tamamen sabit kalmasıydı.
- Kamera hareketi yok: zoom, pan, tilt, dolly hiçbiri.
- Sahneler arasında **sert kesme**. Çapraz geçiş, fade, wipe kullanılmaz.

## Metin

- Etiket en fazla 4 kelime (`LABEL_MAX_WORDS`). Uzun etiket hem görsel
  modelinde hem kompozisyonda bozulur.
- Klasik akan altyazı yok. Sahne başlığı, etiket ve alıntı kartı kullanılır.
- Anlam taşıyan hiçbir öğe `SAFE_BOX` dışına çıkmaz — Shorts arayüzü alt
  330 px, sağ 150 px, üst 150 px'i yiyor.
- Vurgu `*yıldız*` ile işaretlenir, `Highlight` altın barı çizer.

## Anlatı

- Fern DNA'sı: sürekli anlatı, tek blok. Cold open tarih + yer + tek somut
  eylemle açar. Her cümle tek fikir taşır, çünkü her cümle bir görsel beat olur.
- 2.5 kelime/saniye. Beat 2-3 saniye, 4-8 kelime.
- Son satır cliffhanger: 12 kelimeden kısa ve **bölünmez**.
- Beat türü → sahne şablonu eşlemesi `pipeline/beats.mjs` içinde. Soyut beat
  çöp adam alır, olgusal beat halftone cutout alır.
- Tek şablon sahnelerin %34'ünden fazlasını kaplamamalı.

## Determinizm

- `Math.random` yasak. Varyasyon `rand(seed)` ile üretilir.
- Render sırasında karar verilmez: bütün kararlar `content/storyboard.json`'da,
  derleyici tarafından önceden alınır.
- Aynı girdi → aynı kare. Test bunu doğrular.

## Yayın ve otomasyon

- **Upload mantığı eklenmez.** YouTube, Meta, hiçbir platform.
- Workflow'lar kullanıcı açıkça istemedikçe **yalnızca manuel** (`workflow_dispatch`).
  Cron yok, `push` tetikleyicisi yok.
- Kullanıcı açıkça söylemedikçe workflow çalıştırılmaz, render alınmaz, ücretli
  API çağrılmaz.
- Eksik sağlayıcı anahtarı atlanır. Kota/sağlayıcı hatası sıradaki sağlayıcıya
  düşer, işi patlatmaz.

## Konu başına kod yazılmaz

Eski repodaki hata buydu: `Scene01Hook.tsx`…`Scene07Payoff.tsx` diye konuya
gömülü bileşenler. Her yeni konu elle kodlama gerektiriyordu. Sahne şablonları
konuya değil **beat türüne** bağlıdır; yeni konu yalnızca `content/story.json`
değişikliğidir.
