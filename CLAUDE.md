Bu depo **seslendirme-önce kodlanmış reel fabrikası**dır.

Tek cümlelik yasa: **SESLENDİRME KAYNAK KODUDUR.** Önce metin kilitlenir; sonra
her satır kendi sahnesini, ekrandaki kelimelerini, süresini ve ses efektlerini
dikte eder. Sahne yazılmaz, satırdan TÜRETİLİR.

Giriş noktası `npm run produce` — script → TTS → beat sheet → medya → Remotion
render → yayın. Otomatik koşu `.github/workflows/daily-short.yml`.

## Zincir

```
seslendirme satırları (script.scenes[].narration)
        ↓  ölçülmüş TTS kelime zamanları
src/pipeline/canonicalTimeline.js           → beat pencereleri
        ↓
src/story/palette.js + look.js              → VİDEONUN KİMLİĞİ (üretilir)
src/story/setPlan.js + subject.js           → HER SATIRIN ODASI VE NESNESİ
        ↓
src/story/beatSheet.js + src/story/rigs.js  → BEAT SHEET
        ↓
src/video/buildReelSpec.js                  → production.json + beat-sheet.md
        ↓
remotion/src/Reel.tsx → engine/ + rigs/     → final MP4
```

## Değişmez kurallar

1. **Ekrandaki her kelime, o an söylenen satırın birebir parçasıdır.**
   Yazılmış, uydurulmuş, özetlenmiş altyazı yoktur. `test/beatSheet.test.js`
   bunu kapı olarak tutar.
2. **Yerleşim ölçülür, tahmin edilmez.** Altyazı, kart ve SFX; kelimenin
   gerçekten söylendiği kareye oturur. Tahmine düşen yerleşim sayısı
   `production.json` içindeki `timing` alanında raporlanır.
3. **Sahneyi rig seçer, şablon değil.** Altı mekanik: `portal-zoom`,
   `villain-punch`, `paper-drop`, `grounded-punch`, `money-room`,
   `finale-clone`. İlk satır her zaman portal, son satır her zaman finale;
   arası satırın KELİMELERİNE bakar, sırasına değil.
4. **Görünüm tek yerden gelir.** Stop-motion adımı (12fps posterize) ve film
   işlemesi `remotion/src/engine/` içindedir. Hiçbir rig kendi grain'ini,
   vignette'ini veya grade'ini yazmaz.
5. **Her değer proptur.** Rig içinde gizli sabit bırakılmaz; değerler
   `production.json` üzerinden değişir ve Remotion Studio'daki rig
   kompozisyonunda canlı ayarlanır.
6. **Klonla, yeniden yazma.** `finale-clone` = `grounded-punch` + yeni karakter
   + yeni kelimeler + jest. Yedinci mekanik gerçekten gerekmedikçe eklenmez.
7. **Kelimeler her zaman kazanır.** Müzik konuşma penceresinde kısılır, SFX
   yalnız rigin olayında vurur, kota doldurmak için efekt eklenmez.
8. **RENK VE ODA ÜRETİLİR, LİSTEDEN SEÇİLMEZ.** `src/story/palette.js` konudan
   ton türetir ve dokuz rolü kontrast kurallarıyla hesaplar;
   `src/story/setPlan.js` her satır için oda planı (ufuk, yapı, ritim, açıklık,
   zemin, ışık, pus) üretir. Menü ne kadar uzun olursa olsun konu sayısı
   menüyü aşınca tekrar başlar — bu yüzden menü değil jeneratör.
9. **GÖRÜNÜM VİDEO BAŞINA SEÇİLİR, SAHNE BAŞINA DEĞİL.** `src/story/look.js`
   konudan deterministik olarak seçer: renk dünyası, film işlemesinin şiddeti,
   propların hangi çizimi kullanacağı ve koreografinin yönü. Bir rig kendi
   rengini YAZAMAZ (`test/remotionOnly.test.js` sabit hex'i düşürür) ve rig
   gradesi videonun gradesini çarpar, yerine geçmez. Bu kural olmadan altı
   kodlanmış rig her videoda birebir aynı kareyi çizer — kolaj hattının
   öldüğü hata tam olarak buydu.

## GÖRSEL MALZEME SINIRI — bu deponun en pahalı dersi

Kolaj hattı (`collage-factory-son`, commit 51ae3cf) **görsel malzemeyi
üretemediği için** terk edildi: bedava üreticiler dört ayrı turda masaya konmuş
kitap fotoğrafı, çerçeveli baskı ve bozuk yazı verdi; prosedürel siluetler
tabela piktogramı olmaktan çıkmadı.

Bu hat aynı duvara çarpmaz çünkü iş bölümü nettir:

- **FOTOĞRAF BULUNUR** — arka planlar ve özneler stok/arşiv kaynaklardan gelir
  (`src/media/`). Rig onları düz plaka olarak kullanır, temiz cutout beklemez.
- **GRAFİK ÇİZİLİR** — çerçeve, plaket, gazete, lamba ışığı, gölge, köpük el,
  slot makinesi: hepsi `remotion/src/engine/props.tsx` içinde kodla çizilir.
  Hiçbiri üretilmez, indirilmez, koşu sırasında kaybolmaz.
- **DERİNLİK OYNATILIR** — 3D yok, plugin yok: ayakta çapalanmış parallax
  punch, karakterin kendisinden yapılan gölge, screen-blend ile çizilen ışık.

Bir sahne tek plakayla da ayakta kalmak zorundadır: medya katmanı boş dönerse
rig kodla çizdiği parçalarla devam eder, kara kare vermez.

Kolaj turlarında ölçülen ve bu hatta taşınan iki ders:
· beat süreleri gerçek konuşma süresinden ölçülür (tahminle senkron tutmaz)
· arşiv sorgusu konunun adını taşır ve dönen sonuç alaka kapısından geçer

## Süre sözleşmesi

Ölçülmüş TTS süresi hedef bandın dışındaysa medya ve render maliyetine
girilmeden koşu durur (`src/pipeline/durationPolicy.js`).
