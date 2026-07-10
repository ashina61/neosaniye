# Instagram + Facebook otomatik yayın kurulumu

Her video YouTube'a yüklendikten sonra otomatik olarak **Instagram Reels** ve
**Facebook Reels** olarak da yayınlanır. Kurulum tek seferlik, tamamen
tarayıcıdan yapılır, ücretsizdir. Kendi hesabına yayın için Meta'nın uygulama
incelemesi (App Review) GEREKMEZ.

**Tek zorunlu GitHub secret'ı: `META_USER_TOKEN`** (uzun ömürlü kullanıcı
token'ı). Sayfa, sayfa token'ı ve Instagram hesabı her run'da otomatik
keşfedilir; bir şey eksikse run logunda Türkçe olarak ne yapılacağı yazar.

---

## 1) Facebook Sayfası (yoksa)

https://www.facebook.com/pages/create → kanal adıyla bir sayfa aç.
Kişisel profil YETMEZ — "Sayfa" şart.

## 2) Instagram'ı profesyonel yapıp sayfaya bağla

1. Instagram → Ayarlar → **Hesap türü ve araçlar** → **Profesyonel hesaba
   geç** → **İçerik Üreticisi (Creator)**.
2. Instagram → Ayarlar → **Hesap Merkezi** → **Hesaplar** → Facebook'u ve
   1. adımdaki SAYFAYI bağla.

## 3) Meta developer uygulaması (tek seferlik)

1. Geliştirici kaydı: https://developers.facebook.com/async/registration
2. Uygulama oluştur: https://developers.facebook.com/apps/creation/
   (use case: Other, tip: Business). Telefonda buton görünmezse tarayıcıda
   "Masaüstü sitesi"ni aç.
3. Settings → Basic'ten **App ID** ve **App Secret**'ı not et.

## 4) Token üret (Graph API Explorer) — KRİTİK ADIM

1. https://developers.facebook.com/tools/explorer → sağ üstte uygulamanı seç
2. Permissions'a şu 5 izni ekle: `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
3. **Generate Access Token** → açılan Facebook onay penceresinde:
   - "Hangi Sayfalar?" adımında **sayfanı İŞARETLE** ⚠️ (varsayılan boş olabilir!)
   - "Hangi Instagram hesapları?" adımında **Instagram hesabını İŞARETLE** ⚠️
4. Çıkan token kısa ömürlüdür (~1-2 saat) — hemen 5. adıma geç.

> Daha önce onay verip sayfayı işaretlemeyi atladıysan pencere bir daha
> çıkmaz. Önce https://www.facebook.com/settings/?tab=business_tools
> sayfasından uygulamayı KALDIR, sonra bu adımı tekrarla.

## 5) Kısa token'ı uzun ömürlüye çevir

Tarayıcıda aç (üç yeri doldur):

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=KISA_TOKEN
```

Çıkan JSON'daki `access_token` = **META_USER_TOKEN** (≈60 gün geçerli).

Doğrulamak istersen şu link sayfanı listelemeli (boş dönmemeli):

```
https://graph.facebook.com/v21.0/me/accounts?access_token=UZUN_TOKEN
```

## 6) GitHub'a ekle

Repo → Settings → Secrets and variables → Actions → **Secrets** →
New repository secret → `META_USER_TOKEN` = uzun token.

Bitti. Sonraki run loglarında şunları görmelisin:
`[meta] sayfa: <adı>` → `[meta] instagram: <id>` →
`Instagram Reels yayınlandı` / `Facebook Reels yayınlandı`.

---

### Sorun giderme

- **`[meta] Hesabında erişilebilir Facebook Sayfası yok`** → 4. adımdaki
  pencerede sayfa işaretlenmemiş (ya da sayfa yok). Uyarıdaki kaldır-tekrarla
  yolunu izle.
- **`Sayfaya bağlı Instagram hesabı bulunamadı`** → 2. adım eksik; IG atlanır
  ama Facebook yayını çalışmaya devam eder.
- Token ~60 günde bir dolar → 4-5-6. adımları tekrarla (2 dakika). Dolarsa
  loglarda "Error validating access token" görürsün; video yine YouTube'a
  normal yüklenir.
