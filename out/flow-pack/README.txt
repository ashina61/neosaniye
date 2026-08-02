NEOSANIYE — GÖRSEL ÜRETİM DEVİR PAKETİ
konu: The Man Who Jumped Into the Rain
video süresi: 79.6 s · 19 sahne

═══ B YOLU — PARÇA PARÇA (VARSAYILAN, BUNU KULLAN) ═══

Beat başına 1 PLAKA (boş kağıt zemin) + 1 kadar PARÇA
(düz BEYAZ zeminde tek nesne). Remotion parçaları tek tek, arkadan öne,
anlatı sırasıyla diziyor — yani kolajın kendi kendini kurması KODDA oluyor.
Flow'a hiç gerek yok.

1. ALL-PROMPTS.txt içindeki 15 bloğu görsel modeline ver.
   Her blok bir görsel. Sıra korunmalı.
2. Dönen görselleri ASSET-LIST.txt'deki adlarla collage-raw/ altına kaydet.
   N'inci blok = listenin N'inci satırı. Sıra kayarsa montaj sessizce bozulur.
3. npm run collage
   Bu adım parçaların zeminini silip alfa PNG üretiyor (cutout.py, matte
   modu), plakayı olduğu gibi alıyor ve storyboard'a bağlıyor.
   Eksik parça sorun değil: o sahne mevcut şablonuyla kodla çizilmeye devam eder.
4. npm run sheet   (tek kareye bak, 93 dakikalık render'a girmeden)
5. npm run render

PARÇA PROMT'UNDA DEĞİŞTİRME: "BACKGROUND: blank flat white" cümlesi süs
değil, alfa çıkarımının TEK dayanağı. Magenta iki canlı çalıştırmada da
tutmadı — model magenta'yı zemine değil öznenin İÇİNE koydu — ve beyaz
ölçümle daha güvenilir çıktı.

═══ A YOLU — TEK KARE + GOOGLE FLOW (YEDEK) ═══

Bir beat için parça üretmek zahmetliyse: NN-kind-FALLBACK-single-frame.txt
tek bitmiş kareyi ister; NN-kind-MOTION.txt o beat'in SÜRESİNE göre yazılmış
Flow hareket metnidir. Klipleri AYNI ADLA public/clips/ altına .mp4 koy ve
npm run clips. O sahne build-on yapmaz, yalnızca film katmanı ve sürüklenme alır.

DİKKAT — ÖLÇÜLDÜ: Flow "görseli birebir koru" talimatını tutmuyor. Bir
denemede gravür harita renkli bir haritayla değişti, tarife içeriği yeniden
yazıldı ve orijinalde olmayan sayfa kıvrımı eklendi. Çıktıdaki TARİH ve
SAYILARI gözle kontrol et; anlatımla çelişen bir tarih yanlış bilgi demektir.
B yolunda bu risk yok, çünkü metni Remotion çiziyor.

GÖRSEL ÜRETİLECEK BEAT'LER (7 / 19) — BÜTÇE
Bütçe referansın kendi oranından: çekimlerin üçte ikisinde hiç fotoğraf yok.
  02  4.1s +3.6s  fact        1 parça  "a man in a dark suit"
  04  12.4s +3.6s  fact        1 parça  "He handed the attendant a note"
  07  27.2s +4.7s  fact        1 parça  "In Seattle the passengers walked off the plane"
  09  35.5s +3.6s  fact        1 parça  "The aircraft took off again"
  13  51.6s +3.6s  fact        1 parça  "The FBI searched the woods"
  15  58.8s +5.3s  time        2 parça  "Nine years later a boy digging on a riverbank"
  19  74.9s +4.7s  cliffhanger 1 parça  "Nobody ever found the man or the parachute."

BÜTÇE DIŞI (10) — prosedürel siluetle çizilecek
  01  cold_open   şekil=star  "On the night of 24 November 1971,"
  05  fact        şekil=bomb  "that said there was a bomb in his briefcase."
  06  magnitude   şekil=document  "He asked for two hundred thousand dollars and four parachutes."
  08  fact        şekil=document  "and the money came aboard."
  10  fact        şekil=wave  "into rain and low cloud."
  11  fact        şekil=-  "Somewhere over southern Washington he opened the rear stair"
  12  fact        şekil=parachute  "and jumped with a parachute."
  14  absence     şekil=-  "for eighteen days and found nothing."
  16  fact        şekil=document  "found three bundles of the banknotes."
  17  fact        şekil=document  "The rest of the money"

KODLA ÇİZİLEN BEAT'LER (2) — görsel üretilmez
Bu sahnelerde görsel modeli doğru olamıyor: rota oku, sayılabilir ızgara,
grafik, zaman çizelgesi. Remotion çiziyor.
  03  7.7s +4.7s  map_route         "bought a one-way ticket from Portland to Seattle."
  18  71.3s +3.6s  stick_beat        "has never appeared in a bank."
