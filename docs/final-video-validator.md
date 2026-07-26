# Final MP4 Doğrulaması — plan değil, çıkan video

> **Final MP4 tek gerçek kaynaktır.** Scene plan doğru olabilir, render plan
> doğru olabilir, JSON doğru olabilir; çıkan video yanlışsa sistem başarısızdır.

## 1. Kolibri videosunun KARE KARE denetimi (yer gerçeği)

Raporlara değil MP4'e bakıldı (`47.056s`, 94 kare @2fps + 188 kare @4fps).

| İddia | Ölçüm | Sonuç |
|---|---|---|
| Hook tekrar ediyor | tek görünme: **0.50–2.50s**. 11.5s ve 34.8s'teki "isabetler" kuşun BEYAZ GÖĞÜS TÜYLERİ (referansa dHash mesafesi 78 ve 64) | **doğrulanmadı** |
| Diyagram tekrar ediyor | tek blok: **3.25–8.25s**, kesintisiz. "Yarım/tam" görünen kareler tek animasyonun kademeli açılışı (1→2→3→4 madde) | **doğrulanmadı** |
| CTA tekrar ediyor | tek görünme: **~40.0–42.6s** (kadrajın üst şeridi) | **doğrulanmadı** |
| Rapor CTA'yı görmüyor | `motion.cta` gerçekten çalışmadı; pili `renderVideo`'nun `spOn` yolu çizdi ve **hiçbir rapora bildirmedi** | **DOĞRULANDI** |
| Klipler yanlış sırada / araya giriyor | 1fps'te 21 ayrı görsel grup; **G0 dışında hepsi kesintisiz tek blok**. G0 = {0,1,2} ∪ {44,45,46} = bilinçli döngü kapanışı | **doğrulanmadı** |
| Aynı görseller dönüyor | 20 klibin hepsi kolibri+kırmızı çiçek. Kök neden bulundu ve düzeltildi: kimlik ön eki 200 karakterlik bir paragraftı ve 10 sahnenin promptunu aynılaştırıyordu | **DOĞRULANDI** |

Yani asıl arıza **timeline assembler değil, RAPORLAMA KATMANI**: ekranda olan
şeyle raporda yazan şey birbirinden kopmuş.

## 2. Yöntem: kör eşik YOK

İlk denemede mutlak renk/parlaklık eşiği kullanıldı ve **başarısız oldu**:
- "hook bandında parlak piksel" → kuşun beyaz göğsünü hook yazısı sandı,
- "kırmızı + beyaz aynı satırda" → kırmızı çiçeği subscribe pili sandı.

Çalışan yöntem **yapısal ve kendine göndermeli**:
1. Bindirmenin PLANLANDIĞI pencereden referans kare alınır.
2. O bölgenin 64-bit dHash'i hesaplanır (yazı ile tüy taban tabana farklı
   kenar deseni üretir).
3. Video bu referansa hamming mesafesiyle taranır.

Ölçülen ayırt edicilik (gerçek video): hook referansına mesafe **0** (t=1.0s),
sahte pozitiflerde **78** ve **64**. CTA referansına **13** (pil anında),
başka yerlerde **48–78**. Eşik 12 ikisini de temiz ayırıyor.

### İki kural

1. **Ardışık benzer kareler kusur DEĞİLDİR** — o, klibin kendisidir. Kusur,
   bir görüntünün *aradan sonra* yeniden belirmesidir. İlk analizde bu ayrım
   yapılmadığı için 14 "kopya grubu" bulunmuştu; hepsi normal klipti.
2. **İmza = dHash + ortalama parlaklık.** dHash düz renk alanlarında kördür
   (kırmızı, yeşil, mavi tam kare hepsi `0n`). Sentetik test tam bu tuzağa
   düştü; parlaklık ikinci boyut olarak eklendi.

## 3. Bildirim tamlığı (asıl açığı kapatan kontrol)

Piksel taraması, referansı olmayan bir bindirmeyi bulamaz — subscribe pilinin
raporlarda hiç görünmemesinin sebebi buydu. Bu yüzden `renderVideo` artık
ekrana koyduğu HER katmanı bildirir:

```js
renderPlan.overlayLayers   // ['hook','caption','listMarker','actor','card','cta','finale']
renderPlan.overlayWindows  // { hook:[[0,2.4]], cta:[[40.0,42.6]], diagram:[...], loopEcho:[...] }
renderPlan.clips           // [{id:'scene_03_clip_02', scene, sequence, renderOrder, start, end}]
```

Gözlenip bildirilmemiş bir katman → `UNDECLARED_OVERLAY` → yayın engeli.

## 4. Timeline integrity

Her klibin `id`, `scene`, `sequence`, `renderOrder`, `start`, `end` alanı var.
`verifyTimelineOrder` şunları arar: `OUT_OF_ORDER` (scene_04 scene_03'ten önce),
`OVERLAP`, `DUPLICATE_CLIP_ID`, `MISSING_ID`, `RENDER_ORDER_MISMATCH`,
`NON_POSITIVE_SPAN`.

## 5. Run integrity

script / scene plan / render plan / final MP4 özetleri deterministik sırada
zincirlenir (`chainHash`). Artifact'ler farklı koşulardan geliyorsa QC
başarısızdır — aksi hâlde bir koşunun planı başka bir koşunun videosuyla
karşılaştırılır.

## 6. Yayın kapısı

`finalVideo` artık `evaluatePublishGates`'in **birincil girdisi**. Doğrulayıcının
her bulgusu `FINAL_VIDEO/<kod>` olarak yayın engeline dönüşür. Doğrulama hiç
çalışmadıysa sonuç `needs_review` — doğrulanmamış video yayınlanmaz.

`productionReady` de düzeltildi: eskiden `Boolean(technicalReady)` idi, yani MP4
decode edilebiliyorsa rapor "production-ready" yazıyordu. Artık final video
kararını içeriyor.

## 7. Elle kullanım

```
node scripts/audit-final-video.js output/<konu>/<konu>.mp4 output/<konu>/publish-gates.json --fps 2
```
Çıkış kodu 1 = doğrulama başarısız (upload engellenmeli). Plan verilmezse
bindirme ölçütleri "doğrulanamadı" sayılır ve atlanır.
