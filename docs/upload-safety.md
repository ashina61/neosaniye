# Yayın Güvenliği — cron neden onaysız yayın yaptı ve nasıl kapatıldı

> 26 Temmuz 2026. Kalite kontrolünden kalan `sea-cucumbers.mp4`
> (youtube.com/shorts/LeykuLoz5nA) cron tarafından YouTube + Instagram +
> Facebook'a yüklendi. Bu belge kök nedeni dosya/satır düzeyinde kayda geçirir.

## 1. Kök neden — üç katman, her biri TEK BAŞINA yeterli

**Katman 1 — workflow (`.github/workflows/daily-short.yml`, üretim adımı)**

```yaml
run: node scripts/generate-and-publish.js ${{ inputs.no_upload && '--no-upload' || '' }}
```

Bayrak yalnızca `inputs.no_upload` doğruysa geçiriliyordu. **`schedule`
tetiğinde `inputs` diye bir şey yoktur**: ifade boş stringe düşer, bayrak hiç
geçmez. Yani cron tanım gereği "upload açık" modda koşuyordu. Input'un adı da
ters mantıklıydı (`no_upload`) — güvenli tarafın işaretlenmesi gerekiyordu.

**Katman 2 — `scripts/generate-and-publish.js`**

```js
const upload = args.includes('--no-upload') ? false : undefined;
```

Bayrak yoksa "karar verilmedi" gönderiliyordu.

**Katman 3 — `src/pipeline/run.js` (eski satır 76)**

```js
const willUpload = upload === true || (upload !== false && hasYouTube);
```

`undefined` gelince ifade `hasYouTube`e indirgeniyordu:
**kimlik bilgisinin VARLIĞI, yayın İZNİ sayılıyordu.** Asıl hata budur.
Bir anahtarın tanımlı olması, o gün üretilen videonun yayınlanabilir olduğunu
söylemez.

**Katman 4 — kapı hesaplanıyor ama kullanılmıyordu**

`emergencyQualityGate` `block: true` döndürüyor, log'a ⛔ basılıyor, ama
`uploadGate({ preflightOk, qc })` bu değeri hiç okumuyordu. Retention QC de
varsayılan `warning` modundaydı. Sebep anlaşılır: kural setinde HER KOŞUDA
kesin ateşlenen iki madde vardı —

- `AI_STILL_RUN` (arka arkaya 3 AI karesi): sistem tüm görsellerini kasten AI
  ile üretiyor, kural 20 planda 18 kez ateşleniyordu.
- `ASSET_RIGHTS_EVIDENCE_MISSING`: kendi ürettiğimiz görsele üçüncü taraf
  lisans belgesi arıyordu.

Bağlansaydı hiçbir video yayınlanamazdı. **Sürekli öten alarm, kapalı alarmla
aynı şeydir.**

## 2. Yeni sözleşme

Tek yetkili karar noktası: `src/pipeline/uploadPolicy.js`.

### Öncelik (ilk eşleşen kazanır)

| # | Kaynak | Sonuç |
|---|---|---|
| 1 | CLI `--no-upload` | KESİN HAYIR |
| 2 | CLI `--upload` | talep |
| 3 | `AUTO_UPLOAD=false\|0\|no\|off` | KESİN HAYIR |
| 4 | `AUTO_UPLOAD=true\|1\|yes\|on` | talep |
| 5 | hiçbiri | KESİN HAYIR (manuel onay şart) |

Anlaşılmayan bir env değeri (`maybe`) asla "açık" sayılmaz.

### Talep varsa sırayla sorulan kapılar

1. manuel onay (`REQUIRE_MANUAL_APPROVAL`, varsayılan `true`)
2. kimlik bilgisi
3. teknik preflight
4. **QC var mı** — rapor yoksa upload yok ("üretilemedi" başarı değildir)
5. QC geçti mi (`needs_review` de engeldir)
6. acil kalite kapısı (BLOKE kümesi)
7. yayın kapıları (altyazı / özne / eylem / liste / CTA / tekrar)

Upload kapalıyken log'a tam olarak şu basılır:

```
UPLOAD BLOCKED: manual approval is required.
```

### Acil kapıda ağırlık ayrımı

- **BLOKE**: izleyicinin gördüğünü bozan / bütünlük ihlali olan her şey.
- **KAYIT**: hak-künye defter tutma eksikleri. Gerçek ve raporlanır, ama
  yayını durdurmaz — müzik künyesi eksik diye kanal susmamalı.

## 3. Workflow

- Input `no_upload` → `auto_upload` (düz mantık, varsayılan `false`).
- Üretim adımı: `${{ inputs.auto_upload && '--upload' || '--no-upload' }}`
  — cron'da input olmadığı için **daima** `--no-upload`.
- İkinci emniyet olarak env: `AUTO_UPLOAD`, `REQUIRE_MANUAL_APPROVAL: "true"`.
- Artifact'ler: mp4, kapak, script.json, scene-plan.json, publish-gates.json,
  asset-manifest.json, production-report, subs.srt.

## 4. Yayın kapıları (`src/pipeline/publishGates.js`)

Tek genel skor YOKTUR. Sea cucumbers videosu retention'dan 84/100 aldı;
ortalama iyi göründüğü için altındaki kritik hatalar görünmedi. Her kapı ayrı
değerlendirilir, biri düşerse video durur.

Üç durum: `pass` / `needs_review` / `fail`. İkincisi de üçüncüsü de engeldir.
Görüntü semantiğini doğrulayacak bir model olmadığı için özne sürekliliği
şu an `needs_review` üretir — **yanlış güven üretmektense engellemeyi seçtik.**

## 5. Doğrulama

`node scripts/dry-run-gates.js` — 26 Tem videosunun gerçek verisini bugünkü
kapılardan geçirir, upload yapmaz. Sonuç: yayın kapıları FAIL, karar ENGELLİ.
