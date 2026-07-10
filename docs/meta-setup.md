# Instagram + Facebook otomatik yayın kurulumu

Her video YouTube'a yüklendikten sonra otomatik olarak **Instagram Reels** ve
**Facebook Reels** olarak da yayınlanır. Kurulum tek seferlik, tamamen
tarayıcıdan yapılır, ücretsizdir. Kendi hesabına yayın için Meta'nın uygulama
incelemesi (App Review) GEREKMEZ — uygulama geliştirme modunda kalabilir.

Sonunda elde edeceklerin:

| Nereye | Ad | Ne |
|---|---|---|
| GitHub Secret | `META_PAGE_TOKEN` | Süresiz sayfa erişim token'ı |
| GitHub Variable | `META_PAGE_ID` | Facebook sayfa ID'si |
| GitHub Variable | `META_IG_USER_ID` | Instagram hesap ID'si |

---

## 1) Facebook Sayfası (yoksa)

https://www.facebook.com/pages/create → kanal adıyla bir sayfa aç
(ör. "neosaniye"). Zaten varsa geç.

## 2) Instagram'ı profesyonel yapıp sayfaya bağla

1. Instagram uygulaması → Ayarlar → **Hesap türü ve araçlar** →
   **Profesyonel hesaba geç** → **İçerik Üreticisi (Creator)** seç.
2. Instagram Ayarlar → **Hesap Merkezi** → **Hesaplar** → Facebook hesabını
   ve 1. adımdaki SAYFAYI bağla. (Alternatif: Facebook sayfa ayarları →
   Bağlı hesaplar → Instagram → Bağlan.)

## 3) Meta developer uygulaması aç

1. https://developers.facebook.com → **My Apps** → **Create App**
2. Use case: **Other** → App type: **Business** → isim: `neosaniye-crosspost`
3. Oluşunca: **Settings → Basic** sayfasındaki **App ID** ve **App Secret**'ı
   bir kenara not et (5. adımda lazım).

## 4) İzinli token üret (Graph API Explorer)

1. https://developers.facebook.com/tools/explorer aç
2. Sağ üstte **Meta App**: az önce açtığın uygulamayı seç
3. **Permissions** kısmına şu 5 izni ekle:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`
4. **Generate Access Token** → açılan pencerede Facebook'a onay ver —
   ⚠️ sorulduğunda hem SAYFANI hem INSTAGRAM hesabını seçtiğinden emin ol
5. Çıkan token'ı kopyala (kısa ömürlüdür, hemen 5. adıma geç)

## 5) Kısa token'ı süresiz sayfa token'ına çevir

1. Tarayıcıda aç (üç yeri kendi değerlerinle doldur):

   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=KISA_TOKEN
   ```

   Çıkan JSON'daki `access_token` = **uzun ömürlü kullanıcı token'ı**.

2. Şimdi sayfa token'ı ve sayfa ID'si (UZUN_TOKEN'ı yapıştır):

   ```
   https://graph.facebook.com/v21.0/me/accounts?access_token=UZUN_TOKEN
   ```

   Çıkan listede sayfanın `id` değeri = **META_PAGE_ID**,
   `access_token` değeri = **META_PAGE_TOKEN** (bu token pratikte süresizdir).

3. Instagram ID (PAGE_ID ve PAGE_TOKEN'ı yapıştır):

   ```
   https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_TOKEN
   ```

   Çıkan `instagram_business_account.id` = **META_IG_USER_ID**.

## 6) GitHub'a ekle

Repo → Settings → Secrets and variables → Actions:

- **Secrets** sekmesi → New repository secret → `META_PAGE_TOKEN` = sayfa token'ı
- **Variables** sekmesi → `META_PAGE_ID` ve `META_IG_USER_ID`

Bitti. Sonraki run'dan itibaren loglarda `Instagram Reels yayınlandı` /
`Facebook Reels yayınlandı` satırlarını görmelisin.

---

### Notlar / sorun giderme

- Token/ID'lerden herhangi biri eksikse sistem cross-post'u sessizce atlar;
  YouTube yüklemesi hiçbir koşulda etkilenmez.
- `(#200) Requires instagram_content_publish` benzeri hata: 4. adımda izinler
  eksik seçilmiş — token'ı izinlerle yeniden üret ve 5. adımı tekrarla.
- IG tarafı "Media upload has failed" derse video işlenirken zaman aşımı
  olmuştur; sonraki run'da kendini toparlar (her run bağımsız dener).
- Sayfa token'ı, Facebook şifresi değişirse veya oturumlar sonlandırılırsa
  geçersiz kalır — aynı adımlarla 2 dakikada yenilenir.
