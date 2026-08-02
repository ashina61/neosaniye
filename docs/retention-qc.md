# Retention QC — Editoryal Kalite Kapısı

Yayın öncesi çalışan **deterministik** kalite kontrolü. Preflight "video teknik
olarak sağlam mı?" sorusuna bakar; Retention QC ise "bu video izleyiciyi tutar
mı?" sorusuna **ölçülebilir** cevap verir. LLM tahmini yoktur — her alt kontrol
elimizdeki gerçek verilerden (kelime zamanlamaları, plan süreleri, kaynak
karışımı, kurgu planı, loudness) hesaplanır ve aynı girdi her zaman aynı skoru
üretir.

Kod: `src/pipeline/retentionQC.js` · Testler: `test/retention.test.js` ·
Eşikler: `src/config.js → config.retention`

## Pipeline'daki yeri

```
... → Montaj (render) → Preflight (teknik, final MP4 üzerinde) → Retention QC (editoryal) → TEK UPLOAD KAPISI → YT + IG + FB
```

`src/pipeline/run.js` preflight'tan hemen sonra `runRetentionQC(...)` çağırır.

**Tek ortak upload kapısı:** YouTube, Instagram ve Facebook'un ÜÇÜ de aynı
`uploadGate({preflightOk, qc})` koşulundan geçer (`run.js` Faz 6 bloğu).
Kapı = teknik preflight geçti **VE** QC mod kararı engel koymadı. Platform
bazlı bypass yoktur; IG/FB cross-post yalnızca aynı bloğun içinde çalışır.

## Alan sözleşmesi (rapor kendi içinde çelişmez)

| Alan | Anlamı |
|---|---|
| `technicalReady` | Final MP4 teknik olarak geçerli mi (preflight sonucu). |
| `editorialReady` | Retention skoru ≥ eşik VE kritik editoryal hata yok. Disabled modda `null` (değerlendirilmedi). |
| `productionReady` | `technicalReady && editorialReady && qcExecution.status === 'passed'`. |
| `uploadAllowedByPolicy` | Mevcut mod/politika otomatik yüklemeye izin veriyor mu. |
| `uploadEligibility` | Platform bazlı nihai karar + `policyOverride` + nedenler. |

`policyOverride: true` = video production-ready **değil** ama politika
(warning modu) yayına bilerek izin verdi — neden raporda açıkça yazar.
Yani "hazır değil ama yayınlandı" durumu artık çelişki değil, etiketli karar.

**QC exception ≠ düşük skor.** Düşük skor bir editoryal *sonuçtur*; politika
karar verebilir. Exception ise QC sisteminin hiç çalışmadığı anlamına gelir —
denetimden geçmeyen video **hiçbir aktif modda otomatik yayınlanmaz**:

| Mod | Düşük skor / kritik editoryal hata | QC exception |
|---|---|---|
| `disabled` | Değerlendirilmez (`qcExecution.status='disabled'`) | Değerlendirme hiç çalışmaz |
| `warning` **(varsayılan)** | Yayın devam eder, **POLICY OVERRIDE** rapora yazılır | **Upload ENGELLENİR** (fail-closed) |
| `strict` | Upload engellenir | Upload engellenir (fail-closed) |

Engellenen kayıt `blocked_qc` status'üyle düşer — yayınlanmış gibi görünmez;
render artifact'i her durumda korunur.

## Teknik kapı retention'dan bağımsızdır

`TECHNICAL_PREFLIGHT_MODE` (varsayılan **strict**) teknik kapıyı yönetir;
`RETENTION_QC_MODE` yalnızca editoryal kapıyı. **Retention QC disabled olsa
bile teknik preflight bağımsız olarak çalışmaya devam eder.**

- `strict` (varsayılan): teknik sert hata (decode başarısız, video/ses akışı
  yok, bozuk/sıfır dosya, geçersiz süre, yanlış çözünürlük, loudness) uploadı
  her koşulda durdurur → `technicalReady=false`.
- `warning`: teknik sorunlar raporlanır ama yayını durdurmaz (yalnızca elle
  debug için; kullanılırsa rapora POLICY OVERRIDE düşer).

Editoryal sorunlar (zayıf hook, uzun statik plan, düşük çeşitlilik, zayıf
loop, altyazı yoğunluğu) yalnızca `editorialReady`'yi belirler.

## Upload karar tablosu (testlerde birebir doğrulanır)

| Teknik | QC modu | QC sonucu | Skor | Upload |
|---|---|---|---|---|
| FAIL | herhangi | herhangi | herhangi | **BLOCK** |
| PASS | disabled | disabled | — | ALLOW |
| PASS | warning | passed | yüksek | ALLOW |
| PASS | warning | failed | düşük | ALLOW + **policyOverride** raporda |
| PASS | warning | error | — | **BLOCK** (fail-closed) |
| PASS | strict | passed | yüksek | ALLOW |
| PASS | strict | failed | düşük | **BLOCK** |
| PASS | strict | error | — | **BLOCK** |

Tablo `test/retention.test.js` içinde parametrik olarak, üç platformun
(YouTube/Instagram/Facebook) her biri için ayrı ayrı doğrulanır.

## Modlar

| Mod | Davranış |
|---|---|
| `disabled` | Editoryal değerlendirme yapılmaz (`qcExecution.status='disabled'`); teknik preflight bağımsız çalışmaya devam eder. |
| `warning` **(varsayılan)** | Skor + rapor üretilir; düşük skor yayını durdurmaz (POLICY OVERRIDE raporda). QC'nin kendisi hata verirse upload engellenir. |
| `strict` | Skor < eşik, kritik hata **veya** QC hatası → upload engellenir; video artifact olarak kalır. |

Mod, GitHub → Settings → Actions → Variables üzerinden ayarlanır:

- `RETENTION_QC_MODE` = `disabled` / `warning` / `strict`
- `RETENTION_MIN_SCORE` = eşik (varsayılan **85**)

> Varsayılanın `warning` olması bilinçli bir karar: günlük cron yayını hiçbir
> koşulda sessizce durmasın. `strict`'i ancak skorların birkaç gün `warning`
> modda nasıl seyrettiğini gördükten sonra aç.

## Skor hesabı (100 puan)

| Kategori | Puan | Ölçülen |
|---|---|---|
| Hook | 25 | hook_text var mı (5) · ≤30 karakter (3) · zayıf kalıp yok ("did you know", "today we"...) (5) · vaat/sayı/soru/çelişki içeriyor (6) · ilk konuşma ≤900ms (4) · ilk cümle ≤16 kelime (2) |
| Görsel tempo | 20 | ortalama plan süresi ≤3.4s (8) · en uzun statik plan ≤4.5s (8) · hareketli görüntü payı ≥%25 (4) |
| Merak zinciri | 15 | 6-9 sahne (4) · ≥2 dönüş kelimesi (but/until/turns out...) (6) · konuşmada ölü boşluk yok (3) · finale_text var (2) |
| Altyazı | 10 | punto ≥50px (4) · ekranda aynı anda ≤4 kelime (3) · tüm olaylar font tabanına sığıyor (3) — GERÇEK yerleşim hesabıyla (render ile aynı `captionLayout.js` matematiği; safe-area ihlali ayrıca **kritik hata**) |
| Görsel çeşitlilik | 10 | ≥3 farklı kaynak (ai/stok/arşiv/gfx) (4) · aynı kaynaktan ≤3 ardışık plan (3) · placeholder yok (3) |
| Ses tasarımı | 10 | ses akışı var (4) · loudness -14±2 LUFS (3) · 2-6 duyulur sfx (2) · sfx çeşitli (1) |
| Final + loop | 10 | finale_text var (4) · kuyruk ≤0.6s (3) · abone kartı son %45'te (3) |

**Kritik hatalar** (skordan bağımsız `status: fail` + strict'te engel):
`hook_text yok` · `placeholder görsel üretimde` · `ses akışı yok` ·
`altyazı güvenli alan dışında`.

## Teknik doğrulama (final MP4, preflight.js)

Render bittikten sonra final MP4 üzerinde ffprobe/ffmpeg ile deterministik
kontroller çalışır ve sonuç rapora `technicalValidation` olarak girer:
akış varlığı (video/ses), gerçek süre + beklenen süreden sapma, çözünürlük
(1080x1920), fps, dosya boyutu, **tam decode testi** (bozuk bitstream),
siyah segmentler (`blackdetect`), donmuş kareler (`freezedetect`), sessiz
bölümler (`silencedetect`), peak clipping (`volumedetect`), LUFS
(`loudnorm`), ses-video süre uyumsuzluğu, başlangıç siyahı ve kuyruk
sessizliği. Eşikler `config.preflight`'ta (env: `PF_*`). Sert hatalar
(decode, akış yok, çözünürlük, süre penceresi, loudness) uploadı her modda
durdurur; segment tespitleri uyarı olarak rapora ve skora yansır.

## Altyazı yerleşim doğrulaması (captionLayout.js)

Altyazı kontrolü metin uzunluğu tahmini değildir: render'ın kullandığı
yerleşim matematiği (`src/video/captionLayout.js`) QC'de birebir yeniden
çalıştırılır. Kurallar: her olay tek satır; **split-before-shrink** (grup,
fontu `captionSplitRatio`'nun altına ezecekse önce ikiye bölünür); font
tabanı `captionMinPx`/`captionEmphMinPx` altına asla inilmez; vurgu koşusu
(sayı+birim) bölünmez; alt kenar boşluğu YouTube Shorts UI bandının
(`captionBottomSafePx`) üstünde ve blok üst kenarı ekranın üst yarısının
dışında kalmalı — ihlal **kritik hata** sayılır (strict'te fail).

Tüm eşikler `config.retention`'da toplanır ve env ile ezilebilir
(`QC_MAX_STATIC_SECONDS`, `QC_TARGET_EVENT_INTERVAL`, `QC_FIRST_SPEECH_MS`,
`QC_MAX_HOOK_CHARS`, `QC_MIN_CAPTION_PX`, `QC_MAX_CAPTION_WORDS`).
Kodda magic number yoktur.

## Çıktılar

Her üretimde çalışma klasörüne iki dosya yazılır (workflow artifact'ine dahil):

- `production-report.json` — makine tarafı:

```json
{
  "retentionScore": 91,
  "status": "pass",            // pass | warning | fail | error | disabled
  "technicalReady": true,
  "editorialReady": true,      // disabled modda null
  "productionReady": true,     // technicalReady && editorialReady && qcExecution=passed
  "uploadAllowedByPolicy": true,
  "mode": "warning",
  "qcMode": "warning",
  "minScore": 85,
  "qcExecution": { "status": "passed", "error": null },  // passed|failed|error|disabled
  "technicalValidation": { "videoStreamPresent": true, "audioStreamPresent": true,
    "durationSeconds": 35.2, "resolution": "1080x1920", "fps": 30,
    "decodePassed": true, "blackSegmentCount": 0, "freezeSegmentCount": 0,
    "silenceSegmentCount": 0, "maxVolumeDb": -5.9, "lufs": -13.9 },
  "uploadEligibility": { "youtube": true, "instagram": true, "facebook": true,
    "policyOverride": false, "reasons": [] },
  "scores": { "hook": 25, "visualPacing": 16, "curiosity": 15, "captions": 10,
              "visualVariety": 10, "audioDesign": 8, "payoffAndLoop": 7 },
  "metrics": { "firstSpeechMs": 320, "planCount": 11,
               "averageVisualEventInterval": 3.2, "longestStaticSegment": 4.1,
               "staticShare": 0.62, "deadAirCount": 0, "twistCount": 3,
               "sfxCount": 4, "sourceMix": "stock+ai+archive+gfx",
               "durationSeconds": 35.2 },
  "warnings": ["loudness -16.1 LUFS (hedef -14±2)"],
  "failures": [],
  "recommendedFixes": [],
  "createdAt": "2026-07-18T18:40:00.000Z"
}
```

- `production-report.md` — insan tarafı: skor tablosu, metrikler, uyarılar ve
  somut düzeltme önerileri.

Skor ayrıca `report.json`'a (`retentionScore`) ve video kaydına
(`retention: {score, status}`) yazılır — Baş Analist ileride skor ↔ gerçek
izlenme bağını bu veriden kuracak.

## Yerel komutlar

```bash
npm test                      # 40 birim/entegrasyon testi (node:test, ek bağımlılık yok)
node scripts/qc-dryrun.js     # sentetik fixture ile uçtan uca QC provası (upload yok)
node scripts/qc-dryrun.js output/<konu>/<konu>.mp4   # gerçek videoyla
RETENTION_QC_MODE=strict node scripts/qc-dryrun.js   # strict kapıyı dene
```

## Sık fail nedenleri

- **`hook_text yok`** — script şeması bozulmuş; generateScript çıktısını incele.
- **`placeholder görsel üretimde`** — tüm görsel kaynakları (gfx → arşiv →
  stok → AI → Pexels) o sahne için başarısız olmuş; run loglarında ilgili
  sahnenin zincirini kontrol et.
- **`ses akışı yok`** — TTS/miks hatası; preflight logları ile birlikte bak.
- **Skor 85 altı ama fail yok** — `recommendedFixes` listesi ne eksikse söyler
  (uzun statik plan, dönüşsüz anlatı, erken abone kartı...). `warning` modda
  bunlar bilgilendirmedir, yayın devam eder.
