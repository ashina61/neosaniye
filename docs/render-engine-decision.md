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
