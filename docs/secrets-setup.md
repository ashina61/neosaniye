# API Key / Secret Kurulum Rehberi (telefondan, tarayıcı üzerinden)

Her fazda hangi anahtarın gerektiği ve nereden alınacağı. **Faz 1 için sadece
1 numara (Anthropic) yeterli.** Diğerleri ilgili faza gelince istenecek.

---

## 1) Anthropic API Key — GEREKLİ (Faz 1)

Script üretimi için Claude API anahtarı.

1. Tarayıcıdan `console.anthropic.com` adresine gir, giriş yap / kayıt ol.
2. Sol menüden **API Keys** → **Create Key**.
3. Anahtara bir isim ver (ör. `neosaniye`), oluştur ve **kopyala**
   (bir daha gösterilmez).
4. Ücretlendirme için **Billing** kısmından küçük bir kredi ekle (script'ler
   çok küçük olduğu için maliyet aylık birkaç sentin altında kalır).

Nereye yazılır:
- **Yerel test:** proje kökünde `.env` dosyası oluştur (`.env.example`'ı
  kopyala) ve `ANTHROPIC_API_KEY=...` satırını doldur.
- **GitHub (Faz 7):** repo → **Settings → Secrets and variables → Actions →
  New repository secret** → isim `ANTHROPIC_API_KEY`, değer anahtar.

---

## 2) Firebase Servis Hesabı — Faz 5 (konu/geçmiş kaydı)

> Faz 1'de zorunlu değil. Verilmezse tekrar kontrolü atlanır, script üretimi
> yine çalışır. Zaten Firebase kullandığımız için mevcut projeyi kullanacağız.

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
