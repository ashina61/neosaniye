# API Key / Secret Kurulum Rehberi (telefondan, tarayıcı üzerinden)

Her fazda hangi anahtarın gerektiği ve nereden alınacağı. **Faz 1 için sadece
1 numara (Google Gemini) yeterli.** Diğerleri ilgili faza gelince istenecek.

---

## 1) Google Gemini API Key — GEREKLİ (Faz 1)

Script üretimi için Gemini API anahtarı. **Ücretsiz, kredi kartı istemez.**

1. Tarayıcıdan `aistudio.google.com/apikey` adresine gir, Google hesabınla
   giriş yap.
2. **Create API key** (Get API key) → istersen yeni bir proje seçip oluştur.
3. Çıkan anahtarı **kopyala**.

Ücretsiz tier notu: `gemini-2.5-flash` ücretsiz katmanda günlük/dakikalık
istek limitleriyle gelir; günde 1-2 script üretimi bu limitlerin çok altında
kalır. Kart eklemek gerekmez.

Nereye yazılır:
- **Yerel test:** proje kökünde `.env` dosyası oluştur (`.env.example`'ı
  kopyala) ve `GEMINI_API_KEY=...` satırını doldur.
- **GitHub (Faz 7):** repo → **Settings → Secrets and variables → Actions →
  New repository secret** → isim `GEMINI_API_KEY`, değer anahtar.

---

## 2) Firebase Servis Hesabı — opsiyonel kalıcı durum

> Zorunlu değil. Firebase ayarlanmamışsa sistem `data/` altındaki JSON state'i
> kullanır; GitHub Actions bu state'i iş sonunda repoya commit eder. Firestore,
> Git dışından merkezi ve daha dayanıklı bir state katmanı istersen eklenebilir.

1. `console.firebase.google.com` → projeni seç.
2. **Project settings (dişli) → Service accounts → Generate new private key**.
3. İnen JSON dosyasını aç, **tüm içeriğini tek satır** olarak kopyala.
4. Yerelde `.env` içine `FIREBASE_SERVICE_ACCOUNT='{...}'` olarak yapıştır;
   GitHub'da aynı isimle secret olarak ekle.
5. Firestore'u henüz açmadıysan: sol menü **Firestore Database → Create
   database → production mode**.

---

## 3) Pexels API Key — Faz 3 (görseller)

1. `pexels.com/api` → **Get Started** / giriş yap.
2. Otomatik bir API anahtarı verilir; kopyala.
3. `PEXELS_API_KEY` olarak `.env`'e ve GitHub secret'a ekle.

---

## 4) YouTube Data API OAuth — Faz 6 (otomatik upload)

> En detaylı adım burası; Faz 6'ya gelince birlikte tek tek yapacağız.
> Özet: Google Cloud Console'da bir OAuth istemcisi oluşturup bir kerelik
> yetkilendirme ile bir **refresh token** üreteceğiz ve onu secret'a koyacağız.
> `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
