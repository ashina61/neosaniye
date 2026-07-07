# YouTube Otomatik Upload — OAuth Kurulumu (telefondan yapılabilir)

Amaç: bir kerelik **refresh token** üretmek. Bu token GitHub Secrets'ta durur ve
pipeline her çalıştığında YouTube'a otomatik yükleme yapar. Üç adım.

---

## Adım A — Google Cloud'da OAuth istemcisi oluştur (tarayıcı)

1. `console.cloud.google.com` → üstten yeni bir proje oluştur (ör. `neosaniye`).
2. **APIs & Services → Library** → "YouTube Data API v3" ara → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Uygulama adı, destek e-postası, developer e-postası doldur.
   - **Scopes** adımında ekle: `.../auth/youtube.upload`.
   - **Test users** adımında kendi Google/YouTube hesabını ekle.
   - Kaydet.
   > Önemli: uygulama "Testing" modundayken refresh token 7 günde bir geçersiz
   > olabilir. Kalıcı olması için consent screen'i **Publish (Production)** yap
   > (doğrulama gerektirmez, sadece "unverified" uyarısı çıkar — kendi kanalın
   > için sorun değil).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** → şu ikisini ekle:
     - `https://developers.google.com/oauthplayground`  (telefon yöntemi için)
     - `http://localhost:4319/oauth2callback`  (bilgisayar betiği için)
   - Create → **Client ID** ve **Client Secret**'ı kopyala.

---

## Adım B — Refresh token üret

### Yöntem 1: OAuth Playground (telefondan, önerilen)

1. `developers.google.com/oauthplayground` aç.
2. Sağ üstteki **dişli (⚙️)** → **Use your own OAuth credentials** işaretle →
   Adım A'daki Client ID ve Secret'ı yapıştır.
3. Sol listede en alttaki kutuya scope'u elle yaz:
   `https://www.googleapis.com/auth/youtube.upload` → **Authorize APIs**.
4. Google hesabınla izin ver (test user olarak eklediğin hesap).
5. **Exchange authorization code for tokens** → dönen **Refresh token**'ı kopyala.

### Yöntem 2: Betik (bilgisayarda)

`.env` içine CLIENT_ID/SECRET ekledikten sonra:
```bash
node scripts/youtube-auth.js
```
Yazdırılan URL'yi aç, izin ver; **REFRESH TOKEN** terminalde belirir.

---

## Adım C — Anahtarları yerine koy

- **Yerel test:** `.env` içine:
  ```
  YOUTUBE_CLIENT_ID=...
  YOUTUBE_CLIENT_SECRET=...
  YOUTUBE_REFRESH_TOKEN=...
  YOUTUBE_PRIVACY=private   # ilk testte private, emin olunca public yap
  ```
- **GitHub (Faz 7):** repo → Settings → Secrets and variables → Actions → aynı
  üç ismi secret olarak ekle.

Test:
```bash
node scripts/upload-youtube.js output/<konu>/<konu>.mp4 examples/<konu>.json
```

---

## Shorts kuralları (kod bunları hallediyor)

- Video **dikey** ve **≤ 60 sn** (bizimkiler ~40 sn) → Shorts sayılır.
- Başlık/açıklamaya **#Shorts** otomatik ekleniyor (`buildMetadata`).
- Kota: YouTube upload günde ~6 video sınırı için fazlasıyla yeterli (varsayılan
  10.000 birim/gün; upload ~1600 birim).
