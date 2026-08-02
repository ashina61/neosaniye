# SFX Havuzu — buraya telifsiz ses efekti dosyaları at

Amaç: "hep aynı geçiş sesi" bitsin. Bir klasöre birden çok dosya atarsan sistem
her videoda **deterministik-rastgele** birini seçer (aynı video → aynı ses,
farklı video → çeşitlenir). Klasör boşsa otomatik **sentez fallback** devreye
girer, yani hiç dosya atmasan da video üretilir.

## Nasıl kullanılır
1. Aşağıdaki klasörlerden birine `.wav` / `.mp3` / `.ogg` / `.m4a` dosyası at.
2. Kod değişikliği GEREKMEZ — bir sonraki render otomatik havuzu kullanır.
3. Dosya sayısı arttıkça çeşitlilik artar (klasör başına 3–8 dosya ideal).

## Klasörler (sahne geçiş sesleri)
| Klasör       | Ne zaman çalar                                  | Nasıl bir ses ara |
|--------------|-------------------------------------------------|-------------------|
| `whoosh/`    | sahne geçişleri (en sık)                        | kısa "vınn" süpürme, 0.3–0.6s |
| `impact/`    | vurucu an / twist                               | derin "dum" vuruş + hafif kuyruk, 0.4–0.9s |
| `riser/`     | kesime tırmanan gerilim                         | yükselen "şşşş" gerilim, 0.6–1.0s |
| `shimmer/`   | parlak/olumlu an, sayı kartı                    | ışıltılı çan/parıltı, 0.4–0.7s |
| `click/`     | UI tık (abone kartı belirirken)                 | kısa net "tık", <0.1s |

> CTA sesleri (abone butonu) ayrı yerde: `assets/motion/sfx/` (confirmation, pop,
> bell_tick, soft_click, swipe). Oraya da variety istersen söyle, o havuzu da açarım.

## ⚠️ LİSANS — para kazanmayı riske atmayalım (ZORUNLU)
Sadece **telifsiz / CC0 / kanala özel lisanslı** ses at. Güvenli kaynaklar:
- **YouTube Audio Library** (Ses Efektleri sekmesi — telifsiz)
- **Freesound.org** — filtreyi **CC0** yap (atıf bile gerektirmez)
- **Pixabay SFX** (pixabay.com/sound-effects — telifsiz)
- **Mixkit** (mixkit.co/free-sound-effects — telifsiz)

Telifli/atıf-gerektiren dosya ATMA. Şüphedeysen atma, bana sor.

Format tercih: 44.1kHz WAV veya 128kbps+ MP3, temiz (arka plan gürültüsü yok),
tek efekt (birden çok üst üste değil). Sistem otomatik mono + 44.1kHz'e normalize
edip hafif limitler.
