# bee-before vs bee-after (regresyon kanıtı)

> Sentetik içerik, GERÇEK ffmpeg + gerçek üretim kod yolları. Gerçek bee
> konusu render'ı ağ kapalı olduğu için sandbox'ta yapılamaz (bkz.
> docs/bee-regression-rootcause.md).

## Sonuç

| Alan | bee-before (kusurlu) | bee-after (düzeltilmiş) |
|---|---|---|
| CTA dili | Türkçe "BEĞEN" (yanlış) | İngilizce "LIKE" (doğru) |
| CTA yerleşimi | — | lower_third_left (bbox 56,1040 300×112) |
| Ses kanalı | 1ch (mono) | 2ch (stereo) |
| Duyulur SFX | doğrulanmadı | 5/5 cue ≥3dB |
| Müzik | havuz tükendi + tekrar | çeşitlilik zorlanıyor |
| **Sert kapı** | **BLOK: CTA_WRONG_LANGUAGE, CTA_LANGUAGE_MISMATCH, MUSIC_POOL_EXHAUSTED, CHANNEL_METADATA_MISMATCH** | **GEÇTİ** |

## SFX cue ölçümleri (bee-after, final MP4'ten)

| t (s) | cue | mixed | audibleΔdB | verified |
|---|---|---|---|---|
| 0.4 | hook | true | 13.4 | ✅ |
| 3.2 | whoosh | true | 18.2 | ✅ |
| 6.4 | shimmer | true | 15.6 | ✅ |
| 9 | impact | true | 16.3 | ✅ |
| 7 | cta:pop | true | 7.8 | ✅ |

## CTA pozisyon seçimi

Seçilen: **lower_third_left**. Gerekçe: sağ Shorts aksiyon-ikon şeridinden uzak,
altyazı bandının üstünde, görsel ağırlık merkezini kapatmaz; kart uzun
İngilizce etikete göre genişler ve güvenli kenar payını korur.
3 aday: `bee-cta-positions.png` (lower_third_left | lower_third_center | center_left).

## Dosyalar
- `bee-before.mp4`, `bee-after.mp4`
- `bee-audio-cues.json` (ölçülen gerçek), `bee-audio-waveform.png`
- `bee-cta-positions.png`
