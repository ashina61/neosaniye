# bee-honeycomb-hexagons.mp4 — Kök Neden Analizi ve Düzeltmeler

Bu belge, reddedilen `bee-honeycomb-hexagons.mp4` üretimini **production-blocking
regression** örneği olarak ele alır. Önce KÖK NEDEN, sonra uygulanan
düzeltmeler. Yeni raporlama/dashboard/analiz aracı EKLENMEDİ — sorunun kaynağı
koddan giderildi ve gerçek çıktı kapıları eklendi.

## Kapsam (yalnızca üç alan)
1. Ses tasarımının **gerçek videoya** uygulanması + doğrulanması
2. CTA **yerelleştirme** (dil) + **profesyonel yerleşim**
3. **Render sonrası gerçek çıktı** doğrulaması ve upload kapıları

Motion rollout, yeni CTA çeşidi, analytics, A/B veya yeni rapor özelliği
EKLENMEDİ.

---

## 1) SFX "raporda var ama videoda duyulmuyor"

**Kök neden (üç katman):**
- **Loudnorm + duck yok:** SFX'ler `transitionSoundVolume=0.6` ile miks ediliyor,
  ardından tüm master `loudnorm=I=-14` ile normalize ediliyordu. Müzik yalnızca
  narrasyon tarafından duck ediliyor, **SFX anlarında duck edilmiyordu** — vuruş
  müzik+konuşma altında maskeleniyordu.
- **CTA pop'u:** `ctaRenderer` pop'u `sfxVolume=0.3` ile, **hiç ducking olmadan**
  mevcut miks üstüne `amix`'liyordu → mix içinde kayboluyordu (hata #7).
- **Kanıt yanılsaması:** QC `sfxCount`'u `editPlan.boundaries.sfx` **isimlerinden**
  sayıyordu. Bir SFX'in adının planda geçmesi, sesin gerçekten miks edildiği ya da
  duyulur olduğu anlamına gelmiyordu (hata #4, #9).

**Düzeltme:**
- `buildFullAudio` artık tüm SFX'leri bir **SFX bus**'ında topluyor ve müziği bu
  bus ile **sidechain-duck** ediyor (cue anında 2-4 dB dip). SFX seviyesi taban
  ≥0.85'e çekildi.
- `ctaRenderer` CTA pop'unda taban sesi **duck** ediyor (`sidechaincompress`),
  pop seviyesi 0.3→0.7.
- **Gerçek çıktı ölçümü:** `src/pipeline/outputVerify.js#verifySfxInOutput` her cue
  için **final MP4'ten** cue-öncesi taban ile cue-anı tepe enerjiyi ölçer;
  `audibleDeltaDb < 3 dB` ise `SFX_INAUDIBLE`. Şema:
  `{atSeconds, requested, assetResolved, mixed, audibleDeltaDb, verified}`.
- `renderVideo` artık filtre grafiğine **gerçekten giren** cue'ları
  (`sfxCues`, `mixedInGraph:true`) döndürür — isimden değil, fiili miksten.
- Hata kodları: `SFX_ASSET_MISSING`, `SFX_NOT_MIXED`, `SFX_INAUDIBLE`,
  `SFX_REPETITION_EXCESSIVE`, `SFX_OUTPUT_VERIFICATION_FAILED`. Near-silent asset
  miks edilmez (`isNearSilentAsset`, eşik −50 dB).

## 2) Müzik hep aynı (Marianas.mp3)

**Kök neden:** `bee` videosu **nature** kategorisinde. `assets/music/nature/`
klasöründe **tek parça** var: `Marianas.mp3`. CC0 kütüphanesinde **nature mood'una
etiketli parça yok**. Eski seçici mantığı:
1. Mood havuzu (`nature`) → `[Marianas]`.
2. `pick()`: avoid listesinde olsa bile "havuz tek parçaya düştü → tekrar serbest"
   → **her zaman Marianas**.
3. Geniş havuz adımına (step 2) **hiç ulaşılmıyordu**, çünkü step 1 daima
   Marianas ile başarılı dönüyordu.

**Düzeltme (`src/audio/musicSelect.js#selectMusic`):**
- Mood tek parçaya düşer ve o parça `avoid`'daysa, **tekrar etmek yerine geniş
  havuzdan taze bir parçaya** düşülür (`wide-fresh-variety`).
- `avoid` penceresi son **2→5** videoya çıkarıldı.
- **Deterministik** seed (videoId) — aynı video aynı parçayı, farklı videolar
  çeşidi verir.
- Havuz gerçekten tükendiyse `poolExhausted:true` + `repeatedFallback:true`
  raporlanır (sessiz aynı-fallback saklanmaz). Bu durum sert kapıyı tetikler
  (`MUSIC_POOL_EXHAUSTED`).

> Not: Kalıcı çözüm için `assets/music/nature/` havuzuna ek CC0 parça ya da CC0
> manifestine `nature` mood'lu parça eklenmesi önerilir; kod artık çeşitliliği
> zorluyor ama havuz genişledikçe sonuç iyileşir.

## 3) CTA yanlış dilde (Türkçe "BEĞEN")

**Kök neden:** `ctaTemplates.js` etiketleri **hardcode Türkçe**'ydi
(`TYPE_META` sabit). Kanal İngilizce/ABD olmasına rağmen İngilizce içeriğe
Türkçe CTA basılıyordu (hata #1). Kart boyutu da sabitti — uzun İngilizce etiket
(`TURN ON NOTIFICATIONS`) sığmıyordu.

**Düzeltme:**
- `content.language` (`en`/`tr`) config'i eklendi; `ctaMeta(type, language)`
  İngilizce varsayılanla: `LIKE / SUBSCRIBE / COMMENT / FOLLOW /
  TURN ON NOTIFICATIONS`. Türkçe **yalnızca** `language==='tr'`.
- Dil `run.js → applyCta → ctaEngine → ctaRenderer → buildCtaAss` boyunca
  taşınır; rapora `{resolvedLanguage, label, languageMatch}` yazılır.
- **Adaptif kart:** `ctaCardSize` etiket uzunluğuna göre kart genişletir; font
  karta fit edilir; yumuşak çıkış (`fadOut=300`).
- **Yanlış dil = SERT upload kapısı:** `languageMatch===false` → `CTA_WRONG_LANGUAGE`
  → tüm platformlarda upload durur (warning-mod override **aşamaz**).

## Rapor ↔ Çıktı gerçeği (hata #8, #10)

**Kök neden:** Rapor "stereo" gibi **hedeflenen** değerleri yazıyordu; final MP4
ölçülmüyordu. QC gerçek videoyu dinlemeden "başarılı" üretebiliyordu.

**Düzeltme:**
- Preflight ffprobe'a `channels, channel_layout, sample_rate` eklendi; rapor
  `audioTruth` bloğunda **ÖLÇÜLEN** değerleri yazar.
- Çıktı **stereo garanti** (`aformat=channel_layouts=stereo` + `-ac 2`); mono
  çıkarsa `CHANNEL_METADATA_MISMATCH` → sert blok.
- `outputVerification` bloğu (SFX cue ölçümleri, CTA dil/yerleşim, kanal, sert
  kapı sonucu) rapora yazılır.

## Sert Kapılar (warning-mod override AŞAMAZ)

`src/pipeline/hardGate.js#evaluateHardGate` — aşağıdakiler upload'u **her modda**
durdurur ve `productionReady=false` yapar:

| İhlal | Kod |
|---|---|
| İngilizce içerikte yanlış dil CTA | `CTA_WRONG_LANGUAGE` |
| Final videoda SFX doğrulanamadı | `SFX_*` |
| CTA altyazı/UI çakışması | `CTA_CAPTION_OVERLAP` / `CTA_UI_OVERLAP` |
| CTA güvenli kenar dışı | `CTA_OUTSIDE_SAFE_MARGIN` |
| Müzik havuzu tükendi + tekrar | `MUSIC_POOL_EXHAUSTED` |
| Kanal (stereo) metadata çelişkisi | `CHANNEL_METADATA_MISMATCH` |

## Sandbox kısıtı (dürüst not)

Gerçek `bee-honeycomb-hexagons.mp4`'i bu ortamda yeniden RENDER edemiyorum:
TTS / Pexels / Gemini ağ erişimi bu sandbox'ta kapalı; `bee-before.mp4` yalnızca
GitHub artifact'inde. Bu yüzden `scripts/bee-regression.js` **sentetik** ama
**gerçek ffmpeg** ile üretilmiş bir kanıt seti oluşturur (kod yollarını fiilen
çalıştırır): İngilizce LIKE CTA, ducked SFX miksi, çıktı doğrulaması, 3 pozisyon.
Gerçek konu render'ı CI'da (ağ açıkken) yukarıdaki kod yollarını aynen kullanır.
