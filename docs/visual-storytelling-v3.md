# V3 — Visual Decoration'dan Visual Storytelling'e

> Bu belge KOD DEĞİL, tasarım kararıdır. 26 Tem audit'inin ardından mevcut
> sistem yeniden incelendi; aşağıdaki teşhis ve mimari, ölçüme ve çalışan bir
> kanıt-render'a dayanıyor.

## 1. Teşhis: neden hâlâ dekorasyon üretiyoruz

### 1.1 Kök neden — SIRALAMA (en önemlisi)

`src/pipeline/run.js` içinde:

```
satır 182:  const media = await generateImages(...)   ← GÖRSEL ÜRETİLİR
satır 229:  const video = await renderVideo(...)      ← directSemantics burada çalışır
```

Anlatımın anlamı, **görsel var olduktan SONRA** çözümleniyor. Bu durumda
anlamın yapabileceği tek şey görselin ÜSTÜNE bir şey yapıştırmaktır.

> **Dekorasyon = anlamın görselden SONRA eklenmesi.**
> **Hikâye anlatımı = görselin anlama HİZMET ETMEK ÜZERE üretilmesi.**

Somut sonuç: "Termit yuvası sıcaklığı sabit tutuyor" cümlesi için Görüntü
Yönetmeni `image_prompt` olarak *"sinematik termit yuvası çekimi, altın ışık"*
yazıyor. O görsel üretildikten sonra hava akışını göstermenin hiçbir yolu
kalmıyor — çünkü kadrajda kesit yok. **Görsel, hikâyeyi baştan imkânsız
kılıyor.**

Doğru sıra:

```
anlatım → GÖRSEL HİKÂYE (ne olacak?) → o hikâyeyi barındırabilecek görsel
        → aktörlerin koreografisi → kamera → kesme
```

### 1.2 İkinci kök neden — söz dağarcığı STATİK

`semanticShots.js` KART ve PANEL çiziyor: sayı kartı, harita paneli,
split-screen, adım kartları. Kartlar kadrajın ÜSTÜNDE durur; görselin
içeriğine hiç dokunmaz. Kart ne kadar iyi tasarlanırsa tasarlansın bir
overlay'dir.

Hikâye anlatımının söz dağarcığı **AKTÖRLER**dir: büyüyen bir iz, A'dan B'ye
giden bir ok, ısınan bir bölge, soyulan bir katman, dolan bir hacim. Bunlar
kadrajın İÇİNDE, görselin uzayında yaşar.

### 1.3 Üçüncü — kameranın gerekçesi yok

`motionPlan.js` hareketi metin anahtar kelimesinden + anti-tekrar kuralından
seçiyor. Öznenin nerede olduğunu, izleyicinin neyi fark etmesi gerektiğini
bilmiyor. Kamera hareketi hikâyeden DEĞİL, çeşitlilik ihtiyacından doğuyor.

### 1.4 Dördüncü — mikro plan sayısı

Şu an: 10-11 sahne + tempo bölmesi ≈ **10-13 plan**. Hedef 20-25.
Kullanıcının tespiti doğru: bu 20-25 farklı GÖRSEL demek değil. Aynı görsel
farklı crop / farklı odak / farklı katman ile tekrar kullanılabilir. Mekanizma
zaten var (`SPLIT_ENABLED`, part0/part1) ama tek bir "punch-in" ile sınırlı.

## 2. Kanıtlanmış yetenek (varsayım değil)

Tasarımı hayal üstüne kurmamak için kritik primitif ÖNCE test edildi
(`scratchpad/proof.mp4`, libass + ffmpeg, yeni bağımlılık yok):

| Primitif | ASS karşılığı | Durum |
|---|---|---|
| Kendini çizen iz | tam yol + `\t(0,N,\clip(...))` genişleyen kırpma | ✅ çalışıyor |
| Yol boyunca yürüyen özne | ardışık `\move()` segmentleri | ✅ çalışıyor |
| Gecikmeli takipçiler | aynı yol, kaydırılmış zaman | ✅ çalışıyor |
| Aşamalı ortaya çıkarma | katman katman `\fad` + `\clip` | ✅ çalışıyor |
| Isınan/soğuyan bölge | renk geçişi `\t(\1c...)` | ✅ (mevcut) |

Yani "termit yürür, arkasında feromon izi oluşur, diğerleri onu takip eder"
sahnesi **bugünkü render hattıyla üretilebilir**.

### Dürüst sınır

Fotoğrafın İÇİNDEKİ gerçek termitin fiziksel olarak yürümesi mümkün değil —
elimizde durağan kare var. Üretebildiğimiz şey, olayı **temsil eden animasyonlu
katman**. Discovery/BBC de filme alınamayan her şeyi böyle anlatır (animasyonlu
kesit, akış diyagramı). Sonuç "canlı çekim" değil, "belgesel grafiği" olarak
okunur — ama izleyici olayı GÖRÜR, sadece duymaz. Gerçek canlı hareket
gerektiğinde tek dürüst kaynak stok video olmaya devam ediyor.

## 3. Yeni mimari

Mevcut modüller korunuyor; araya YENİ bir planlama katmanı giriyor ve sıralama
tersine çevriliyor.

```
generateScript
      ↓
storyPlanner (YENİ)          ← her cümle için görsel hikâye
      ↓  visual_story, viewer_task, focus_target, camera_plan, shot_ladder
generateImages               ← image_prompt ARTIK visual_story'den türer
      ↓
choreographer (YENİ)         ← aktörleri zaman çizelgesine yerleştirir
      ↓
renderVideo + actorLayer (YENİ)  ← aktörleri ASS ile canlandırır
      ↓
silentComprehensionQC (YENİ) ← "sesi kapat, anlaşılıyor mu?"
```

### 3.1 Sahne planı şeması

```jsonc
{
  "narration": "Termites keep the mound at a constant temperature",
  "visual_goal": "Yuvanın kesitinde hava dolaşımını göster",
  "viewer_task": "Sıcak havanın nereden çıktığını takip et",
  "focus_target": "mound_cross_section",
  "story_template": "mechanism",
  "visual_story": [
    { "t": 0.0, "beat": "kesit görünür",        "actor": "cutaway",  "action": "reveal" },
    { "t": 0.8, "beat": "sıcak hava yükselir",  "actor": "arrow_hot","action": "travel_up" },
    { "t": 1.8, "beat": "soğuk hava iner",      "actor": "arrow_cold","action": "travel_down" },
    { "t": 2.8, "beat": "döngü kapanır",        "actor": "loop",     "action": "cycle" },
    { "t": 3.6, "beat": "sıcaklık sabit kalır", "actor": "readout",  "action": "hold_value" }
  ],
  "camera_plan": { "start": "wide", "end": "detail", "motivation": "follow_hot_air" },
  "shot_ladder": ["wide", "cutaway_detail", "readout_closeup"]
}
```

- **image_prompt bu plandan TÜRETİLİR**: `story_template: mechanism` +
  `focus_target: cross_section` → *"cutaway cross-section diagram view of a
  termite mound, chambers and tunnels visible, neutral lighting, side elevation"*.
  Böylece görsel, hikâyeyi barındırabilir hale gelir.

### 3.2 Story template'leri ve kamera dili

Her şablon; hangi aktörleri kullanacağını, kameranın nasıl davranacağını ve
izleyiciye hangi görevi vereceğini tanımlar.

| Şablon | Aktörler | Kamera dili | viewer_task örneği |
|---|---|---|---|
| communication | kaynak, sinyal dalgası, alıcı | kaynakta başla → alıcıya pan | "Sinyalin kime ulaştığını izle" |
| flow / trail | yürüyen özne, büyüyen iz, takipçiler | izi takip eden yavaş pan | "İzi takip et" |
| process | numaralı durak, ilerleyen ok | duraktan durağa atlama | "Sıradaki adımı bul" |
| mechanism | kesit, yön okları, döngü | geniş → kesit detayı | "Havanın yolunu takip et" |
| cause_effect | tetik, zincir, sonuç | tetikte sıkı, sonuçta geniş | "Neyin neyi tetiklediğini gör" |
| chain_reaction | çoğalan düğümler | giderek genişleyen kadraj | "Yayılmayı izle" |
| comparison | iki taraf, ölçü çubuğu | split, iki tarafa da eşit | "Hangisi daha büyük?" |
| scale | referans nesne, büyüyen ölçek | pull-out (küçüklüğü hissettirir) | "Ne kadar büyük tahmin et" |
| timeline | zaman ekseni, ilerleyen imleç | soldan sağa pan | "Ne zaman değiştiğini gör" |
| map | harita, rota, işaret | haritaya zoom-in | "Nerede olduğunu bul" |
| search_reveal | kalabalık, halka, hedef | tarama → kilitlenme → yakınlaşma | "Farklı olanı bul" |
| construction | katmanlar, yükselen yapı | aşağıdan yukarı tilt | "Nasıl yükseldiğini izle" |
| navigation | rota, engel, varış | rotayı takip eden hareket | "Yolu takip et" |
| problem_solution | sorun işareti, çözüm | sorunda sıkı, çözümde açılma | "Çözümü fark et" |

### 3.3 Aktör katmanı (yeni render birimi)

`semanticShots` (kartlar) yerini **aktörlere** bırakır. Aktör = kadrajın
içinde, zaman içinde durumu DEĞİŞEN görsel eleman:

```jsonc
{ "type": "trail",  "path": [[0.2,0.7],[0.4,0.6],[0.7,0.65]],
  "grow": [0.3, 2.6], "color": "accent", "label": "PHEROMONE" }
{ "type": "walker", "path": "...", "at": [0.3, 2.6], "followers": 3, "lag": 0.55 }
{ "type": "flow_arrow", "from": [0.35,0.8], "to": [0.5,0.25], "temp": "hot" }
{ "type": "ring",   "at": [0.62,0.48], "lock": [1.2,1.8] }   // search_reveal
{ "type": "readout","value": 30, "unit": "°C", "hold": [3.6,5.0] }
```

Kartlar tamamen kaybolmaz — sayı/harita gibi bilgiler için hâlâ doğru araç —
ama artık **varsayılan değil, bir aktör türü**.

### 3.4 Mikro plan merdiveni (10-13 → 20-25)

Mevcut tek adımlı punch-in yerine, sahnenin `shot_ladder` alanı planı
belirler. Aynı görselden türetilen planlar:

- `wide` — tam kadraj
- `detail` — %60 crop, focus_target merkezli (odak ÖLÇÜLÜ konumdan gelir)
- `insert` — %35 crop, tek eleman
- `layer` — aynı kadraj, üstünde yeni aktör katmanı belirir
- `reaction` — kadraj sabit, aktör durumu değişir (renk/ölçek)

Her sahne 2-3 mikro plan → 10-11 sahne × 2.2 ≈ **22-24 plan**. Ekstra API
maliyeti YOK (aynı görsel yeniden kadrajlanıyor).

### 3.5 Başarı kriteri: sessiz anlaşılırlık

`visualNarrationQC` yeniden tanımlanır. Artık "kaç efekt var" sayılmaz:

| Ölçüt | Eşik |
|---|---|
| Aktörlü (durum değiştiren) sahne oranı | ≥ %60 |
| Sadece kamera hareketi olan sahne oranı | ≤ %25 |
| viewer_task tanımlı sahne sayısı | ≥ 4 |
| Mikro plan sayısı | ≥ 18 |
| Her sayacın destekleyici görsel süreci var mı | %100 |
| İlk 3 sn'de tamamlanan bir görsel olay | zorunlu |

**"7500 çıkıyor ama neyin 7500'ü?"** sorunu bu tabloda kapanıyor: sayaç artık
tek başına aktör olamaz; bir `readout` aktörü ancak onu besleyen bir süreç
aktörüyle (dolum, sayım, yayılma) BİRLİKTE geçerli sayılır.

## 4. Uygulama sırası (mimariyi bozmadan)

Her faz tek başına sevk edilebilir; bir sonraki faz gelmezse sistem çalışır
durumda kalır.

**Faz 1 — Aktör katmanı (en yüksek etki)**
`src/visual/actors.js` + `actorRenderer.js`. Kanıtlanmış primitifler:
trail/walker/flow_arrow/ring/readout. Mevcut `semanticShots` korunur, aktör
üretilemeyen sahne eskisi gibi davranır. **Görünür fark burada başlar.**

**Faz 2 — storyPlanner ve sıralama tersine**
`src/crew/storyPlanner.js`: cümle → visual_story + viewer_task + camera_plan.
`generateImages` image_prompt'u bu plandan türetir. Kritik değişiklik: hikâye
görselden ÖNCE.

**Faz 3 — Şablon kütüphanesi + kamera dili**
14 şablon, her biri aktör seti + kamera davranışı. `motionPlan` kamerayı
`camera_plan.motivation`'dan alır.

**Faz 4 — Mikro plan merdiveni**
`shot_ladder` → aynı görselden 2-3 kadraj. Odak konumu `focusDetect` ile
ÖLÇÜLÜR (uydurulmaz).

**Faz 5 — Sessiz anlaşılırlık QC**
Yeni eşikler + regresyon testleri.

## 5. Bu tasarımın kaçındığı tuzaklar

Bu projede daha önce yapılmış ve tekrar edilmemesi gereken hatalar:

1. **Kota doldurma.** Ne overlay ne ses; boşluğu anlamsız içerikle doldurma.
   Aktör üretilemiyorsa sahne temiz kalır.
2. **Konum uydurma.** Halka/ok yalnızca ÖLÇÜLMÜŞ konuma çizilir
   (`focusDetect`); emin değilse çizilmez.
3. **Yanlış iddia.** Harita tarihî adı modern ülkeyle eşitlemez.
4. **Çakışma.** Aynı bilgiyi iki katman aynı anda göstermez (gfx kartı +
   semantik sayaç canlıda üst üste bindi).
5. **Varsayımı doğrulanmamış özellik.** Her yeni primitif, tasarımdan ÖNCE
   gerçek render ile kanıtlanır (bu belgedeki §2 gibi).

---

## 6. UYGULAMA DURUMU (5 fazın tamamı sevk edildi)

| Faz | Ne yapıldı | Nerede |
|---|---|---|
| 1 | Aktör katmanı — kadrajın İÇİNDE durum değiştiren 7 eleman | `src/visual/actors.js`, `beatToActors.js` |
| 2 | Sıralama tersine — hikâye ÖNCE, görsel ona göre istenir | `src/crew/storyPlanner.js`, `run.js` Faz 2.9 |
| 3 | Kameranın gerekçesi — hareket hikâyeden türer, gerekirse DURUR | `src/video/motionPlan.js` |
| 4 | Mikro plan merdiveni — aynı görselden 2-3 kadraj | `src/media/generateImages.js` |
| 5 | Sessiz anlaşılırlık kapısı — yeni başarı ölçütleri | `src/pipeline/visualNarrationQC.js` |

### Ölçülen sonuç (tasarım hedefine karşı)

| Ölçüt | Önce | Şimdi |
|---|---|---|
| Mikro plan | 10-13 | ~21 (10 sahne / 44sn tahmini) |
| Kamera gerekçesi | yok (metin anahtar kelimesi + anti-tekrar) | `story:<motivation>` |
| Kameranın durduğu durum | yok | karşılaştırma + adım zinciri |
| Sayaç dayanağı | yok ("7500 ne?") | besleyen süreç ZORUNLU |
| Konum uydurma | vardı | yalnızca ölçülmüş odak |
| Hikâyesiz sahne kapısı | yok | %60 üstü → BAŞARISIZ |

### Kalan bilinen sınır

Fotoğrafın İÇİNDEKİ nesne fiziksel olarak hareket etmiyor; ürettiğimiz, olayı
TEMSİL eden animasyon katmanı (Discovery'nin filme alınamayanı animasyonlu
kesitle anlatması gibi). Gerçek canlı hareket gerektiğinde tek dürüst kaynak
stok video olmaya devam ediyor.

Ayrıca `storyPlanner` şu an DETERMİNİSTİK (LLM yok) — sağlayıcı zinciri
defalarca düştüğü için bilinçli bir karar. Bir LLM zenginleştirme katmanı
ileride EK olarak takılabilir, ama çekirdek ona bağımlı olmamalı.

---

## 7. FAZ 3'ÜN İKİNCİ YARISI (şablon kütüphanesi tamamlandı)

Faz 3 ilk sevkiyatta yalnızca **kamera dili** tarafını kapatmıştı; §3.2'nin
14 şablonundan 8'i eksikti. Bu, ölçülebilir bir soruna yol açıyordu:

> Sınıflandırıcının 5 beat türü 14 hikâyeyi karşılamıyor. "The insect stays
> **hidden**", "the alarm **spreads**", "a guard **signals**" gibi cümleler
> hiçbir beat'e girmiyordu → `story_beat` null → sahnede aktör yok → geriye
> yalnızca kamera hareketi, yani **dekorasyon** kalıyordu.

### Eklenenler

| Alan | Ne geldi |
|---|---|
| Şablon | communication, cause_effect, chain_reaction, timeline, navigation, problem_solution (→ 14 hikâye + quantity + atmosphere) |
| Aktör | `signal_wave`, `spread`, `axis`, `build_up` (7 → 11 tip) |
| Kamera | `trace-the-signal`, `tight-then-wide`, `tight-then-open`, `widen-with-the-spread`, `follow-the-route`, `hold-the-timeline` |
| Köprü | `beatToActors` artık ÖNCE şablon koreografisini dener, sonra beat türüne düşer |
| Merdiven | yeni şablonların kendi kadraj merdiveni (yayılım dar→geniş, eksen sabit) |

### Kanıt render'ının bulduğu GERÇEK hata

§5 tuzak 5 gereği yeni primitifler kodlanmadan önce ffmpeg ile render edildi.
Render, tasarımda görünmeyen bir hatayı ortaya çıkardı:

> **libass, bir çizimi `\fscx/\fscy` ile ölçeklerken şekli `\pos` noktası
> etrafında büyütmüyor.** %400'lük bir dalga, kaynağının belirgin şekilde
> soluna ve üstüne kayıyordu.

Bu, kullanıcının daha önce bildirdiği **"daire nesnenin üstünde değil"**
şikâyetinin kök nedeni: `ring` aktörü de aynı numarayı kullanıyordu. Çözüm,
ölçekleme yerine her adımda **gerçek yarıçapla yeniden çizim** (`radialSteps`),
mutlak koordinatlarda (`\an7\pos(0,0)`) — merkez matematiksel olarak kilitli.
Regresyon testi hem `\fscx` yokluğunu hem de dairelerin merkez simetrisini
doğruluyor.

### Yol boyunca çıkan iki üretim hatası

1. **QC paydası yanlıştı.** Faz 5 aktör oranını `motionPlan.length`'e (KLİP
   sayısı) bölüyordu; Faz 4 ise bir sahneyi 2-3 klibe ayırıyor. Aktörler sahne
   başına planlandığı için oran yapay olarak üçte birine düşüyor ve her video
   yanlış uyarı üretiyordu. Payda artık **farklı sahne sayısı**.
2. **Aynı koreografi üç kez çiziliyordu.** Mikro plan merdiveni bir sahneyi
   böldüğünde her kadraja aynı beat veriliyordu; aynı iz/halka arka arkaya üç
   kez çizilirdi (aksaklık gibi okunur). Beat artık sahnenin **ilk kadrajına**
   bağlanır.

Ayrıca ilk klip, hikâye gerekçesi "geriye çekil" dese bile zoom 1'den başlar —
loop kapanışı kamera gerekçesinden önceliklidir.

### Belgenin amiral örneği artık gerçekten çiziliyor

§3.1'deki örnek ("sıcak hava yükselir → soğuk hava iner → döngü kapanır") kodda
**bağlanmamıştı**: `flow_arrow` aktörünün `temp: hot/cold` dalı hiçbir yerden
çağrılmıyordu, HOT/COLD renkleri ölü koddu. `mechanism` şablonu artık kesitte
iki okla akışı çiziyor — sıcak yukarı, soğuk karşı taraftan aşağı, **sırayla**
belirerek. §3.1'in `visual_story` dizisi ayrı bir veri yapısı olarak değil,
aktör zamanlaması olarak gerçekleşiyor (sahne içinde olay dizisi).

Dayanak şartı burada da geçerli: cümle gerçekten bir akıştan söz etmiyorsa
(`"The chamber inside stays dry"`) ok çizilmez. "inside" geçen her cümleye hava
akışı oku koymak, olmayan bir iddiada bulunmak olurdu — konum uydurmanın akış
hâli.

### Ölçüm (10 sahne / 44sn, gerçekçi anlatım, odak ölçümü %75 başarılı)

| Ölçüt | Faz 1-5 sonrası | Şimdi |
|---|---|---|
| Aktör alan sahne | ~4/10 | **8/10** |
| Ekranda çizilen aktör türü | 3-4 | **8** |
| İzleyici görevi tanımlı sahne | 6/10 | **10/10** |
| Kompozisyonu hikâyeye kısıtlanan sahne | 6/10 | **10/10** |
| Mikro plan | ~21 | 21 |
| Sessiz anlaşılırlık kapısı | uyarı üretiyordu (payda hatası) | **geçiyor, uyarı yok** |
