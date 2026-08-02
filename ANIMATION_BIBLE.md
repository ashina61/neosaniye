# NeoSaniye Remotion Design Bible

Bu dosya NeoSaniye'nin bütün Shorts videolarında korunacak motion-graphics dilini
tanımlar. Makine karşılığı `remotion/src/` bileşenleri ve `ProductionSpec`tir.

## 1. Format

- 1080×1920, 9:16
- 30 fps
- H.264, `yuv420p`
- ana hedef 30–58 saniye
- telefon ekranında okunabilir tek odak

## 2. Marka paleti

- mürekkep: `#171511`
- krem kâğıt: `#efe6d3`
- açık kâğıt: `#f8f1e4`
- altın vurgu: `#d5a52d`
- koyu altın: `#9b6d11`
- pale teal: `#9fc8c6`
- koyu teal: `#4b7778`
- vurgu kırmızısı: `#bc493f`
- koyu lacivert: `#172433`

Bir sahnede ana vurgu rengi altın; teal yardımcı bilgi veya rota rengidir. Kırmızı
yalnız tehlike, hata, darbe veya final twist için kullanılır.

## 3. Malzeme dili

- krem/yıpranmış kâğıt tabanı
- siyah-beyaz veya düşük doygunluklu cutout özneler
- beyaz kontur ve yumuşak sert gölge
- yırtık kâğıt kartları
- bant, damga, işaret kalemi ve çizim izleri
- kontrollü film grain, vignette ve gate weave

Doku bilgiye hizmet eder. Ekrana aynı anda üçten fazla dekoratif parça konmaz.

## 4. Sahne şablonları

Her beat tam bir görsel göreve bağlanır:

| Şablon | İzleyicinin gördüğü olay |
| --- | --- |
| `hook-reveal` | tek büyük çelişki veya imkânsız görüntü |
| `portrait-dossier` | kişi/özne + kanıt kartları |
| `document` | belge üzerinde gerçek bilgi vurgusu |
| `map-route` | başlangıçtan hedefe ilerleyen rota |
| `stat-slot` | büyük sayı + ölçek karşılaştırması |
| `explainer-diagram` | neden-sonuç veya adım akışı |
| `transaction` | değer/nesne iki taraf arasında değişir |
| `consequence` | önceki olayın ölçülebilir sonucu |
| `final-twist` | ilk hook'u cevaplayan son reveal |
| `collage-generic` | yalnız özel şablon yoksa kullanılır |

## 5. Hareket kuralları

- Girişler spring tabanlıdır; zıplama tek kez olur.
- Kamera zoom'u bilgi taşımıyorsa kullanılmaz.
- Yavaş drift/parallax arka planı canlı tutar, ana olayla yarışmaz.
- Belge, sayı ve karşılaştırma sahnesinde kamera mümkün olduğunca sabittir.
- Geçişler kısa cut, whip-flash, shutter veya paper-tear ailesindedir.
- Aynı geçiş arka arkaya üç kez tekrarlanmaz.
- İlk kare ve final kare loop için görsel akrabalık taşır.

## 6. Tipografi

- Hook: en fazla 3–7 kelime, tek bakışta okunur.
- Kinetic text yalnız anlatının vurucu kelimesini taşır.
- Tam konuşmayı ekranda sürekli altyazı şeridi olarak tekrarlama.
- En önemli kelime boyut/renk değişimiyle ayrılır.
- Shorts arayüzünün alt ve sağ güvenli alanları boş bırakılır.

## 7. Ses

- Narration her zaman ana katmandır.
- Müzik özgün/procedural veya lisans manifestli kaynaktır.
- SFX yalnız olay başladığında kullanılır; kota doldurmak için kullanılmaz.
- Aileler: whoosh, focus, paper, stamp, impact, cash, heartbeat, boom.
- Aynı SFX ailesi art arda kullanılmaz.
- Final boom konuşmayı örtmez.

## 8. Kalite kabulü

Bir video ancak şunları sağladığında üretim adayıdır:

- her sahne `production.json` içinde tanımlı,
- final dosya 1080×1920 ve sesli,
- decode hatası yok,
- uzun siyah/donma/sessizlik penceresi yok,
- final MP4 hash'i analiz edilen dosyayla aynı,
- kaynak/lisans manifesti mevcut,
- hook ilk üç saniyede görsel olay başlatıyor,
- final sahne hook'taki soruyu gerçekten kapatıyor.

Eski FFmpeg montaj, ASS overlay, ayrı CTA post-pass veya outro kartı bu mimarinin
parçası değildir.
