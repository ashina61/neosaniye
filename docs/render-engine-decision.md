# Render motoru kararı — ASS mi, tarayıcı mı, Remotion mu?

**Tarih:** 27 Tem 2026 · **Durum:** ölçüldü, karar bekliyor

## Soru

Overlay katmanımız elle yazılmış ASS/libass vektör çizimi. Bu yüzden:

- Daireler elipsti (kübik Bézier kontrol noktası elle hesaplanıyordu, `(4/3)k`
  yerine `k` yazılmıştı — sistemdeki her daire %25 basıktı).
- Yazı yerleşimi elle: font boyutu hesabı, `split-before-shrink`, satır sayısı
  kontrolü, güvenli alan kontrolü. Hepsi kendi kodumuz.
- Panel, ızgara, tablo, ikon gibi şeyler tek tek dörtgen çizerek kuruluyor.

Alternatif: tarayıcıyı çizim motoru olarak kullanmak (Remotion bunu React ile
paketliyor).

## ÖLÇÜLEN GERÇEKLER

Bu ortamda, `scripts/bench-browser-overlay.mjs` ile:

| Ölçüm | Değer |
|---|---|
| Chromium açılış | 443 ms |
| Ekran görüntüsü (1080×1920, kalıcı tarayıcı) | **124 ms** medyan (104–205) |
| Tek seferlik `--screenshot` (süreç başlatma dahil) | 1.4 s |
| Şeffaflık | ✅ RGBA, `omitBackground` çalışıyor |
| ffmpeg ile bindirme | ✅ SSIM 0.954 (görünür), alfa korunuyor |

Bundan çıkan iki senaryo:

- **Kare kare** (40 sn @30fps = 1200 kare): **~2.5 dakika**. Boş sayfada.
  Gerçek fotoğraf + efekt ile daha yavaş olur; GitHub Actions'ın 2 çekirdekli
  runner'ında 5-8 dakika beklenir. Mevcut boru hattı zaten ~10 dakika.
- **Durum bazlı** (sahne başına ~3 anahtar durum, 10 sahne = 30 PNG):
  **~4.2 saniye**. Animasyonu ffmpeg yapar (fade/move/overlay).

Aradaki fark **35 kat**.

## Remotion

- Sürüm 4.0.499. Lisans alanı: `SEE LICENSE IN LICENSE.md` — **MIT değil**,
  kendi ticari lisansı var. Şirket büyüklüğüne bağlı ücretli kullanım şartı
  içeriyor; ffmpeg/libass'in aksine "al kullan" değil. Kullanmadan önce
  LICENSE.md okunmalı.
- Teknik olarak zaten sahip olduğumuz şeyi (tarayıcı render) React + zaman
  çizelgesi yardımcılarıyla paketliyor. Yetenek yeni değil, ERGONOMİ yeni.
- Bedeli: kompozisyonun tamamını Remotion sahiplenir. Bizim canonical timeline,
  overlay pencereleri, klip kimlikleri, final MP4 doğrulayıcı ve yayın
  kapılarımızın hepsi ffmpeg boru hattına bağlı. Remotion'a geçmek QC
  katmanının yeniden bağlanması demek.

## DEĞERLENDİRME

Çıktımızla "premium" bir çıktı arasındaki görünür fark büyük ölçüde
**overlay kalitesi**: tipografi, panel, hizalama, ikon, tablo. Kamera hareketi,
geçiş ve montaj tarafında ffmpeg zaten iyi ve hızlı.

Tarayıcı tam olarak o farkı kapatıyor — **ve Remotion olmadan da elimizde.**
Chromium kurulu, ölçüldü, çalışıyor.

## ÖNERİ: hibrit

```
Metin/panel/diyagram overlay'leri  → HTML/CSS → şeffaf PNG (tarayıcı)
Montaj, kamera, geçiş, ses, QC     → ffmpeg (değişmez)
```

Kazanç:
- Gerçek yerleşim motoru: split-screen, etiket, tablo, ızgara bedava doğru.
- Gerçek tipografi: font sığdırma kodumuz çöpe gider.
- Elips hatası gibi el yapımı geometri hataları imkânsız hâle gelir.
- Lisans sorunu yok, yeni ağır bağımlılık yok (`playwright-core` ~2 MB).
- Timeline integrity, publish gate, final MP4 doğrulayıcı **hiç değişmez**.

Risk:
- Yeni bir başarısızlık noktası (tarayıcı açılmazsa). Fallback: mevcut ASS yolu
  korunur, overlay üretilemezse ona düşülür.
- Font tutarlılığı: runner'da hangi fontlar var, sabitlenmeli (WOFF gömülü).

## ALTERNATİF: tam Remotion

Daha bütünlüklü bir DX verir ama lisans + QC yeniden bağlama + render süresi
maliyeti getirir. Kanal tek kişilikse lisans muhtemelen sorun değil; yine de
okunmadan girilmemeli.

## KARAR NOKTASI

Bu bir mimari tercih ve maliyeti/riski sahibinin kararı. Ölçümler yukarıda.

---

# EK: Referans video analizi — "Wayfinder" (27 Tem)

Karşılaştırma için bir referans video incelendi.

## Ölçülenler

| | Referans | Bizim son çıktı |
|---|---|---|
| Format | **1280×720 YATAY** | 1080×1920 dikey |
| Süre | **125 sn** | 31.6 sn |
| Gerçek sahne kesmesi | **20** (≈6.3 sn/kesme) | 13 klip (≈2.4 sn/klip) |
| Değişim temposu | **0.66 sn** | 0.74 sn |
| Algılanan değişim | 188 / 250 örnek | 37 / 63 örnek |
| En uzun donuk | 6.5 sn | 3.0 sn |
| Bit hızı | 1.73 Mbps | ~5.2 Mbps |

**En önemli satır burada:** referans 125 saniyede yalnızca **20 kez kesiyor** ama
ekran **0.66 saniyede bir** değişiyor. Yani hareket KESMEDEN değil, sahnenin
İÇİNDEN geliyor: öğeler sırayla giriyor, oklar çiziliyor, etiketler beliriyor.

Bizde tempo sayısı benzer (0.74) ama kaynağı farklı: 13 statik fotoğrafı hızlı
kesip üstlerine Ken Burns uyguluyoruz. Sayı aynı, izlenim değil.

## Görsel dil

Referansın tamamı **tasarlanmış kolaj**: krem kâğıt dokusu, siyah-beyaz halftone
kesikler (beyaz kontur + altın gölge), altın vurgu, mat turkuaz su. Tek palet,
tek çizgi kalınlığı, tek doku — 125 saniye boyunca hiç bozulmuyor.

Gözlenen anlatım kalıpları:
- **Etiketli özne**: figürün yanında altın hapta `MAU PIAILUG`.
- **Alıntı tipografisi**: serif italik, anahtar ifadenin üstünde altın fosforlu
  kalem vurgusu.
- **Süreç şeridi**: raptiyeli üç polaroid (harita → grafik → ada), aralarında ok.
- **Bölünmüş ekran**: dikey ayırıcı; üstelik o bölümde PALET DEĞİŞİYOR
  (krem kolaj → lacivert + beyaz çizgi figür) — karşıtlık renkle de anlatılıyor.
- **Yön okları**: suyun üstünde el çizimi oklar, hareket yönünü gösteriyor.

**Tek bir fotogerçekçi AI görseli yok.** Her kare bileşenlerden KURULMUŞ.

## Sonuç: fark render motoru değil

Bizim yaklaşımımız "sahne başına bir AI fotoğrafı üret, üstüne overlay koy".
Onlarınki "bir tasarım sistemi kur, her sahneyi o sistemin parçalarından
KOMPOZE et". Premium hissi buradan geliyor.

Remotion bu işi KOLAYLAŞTIRIR ama YARATMAZ. Aynı kolajı ffmpeg+ASS ile de,
tarayıcı+HTML ile de kurabiliriz — eksik olan motor değil, **sanat yönetimi ve
varlık stratejisi**:

1. Sabit palet + doku (kâğıt zemin, halftone kesik, tek vurgu rengi).
2. Yeniden kullanılabilir kesik kütüphanesi (özne, nesne, ok, yıldız, hap etiket)
   — her sahnede sıfırdan fotoğraf üretmek yerine.
3. Hareketin sahne İÇİNDE olması: öğeler sırayla girsin, kesmeye yaslanma.
4. Karşıtlıkta palet değiştirme.

Bunlar tarayıcı overlay katmanıyla çok daha kolay yapılır (yerleşim motoru,
gerçek tipografi, SVG) — yani hibrit öneri bu bulguyla GÜÇLENİYOR, ama sıralama
değişiyor: önce sanat yönetimi, sonra motor.

## Bilinmeyen

Videonun gerçekten Remotion ile yapılıp yapılmadığını doğrulayamam; dosyada
böyle bir iz yok. Başlıkta "Made with AI" yazıyor ama bir tasarımcının AI
varlıklarıyla elle kurgulamış olması da mümkün. Ölçtüğüm şey ÇIKTI, süreç değil.
