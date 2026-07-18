# Müzik Kütüphanesi — İnsan Kulağı İnceleme İndeksi

**Amaç:** İçe aktarılan 12 CC0 müziğin mood etiketlerini kulakla doğrulamak.
Buradaki `-preview.mp3` dosyaları **yalnızca manuel inceleme içindir** —
15 sn, parçanın orta bölümünden, düşük kalite (mono 22kHz 64kbps), 0.5 sn
fade-in/out. Production seçicisi bu klasörü ASLA görmez (seçici yalnızca
`assets/music` + manifest'li `assets/audio` okur); optimize/orijinal dosyalar
değiştirilmedi.

Yeniden üretme: önizlemeler `assets/audio/music/*.mp3` üzerinden ffmpeg ile
kesilir (orta nokta ±7.5 sn). Mood'u değiştirmek istersen bana söylemen
yeterli — manifest etiketini güncellerim.

| # | ID | Süre | Mevcut mood | Önerilen inceleme | Senin kararın |
|---|---|---|---|---|---|
| 1 | lavenderdotpet-cc0-ambient-1 | 162s | neutral | Sakin ambient mi? → `nature`/`space` uygun olabilir | ☐ |
| 2 | lavenderdotpet-cc0-ambient-2 | 111s | neutral | Karanlık tını varsa → `mystery`/`dark` | ☐ |
| 3 | lavenderdotpet-cc0-theme-1 | 117s | cinematic | Tema havası anlatıya uyuyor mu? → `cinematic` kalsın/`ancient` | ☐ |
| 4 | lavenderdotpet-cc0-fvi-3amwestend | 291s | suspense | Gece/gerilim hissi doğru mu? → `suspense`/`mystery` | ☐ |
| 5 | lavenderdotpet-cc0-fvi-arpent | 162s | neutral | Arpej dokusu → `science`/`space` adayı | ☐ |
| 6 | lavenderdotpet-cc0-fvi-beatone | 180s | neutral | Ritim voice-over altında rahatsız ediyor mu? Enerji yüksekse belgesel dışı | ☐ |
| 7 | lavenderdotpet-cc0-fvi-chronos | 129s | cinematic | Epik/zaman teması → `ancient`/`history` güçlü aday | ☐ |
| 8 | lavenderdotpet-cc0-fvi-favorite | 175s | neutral | Genel amaçlı mı, yoksa fazla oyun-müziği mi? | ☐ |
| 9 | lavenderdotpet-cc0-fvi-fireworks | 141s | cinematic | Parlak/coşkulu ise Shorts anlatısına fazla gelebilir → değerlendir | ☐ |
| 10 | lavenderdotpet-cc0-fvi-goodnightmare | 240s | neutral | Adı "good nightmare" — karanlıksa → `mystery`/`dark`/`suspense` | ☐ |
| 11 | lavenderdotpet-cc0-fvi-hippetyhop | 116s | neutral | Neşeli/zıplak ise belgesel anlatısına UYGUN DEĞİL → çıkarılabilir | ☐ |
| 12 | lavenderdotpet-cc0-fvi-meditatingbeat | 157s | neutral | Meditatif → `nature`/`space`/`neutral` | ☐ |

**Not:** LUFS ölçümlerine göre `chronos` (-9) ve `fireworks` (-9.6) yüksek
enerjili — voice-over altında ducking'e rağmen baskın gelebilir; kulakla
özellikle bu ikisini kontrol et. Tüm parçalar CC0 (Team Forbidden feragati /
Stradex), Content ID riski düşük.
