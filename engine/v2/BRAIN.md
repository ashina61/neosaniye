# V2 BEYNİ — kareyi dolduran fotoğraf ve üstündeki her şey

Bu dosya v2'nin kanunudur. `CLAUDE.md` v1'in (çizilen kolaj motoru) kanunu olarak
kalır; ikisi ayrı hatlardır ve birbirine karışmaz.

**Tek cümlelik yasa: FOTOĞRAF ÇEKİMDİR, GERİ KALAN HER ŞEY ONU OKUTMAK İÇİNDİR.**
İyi bir fotoğraf iyi bir çekimdir. Kötü bir fotoğrafın üstüne çizilen hiçbir şey
onu kurtarmaz — v1 bunu iki hafta boyunca denedi ve kaybetti. Bu hatta grafik
fotoğrafın yerine geçmez; fotoğrafın **neye baktığını söyler**.

## Durum işareti

Bu belgedeki her madde ya **[CANLI]** ya **[YAZILI]**. Fark hayati: v1'in en
pahalı hatası, motorda eksiksiz duran bir kanunu planlayıcının SIFIR kez
çağırmasıydı — kanun doğruydu, kimse uygulamıyordu. Yazılı bir madde henüz
kod değildir ve öyle işaretlenir.

---

## 0. ÖLÇÜLER — her şeyin dayandığı beş sayı

| ne | değer | neden |
|---|---|---|
| kare | 1080×1920 | dikey, 9:16 |
| fps | 30 | 60 render'ı ikiye katlar, telefonda fark okunmaz |
| alt güvenli alan | karenin **%18**'i | Reels/TikTok arayüzü orayı kaplar; altyazı oraya girerse platform onu keser |
| sağ güvenli alan | karenin **%12**'si | beğeni/paylaş sütunu |
| üst güvenli alan | karenin **%10**'u | profil ve ses etiketi |

Bu dört kenar **tartışılmaz**. Bir kare tasarlarken kullanılabilir alan
1080×1920 değil, yaklaşık **950×1382**'dir. Ortalanmış bir altyazıyı %17'ye
koymak "yaklaşık doğru" değil, telefonda kesilmiş demektir.

---

## 1. KAMERA — bir çekimin hareketi seçilir, uydurulmaz [KISMEN CANLI]

Şu an canlı olan: index'e göre dönüşümlü zoom in/out, merkeze sabit, 1.02↔1.24.
Bu **bir hareket**, altı sahnede aynası alınmış hâli. Yetmez.

### Hareket sözlüğü

Her hareketin üç parçası var: **yön**, **çapa**, **hız eğrisi**.

| ad | ölçek | ne söyler |
|---|---|---|
| `push` | 1.00 → 1.22 | *buna bak* — yaklaşma, ilgi |
| `pull` | 1.26 → 1.02 | *meğer* — açığa çıkarma, bağlam |
| `driftL` / `driftR` | 1.14 sabit, %6 yatay kayma | *zaman geçiyor* — tarama, envanter |
| `rise` | 1.18 sabit, %5 yukarı kayma | *yukarı* — gökyüzü, ölçek, ihtişam |
| `fall` | 1.18 sabit, %5 aşağı kayma | *aşağı* — dip, batış, kayıp |
| `hold` | 1.06 → 1.00 | *dur* — yalnız kapanışta ve yalnız bir kez |

**Çapa** hareketin döndüğü noktadır ve merkez OLMAK ZORUNDA DEĞİL. Beş isim:
`centre`, `upperThird`, `lowerThird`, `leftThird`, `rightThird`. Özne karenin
üst üçte birindeyse push oraya doğru gider; merkeze giden bir push, özneyi
karenin dışına iter.

**Hız eğrisi**: `push` ve `pull` ease-out'tur (yolun çoğu başta biter, sonu
sürünür — bu "varış" hissidir). `drift`, `rise`, `fall` LİNEER'dir; bir kayma
yavaşlayarak biterse durmuş gibi olur, oysa amacı sürüyor olmasıdır.

### Değişmez kurallar

1. **Ölçek farkı 0.12'den az olamaz.** Denetim aracı bunu ölçüyor: iki örnek
   arası %1.2'den az fark = "bu çekim kıpırdamıyor". Küçük hareket, üstünde
   grain olan bir fotoğraftır.
2. **Ölçek farkı 0.30'u geçemez.** Ötesi Ken Burns değil, zoom şakası.
3. **Peş peşe aynı hareket gelmez.** İki push arka arkaya, ortasında takılma
   olan tek bir hareket gibi okunur.
4. **Üç sahnede bir yön ailesi değişir.** push/pull bir aile, drift/rise/fall
   başka aile.
5. **Hareketi CÜMLE seçer, zar değil.** "aşağı indi" diyen bir satır `fall`
   alır. Zar yalnız cümlenin bir şey söylemediği yerde konuşur.

---

## 2. KESİM — bir reel altı kesim bilir, üçünü kullanır [KISMEN CANLI]

Şu an canlı olan: yalnız `defocus`. Altı sahne, altı aynı kesim.

| ad | kare | ne zaman |
|---|---|---|
| `defocus` | 12 | varsayılan belgesel kesimi — yumuşak, görünmez |
| `dip` | 14 | siyaha düşüp çıkar; **bölüm molası**, dönüm noktası |
| `flash` | 6 | beyaz patlama; bir sayı, bir açığa çıkış — **reel başına en fazla bir** |
| `whip` | 8 | yönlü hızlı bulanıklık + kayma; enerji, liste |
| `push-through` | 10 | yeni resim eskiyi iter; sıralama, adım adım |
| `hard` | 0 | geçiş yok — **en güçlüsü**, hak edilmesi gerekir |

### Değişmez kurallar

1. **Bölüm seed'inden ALTIDAN ÜÇÜ seçilir.** Altısı da kullanılan bir reel'in
   kesim dili yoktur, tik'i vardır.
2. **Peş peşe aynı kesim gelmez.**
3. **`flash` reel başına bir kez.** İki flash, ikisini de anlamsız yapar.
4. **Kapanıştan önceki kesim en ağır olandır** — `dip` ya da `hard`.
5. **İlk kesim `defocus` olamaz.** Açılışın yumuşak girmesi, kaydırılmasıdır.

---

## 3. YAZI — modern reel'i modern yapan tek şey [KISMEN CANLI]

Şu an canlı olan: 4 kelimelik pencere, konuşulan kelime aksan renginde, siyah
kontur. Doğru temel. Eksik olan: **vuruş**.

### Kanunlar

1. **KONUŞULAN KELİME ZIPLAR.** 3 karede 1.00 → 1.09 → 1.00. Bu, "altyazılı
   video" ile "kelime kelime yazılmış video" arasındaki tek fark. Sabit renk
   değişimi kelimeyi işaretler; ölçek vuruşu onu **söyletir**.
2. **PUNTO SABİT DEĞİL, SIĞDIRILIR.** `fitSize` zaten var: uzun bir Türkçe
   kelime ("saklayamıyor") sabit puntoda kenardan taşar. Hedef punto
   karenin %7.2'si, taban %4.8.
3. **SATIR BAŞINA EN FAZLA ÜÇ KELİME, PENCERE BAŞINA EN FAZLA İKİ SATIR.**
   Üçüncü satır okunmaz, kaydırılır.
4. **İKİ SATIR DENGELİ BÖLÜNÜR.** "Havadaki moleküller mavi / ışığı" değil,
   "Havadaki moleküller / mavi ışığı".
5. **CÜMLE SINIRINDA PENCERE SIFIRLANIR.** Bir cümlenin kuyruğu, sonraki
   cümlenin başının altında duramaz. (Canlı: 14 karelik boşluk eşiği.)
6. **VURGU KELİMESİ BRIEF'TE YAZILIR.** `emphasis: ["on altı"]` diyen bir satır
   o kelimeyi %130 punto ve aksan renginde alır. Cümlenin en önemli kelimesine
   zar atılmaz.
7. **YAZI ALT GÜVENLİ ALANIN ÜSTÜNDE DURUR.** %18 + %4 nefes = tabandan **%22**.

### Yazının zemini

Fotoğraf açık renkliyse beyaz yazı kaybolur. İki katman, sırayla:
- Kareye çakılı **alt gradyan** (siyah %0 → %72, alttan %48'de başlar) — canlı.
- Yazının kendi **konturu** (punto × 0.20, siyah) — canlı, gölge DEĞİL: gölge
  orta gri bir fotoğrafta kaybolur, kontur kaybolmaz.

---

## 4. LOOK — v2'nin en ucuz ve en büyük kazancı [YAZILI]

Şu an v2'de **hiç yok**. Reel ham stok fotoğraf gibi duruyor. Oysa
`engine/FilmLook.tsx` bitmiş hâlde orada: grain, grunge, tarama çizgisi,
vignette, gate weave, grade — hepsi çizilmiş, sıfır dosya bağımlılığı.

v2 için doğru karışım v1'inkiyle AYNI DEĞİL:

| katman | v1 | v2 | neden |
|---|---|---|---|
| grade | ✅ | ✅ | reel'in tek rengi olması gerekir |
| grain | ✅ | ✅ %60 güç | dokusuz dijital kare ucuz görünür |
| vignette | ✅ | ✅ %70 güç | gözü merkeze toplar, yazıyı okutur |
| grunge | ✅ | ❌ | arşiv hissi; bir bilim anlatımında kir |
| tarama çizgisi | ✅ | ❌ | CRT göndermesi; 2024 reel'i değil |
| gate weave | ✅ | ❌ | film kapısı titremesi; burada sadece sarsıntı |

**Bir reel'in TEK grade'i vardır.** Sahne başına derecelendirme, grade değil
titremedir. İki istisna: kapanış (renk çekilir, kontrast +%6) ve dönüm noktası
(ısınır). Üç kayıt, dokuz değil.

---

## 5. ŞEKİL VE GRAFİK — nadir, ve hep bir şey söyleyerek [YAZILI]

`engine/draw/` içinde hazır duran ve v2'ye taşınmaya değer olanlar:

| bileşen | v2'deki işi |
|---|---|
| `Annotation` (underline/oval/bracket/arrow) | fotoğrafta ADI GEÇEN şeyin etrafına kendini çizer |
| `Plaque` | yer + tarih etiketi: "Antikythera · 1901" |
| `WireFrame` | bir bölgeyi işaretler, ölçü verir |
| `Motif` (coins/rise/route/tally/rays/embers) | cümlenin FİİLİNİ oynar |
| `Glow` / `Beam` | fotoğraftaki ışık kaynağını canlandırır |

### Kanunlar (v1'den aynen devralınır, çünkü orada pahalıya öğrenildi)

1. **SATIR ONU SÖYLEMİŞ OLACAK.** "sonra para geldi" demeyen bir satıra `coins`
   konmaz. Her sahnede olan bir grafik, grafik değil filtredir.
2. **PEŞ PEŞE AYNISI GELMEZ.**
3. **ÜST ÜSTE ÜÇ SAHNE SÜSLENMEZ.** Çıplak çekim diğerlerini var eden şeydir.
4. **ANNOTATION FADE OLMAZ, ÇİZİLİR.** Belirme bir grafik efektidir; çizilme
   bir işarettir.
5. **GRAFİK KAREYE ÇAKILIDIR, kamera itişinden pay almaz.** Odaya bağlanırsa
   grafik olmaktan çıkar, kayan bir aksesuar olur.
6. **REEL BAŞINA EN FAZLA ÜÇ GRAFİKLİ SAHNE.**

---

## 6. AÇILIŞ — ilk 45 kare reel'in kaderi [YAZILI]

Şu an: 1. çekim 7 karede belirerek giriyor. Telefonda bu, kaydırılmadır.

Kanun: **ilk 45 kare kendi çekimidir.**
- Reel'in en güçlü karesi, **hareketsiz** (ölçek 1.06, neredeyse durgun).
- Üstünde tek satır: sorunun kendisi ya da iddianın kendisi, büyük punto.
- **Belirme yok.** İlk kare tam opaklıkta başlar; fade-in, izleyicinin
  görmediği ilk yarım saniyeyi harcar.
- 45. karede ilk gerçek kesim düşer ve anlatım başlar.

---

## 7. RİTİM — altı benzer çekim bir liste, bir kurgu değil [YAZILI]

Şu an: çekim süresi = satır süresi. Altı satır benzer uzunlukta → altı benzer
çekim. antikythera'da yedi sahnenin beşi 127-138 kare arasındaydı.

Kanunlar:
1. **Bir satır 5.5 saniyeyi geçerse İKİ ÇEKİME bölünür** — aynı fotoğraf, farklı
   hareket ve farklı çapa; ya da varsa ikinci bir fotoğraf.
2. **Reel'de en az bir NEFES vardır**: 30-45 karelik, tek nesneye bakan, yazısı
   olmayan ya da tek kelimelik çekim.
3. **En uzun çekim, en kısa olanın 2.5 katından fazla olamaz.**
4. **Kapanış çekimi bir önceki çekimden uzundur.** Cümle bitmeden reel bitmez.

---

## 8. SES — kesimin duyulan yarısı [KISMEN CANLI]

Canlı: anlatım + `bed` (oda tonu, seed'den üretilir, 0.14 seviye).

Yazılı:
1. **Ağır kesimlerde vuruş.** `dip` ve `flash` altına 0.2 saniyelik düşük
   frekanslı bir vuruş. Kesimi göz görür, kulak onaylar.
2. **Anlatım altında bed kısılır** (ducking): konuşma varken 0.14 → 0.08.
   Konuşma yokken geri çıkar. Boşluğu dolduran şey odur.
3. **Son 20 karede bed söner.** Reel sesle bitmez, sessizlikle biter.

---

## 9. BU BEYNİN KENDİ KANUNU

**SÖZLÜK VERİDİR, PROZA DEĞİL.** Yukarıdaki hareket ve kesim tabloları
`engine/v2/vocabulary.ts` içinde veri olarak durmalıdır; `reel2.mjs` oradan
seçer, `Reel.tsx` yalnız ADI VERİLMİŞ bir hareketi uygular ve asla kendi
hareketini icat etmez. Belge neden'i anlatır, veri ne'yi tutar, test kuralı
bekçiler.

Bu ayrım olmazsa bu dosya v1'in `CLAUDE.md`'sinin başına geleni yaşar: kanun
doğru yazılır, kod başka şey yapar, ve aradaki farkı kimse iki hafta boyunca
fark etmez.

### Testin tutması gerekenler

- iki komşu çekim aynı hareketi almaz
- iki komşu kesim aynı değildir
- `flash` reel başına en fazla bir
- her ölçek farkı 0.12 ≤ Δ ≤ 0.30
- her altyazı ipucu tabandan %22'nin üstünde
- üç ardışık sahnenin üçü birden grafik taşımaz
- en uzun çekim / en kısa çekim ≤ 2.5
