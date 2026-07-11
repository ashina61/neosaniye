# Meta token — bilgisayar-kullanan AI agent yönergesi (runbook)

Bu dosyayı bir "computer use" agent'ına (Claude Computer Use, ChatGPT Agent vb.)
GÖREV olarak ver. Agent SENİN tarayıcında, senin oturumunla çalışır.

## Agent'a verilecek görev metni (aynen kopyala)

> Sen dikkatli bir kurulum asistanısın. GÖREVİN SADECE aşağıdaki adımlardır.
> Bu adımların DIŞINDA hiçbir şey yapma: gönderi paylaşma, hesap ayarı değiştirme,
> ödeme/kart bilgisi girme, başka sayfalara gitme YOK. Herhangi bir adımda
> beklenmeyen bir ekran, ödeme isteği veya belirsizlik görürsen DUR ve bana sor.
>
> Amaç: Facebook Sayfası + Instagram'a otomatik yayın için geçerli bir
> "uzun ömürlü kullanıcı erişim token'ı" üretmek ve token'ın sayfayı gördüğünü
> doğrulamak.
>
> ÖN KOŞUL (ben sağladım, doğrula): Bir Facebook Sayfam var ve Instagram
> Creator hesabım bu sayfaya bağlı. Değilse DUR, bana söyle.
>
> ADIMLAR:
> 1. https://developers.facebook.com/apps/ adresine git. "neosaniye-crosspost"
>    adlı bir uygulama varsa onu aç; yoksa "Create App" → use case: "Other" →
>    type: "Business" → ad: "neosaniye-crosspost" → oluştur.
> 2. Uygulamada Settings → Basic aç. Buradaki **App ID** ve **App Secret**
>    ("Show" ile) değerlerini bana METİN olarak ver. (Bunları bir yere yazacağım.)
> 3. https://developers.facebook.com/tools/explorer aç. Sağ üstte "Meta App"
>    açılırından "neosaniye-crosspost"u seç.
> 4. "Permissions" alanına şu 5 izni tek tek ekle: pages_show_list,
>    pages_read_engagement, pages_manage_posts, instagram_basic,
>    instagram_content_publish.
> 5. "Generate Access Token"a bas. Açılan Facebook onay penceresinde:
>    - "Devam et / Continue" de.
>    - **"Hangi Sayfalar / Which Pages"** ekranı gelince: TÜM sayfaları değil,
>      benim sayfamı KUTUCUKTAN İŞARETLE (kutunun mavi/işaretli olduğundan emin ol).
>    - **"Hangi Instagram / Which Instagram"** ekranında Instagram hesabımı İŞARETLE.
>    - Onayla ve pencereyi tamamla.
> 6. Explorer'da beliren kısa token'ı KOPYALA. Sonra şu adresi tarayıcıda aç
>    (APP_ID, APP_SECRET ve KISA_TOKEN'ı 2. ve 6. adımdaki değerlerle değiştir):
>    https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=KISA_TOKEN
>    Çıkan JSON'daki "access_token" = UZUN token. Bunu bana ver.
> 7. DOĞRULAMA: şu adresi aç (UZUN token ile):
>    https://graph.facebook.com/v21.0/me/accounts?access_token=UZUN_TOKEN
>    - Çıktıda "data" içinde sayfam görünüyorsa BAŞARILI — bana UZUN token'ı ve
>      "sayfa göründü" bilgisini ver, GÖREV BİTTİ.
>    - Çıktı boş ("data": []) ise: 5. adımda sayfa işaretlenmemiş demektir.
>      Bir kez daha 5-7'yi tekrarla; yine boşsa DUR ve bana bildir (Meta'nın
>      bilinen bir hatası olabilir).
>
> GÜVENLİK: App Secret ve token hassastır; yalnızca bana (bu sohbette) ver,
> başka hiçbir yere yazma/gönderme. Kart/ödeme istenirse ASLA girme, DUR.

## Token gelince ne yapacaksın (sen)

1. GitHub → repo → Settings → Secrets and variables → Actions → **Secrets**
2. `META_USER_TOKEN` adlı secret'ı **güncelle** (yoksa oluştur) → UZUN token'ı yapıştır.

Bitti. Sonraki run otomatik olarak Instagram + Facebook'a da yayınlar
(loglarda `[meta] sayfa: ...` → `Instagram Reels yayınlandı`).

## Notlar
- Kod tarafı hazır; tek eksik geçerli token. `META_USER_TOKEN` boş/geçersizse
  sistem cross-post'u sessizce atlar, YouTube akışı etkilenmez.
- Token ~60 günde bir dolar; aynı runbook'la 2 dakikada yenilenir.
