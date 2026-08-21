# ÇİZİLEN BELGESEL — `engine/war/`

Üçüncü hat. `CLAUDE.md` v1'in (kolaj), `engine/v2/BRAIN.md` v2'nin (tam kadraj
fotoğraf) kanunu. Bu, **fotoğrafın hiç olmadığı** hattın kanunu.

**Tek cümlelik yasa: BİR OLAYIN ŞEKLİ ÇİZİLİR, FOTOĞRAFI ARANMAZ.**
Eylül 1939'un arşivi grenli, kare formatlı ve çoğunlukla yürüyen adamlardan
oluşur. 2024'te bir telefonda izleyicinin gerçekten TAKİP EDECEĞİ şey ise
olayın şeklidir: bir saat, bir harita, bir tel yazısı, bir sayı.

## 1. HARİTA — bu filmin vazgeçemeyeceği tek grafik

`map.tsx` enlem/boylam taşır, resim değil. Ülke başına 12-20 nokta: Polonya
Polonya gibi görünecek kadar çok, tüm kıta tek SVG olarak saniyede altmış kez
çizilebilecek kadar az.

1. **PROJEKSİYON KADRAJA OTURUR.** Boylam −12..42 ve enlem 71..36, iki eksende
   de 0..100'e düşer. İlk sürümde kuzey Norveç y = −25'teydi: kıta sol üst
   köşede, İskandinavya kadraj dışında. Kâğıda sığmayan şey harita değildir.
2. **SINIRLAR BELİRMEZ, ÇİZİLİR.** Çizilmekte olan bir çizgi, birinin iddia
   ettiği bir çizgidir. `pathLength=1` + `strokeDashoffset`.
3. **TOPRAK YÖNDEN DOLAR.** Dolgu, hareket eden bir `clipPath` ile kesilir:
   göz renk değişimi değil, **ilerleme yönü** okur. Batıdan Alman, doğudan
   Sovyet.
4. **HER OKUN UCU KENDİ YAYINDA GİDER.** Ucu kıpırdamayan ok, ok değil şekildir.
   Kuadratik Bezier üzerinde nokta ve teğet hesaplanır.
5. **OKLAR GERÇEK YERLERDEN ÇIKAR.** Hiçbir yerden başlayan bir belgesel oku
   süstür. Üç Alman ekseni (Pomeranya, Brandenburg, Slovakya) ve iki Sovyet
   ekseni — kampanyanın gerçek şekli.
6. **HARİTANIN KAMERASI VARDIR.** viewBox merkezine göre ölçeklemek bir resmi
   zoomlamaktır; bir YERİ kadraj merkezine koyup onun etrafında ölçeklemek
   oraya bakan bir kameradır. İşgal pasajı, Avrupa'dan Varşova'ya tek yavaş
   itiştir.
7. **İSİMSİZ HARİTA ŞEKİLDİR.** Şehirler yazılır.

## 2. NİTRAT — filtre değil, işlem

`film.tsx`. Çizim ile arşiv görüntüsü arasındaki fark sepya DEĞİLDİR. Aynı anda
olan bir düzine küçük arıza vardır:

| arıza | sebebi |
|---|---|
| pozlama nefes alır | kol ile çevrilen obtüratör |
| kare gezinir | aşınmış perforasyon; **çoğunlukla dikey**, film o eksende çekilir |
| boydan çizikler | projektör kapısı |
| toz **siyah** yanar | emülsiyonun üstünde durur, ışığı keser |
| perforasyon kayar | film kapıdan geçiyor; duran perforasyon kenarlıktır |

**KAPI İÇİ VE KAPI DIŞI AYRIDIR.** Resim `Gate` içinde gezinir; kir, çizik ve
perforasyon DIŞINDA durur. Kir resimle birlikte gezinirse resmin ÜSTÜNE
boyanmıştır ve kare filmden çıkıp filmin fotoğrafına döner.

**HER ARIZA KENDİ SAATİNDE.** Titreme, gezinme ve çizikler tek sayıya bağlanırsa
göz bunu nabız atan bir katman diye okur; ayrı periyotlar verilirse yalnızca
eskimiş bir mekanizma diye.

**VE İŞLEM RESMİ BOĞMAZ.** İlk sürümde vignette 0.72, sepya 0.42 idi: harita
neredeyse siyahtı. Ne kadar doğru olursa olsun, okunmayan bir kare boştur.

## 3. RİTİM VE SES

- **SAAT YALNIZ BAŞINA TİKLER.** Dört saniye boyunca mikste başka hiçbir şey
  yoktur, o yüzden DURMASI bir olaydır.
- **04:45'te TEK DARBE.** Sonraki her şey onun aşağı akışıdır.
- **MARŞ İKİ KEZ HIZLANIR** — sınırda ve blitz'de — ve **tel yazısında ölür.**
  Filmin ortasındaki tek sessizlik odur ve daktilonun oturmasını o sağlar.
- **SİREN GERÇEK BİR SESTİR.** Efekt değil: piyesteki tek gerçek ses, ve
  duyurulmak yerine tanınacak kadar kısık.
- **AKORT ÇÖZÜLMEZ.** Açık beşli, hiç kapanmaz — çünkü bu da kapanmadı.

## 4. TİPOGRAFİ

- **DAKTİLO SAYFAYA VURUR VE SAYFA OYNAR.** Karakter animasyonunu makineye
  çeviren tek detay budur.
- Tarihler ve yer adları **mono**, kartlar **ağır sans**. İki ses: belge ve
  başlık.
