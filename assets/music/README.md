# Arka plan müziği (telifsiz)

Bu klasöre koyduğun ses dosyalarından (`.mp3 .m4a .wav .ogg .aac .opus`) her
video için **rastgele biri** arka plana bindirilir (narrasyon altında otomatik
kısılır). Klasör boşsa sistem yumuşak bir sentetik müzik üretir.

## En güvenli kaynak: YouTube Ses Kitaplığı
YouTube Studio → **Ses Kitaplığı** (Audio Library) → beğendiğin parçaları indir
ve buraya kopyala. Bu parçalar YouTube'da **telif hak talebi almaz** ve çoğu
atıf (attribution) gerektirmez. 5-10 parça koyman çeşitlilik için yeterli.

Diğer telifsiz kaynaklar: Pixabay Music, Free Music Archive (CC0), Chosic.

## Otomatik indirme (opsiyonel)
Doğrudan indirme linklerin varsa:
```
MUSIC_URLS="https://.../a.mp3,https://.../b.mp3" node scripts/fetch-music.js
```
ya da `data/music-urls.json` içine `["https://.../a.mp3", ...]` yaz.
GitHub Actions'ta repo **Variables**'a `MUSIC_URLS` eklersen üretimden önce indirilir.

> Not: `.gitignore` genelde `*.mp3` yok sayar ama bu klasör `!assets/music/**`
> ile istisna tutulur — buraya koyduğun parçalar commit edilir.
