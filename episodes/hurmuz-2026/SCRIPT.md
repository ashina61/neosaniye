# Hürmüz — 174 gün — okuma metni

**13 satır, 141 kelime.** Rahat bir tempoda yaklaşık 56 saniye.

## Nasıl okunacak

1. **Hepsini tek seferde, tek dosyada oku.** Satır satır kaydedip birleştirme —
   her klibin kenarında farklı miktarda hava kalır, oysa ölçülen şey tam olarak
   satırlar ARASINDAKİ boşluk.
2. **Her satırın arasında net bir es ver** — bir buçuk, iki saniye. Sahne
   sınırları bu sessizliklerden bulunuyor: tam 12 tane aranıyor.
   Es yoksa bulunacak sınır da yok.
3. Cümlenin ortasında nefes alman sorun değil — en uzun duraklar aranıyor,
   herhangi bir duraklama değil.
4. Esin uzunluğu kesimi kaydırmaz: kesim, esin sonuna sabit bir mesafede,
   yeni cümleden hemen önce yapılıyor. Uzun es vermen ölçümü kolaylaştırır,
   videoda sessiz bir boşluk bırakmaz.
5. Sessiz bir odada, tek mikrofon mesafesinde. Arka planda müzik olmasın;
   müziği ve oda tonunu bu taraf koyuyor.

## Dosyayı nereye

```
episodes/hurmuz-2026/audio/vo.mp3      (ya da vo.wav — ikisi de olur)
```

Sonra:

```bash
node scripts/voice-episode.mjs --episode=hurmuz-2026 --measure
npm run broll:render -- --episode=hurmuz-2026
```

Birincisi dosyayı ölçüp `vo.json` yazar, ikincisi bütün filmi ona göre yeniden
keser. Kurguda elle düzeltilecek hiçbir sayı yok.

---

## Metin

**01.**  Bu geminin bir adı var ama önemli değil. Altı aydır demirde bekleyen yüz elli tankerden biri.

_(es)_

**02.**  Dünyanın kullandığı her beş varil petrolden biri, tek bir sudan geçiyordu.

_(es)_

**03.**  Hürmüz Boğazı. En dar yerinde otuz üç kilometre.

_(es)_

**04.**  Gemilerin geçtiği şerit her yönde sadece iki deniz mili. Ve tamamı menzil içinde.

_(es)_

**05.**  Yirmi sekiz Şubat gecesi Amerikan ve İsrail uçakları İran'ı vurdu.

_(es)_

**06.**  Ertesi sabah telsizden tek bir cümle geldi.

_(es)_

**07.**  Bir boğazı kapatmak için gemi batırmak gerekmiyor. Mayın, hızlı bot, ve bir sigortacının hayır demesi yetiyor.

_(es)_

**08.**  Günde yüz otuz gemi geçerdi. Şimdi on.

_(es)_

**09.**  Petrol iki gün içinde varil başına yüz on sekiz dolara çıktı.

_(es)_

**10.**  Alternatif yol Ümit Burnu. Üç bin sekiz yüz mil ve on dört gün fazladan.

_(es)_

**11.**  Doğal gaz için alternatif yol diye bir şey yok. Hiç yok.

_(es)_

**12.**  Ama kapıyı kapatan İran'ın kendi petrolü de oradan çıkıyor.

_(es)_

**13.**  Bugün yüz yetmiş dördüncü gün. Kapı hâlâ kapalı.


---

Metni değiştirmek istersen `brief.json` içindeki `vo` satırlarını değiştir,
sonra bu listeyi yeniden üret. Konuşulan metin tek bir yerde duruyor.
