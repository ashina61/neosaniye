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
... → Montaj (render) → Preflight (teknik) → Retention QC (editoryal) → Upload
```

`src/pipeline/run.js` preflight'tan hemen sonra `runRetentionQC(...)` çağırır.
QC çökerse bile üretim durmaz (hata loglanır, video yayınlanır) — günlük akış
QC yüzünden asla kesilmez.

## Modlar

| Mod | Davranış |
|---|---|
| `disabled` | Hiçbir şey yapılmaz. |
| `warning` **(varsayılan)** | Skor + rapor üretilir, loglanır; upload **asla engellenmez**. |
| `strict` | Skor < eşik **veya** kritik hata varsa upload engellenir; video artifact olarak kalır. |

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
| Altyazı | 10 | punto ≥50px (4) · satırda ≤4 kelime (3) · 24+ karakterlik kelime yok (3) |
| Görsel çeşitlilik | 10 | ≥3 farklı kaynak (ai/stok/arşiv/gfx) (4) · aynı kaynaktan ≤3 ardışık plan (3) · placeholder yok (3) |
| Ses tasarımı | 10 | ses akışı var (4) · loudness -14±2 LUFS (3) · 2-6 duyulur sfx (2) · sfx çeşitli (1) |
| Final + loop | 10 | finale_text var (4) · kuyruk ≤0.6s (3) · abone kartı son %45'te (3) |

**Kritik hatalar** (skordan bağımsız `status: fail` + strict'te engel):
`hook_text yok` · `placeholder görsel üretimde` · `ses akışı yok`.

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
  "status": "pass",            // pass | warning | fail
  "productionReady": true,
  "mode": "warning",
  "minScore": 85,
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
npm test                      # 17 birim testi (node:test, ek bağımlılık yok)
RETENTION_QC_MODE=strict npm run produce:dry   # strict modu upload'suz dene
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
