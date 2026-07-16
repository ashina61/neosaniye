# NeoSaniye Animation Bible

Motion-graphics sahnelerinin marka kuralları. Makine karşılığı `src/config.js →
video.styleBible` objesindedir; template'ler (ör. `src/media/renderTemplate.js`)
onu okur. Bu dosya insan + LLM (Görüntü Yönetmeni promptu) için özettir.

## Felsefe (audit kararı)

- **AI runtime'da animasyon KODU YAZMAZ.** Görüntü Yönetmeni yalnızca doğrulanmış
  bir **parametre** üretir (ör. `stat: {value, unit, label}`); önceden test edilmiş
  bir ffmpeg template'i o parametreyle deterministik sahne render eder.
- **Compile hatası / arbitrary code / nondeterminism YOK.** Template'ler saf ffmpeg,
  yeni bağımlılık yok.
- **Asla kırılma:** template başarısız olursa sahne normal görsel zincirine
  (stok video → AI görsel → Pexels → placeholder) düşer.

## Canvas

- 1080×1920, 9:16, 30 fps.

## Görsel dil

- Kömür-siyah zemin (dikey gradyan `bg0`→`bg1`) + hafif vignette + ince turkuaz çerçeve.
- Temiz beyaz tipografi (`ink`).
- Logo turkuazı (`accent`) vurgu; derin kırmızı (`red`) yedek.
- Fontlar: Montserrat Black (sayı), Montserrat SemiBold (birim/etiket).

## Yasaklar

- Emoji, ucuz stok ikon, rastgele çizgi film, "AI gradyanı" hissi.
- Jenerik PowerPoint geçişleri, gereksiz yazı, her elemanın zıplaması.
- Ekrana **uydurma sayı** (anlatımda geçmeyen) basmak — kesinlikle yasak.

## Hareket

- Sayı 0'dan hedefe ~1.8 sn'de sayılır, sonra sabit tutulur (izleyici okur).
- Yumuşak fade-in; abartılı sürekli zoom/pan yok.
- Büyük görsel olay anlatımın vuruş anına denk gelmeli.

## Metin

- Template altyazı ÜRETMEZ — altyazı ana caption pipeline'ında kalır.
- Ekran etiketi yalnızca editoryal olarak gerektiğinde.

## Mevcut template'ler

| Template | Ne zaman | Parametre |
|---|---|---|
| `statCard` | Sahnenin çekirdeği anlatımda geçen ÇARPICI bir sayı | `{value, unit, label}` |

### Routing kuralları (Görüntü Yönetmeni)

- `stat` yalnızca **video başına 1 sahne**, **sahne 1 asla**, ve sayı **anlatımda
  gerçekten geçiyorsa** (anti-halüsinasyon guard: `isUsableStat`).
- Aksi halde her sahnede `stat = null` → normal görsel akışı.

## Tutarlılık

- Üretilen her sahne aynı NeoSaniye kanalının parçası gibi hissettirmeli:
  aynı koyu zemin, aynı tipografi, aynı altın/kırmızı vurgu.

## Yol haritası (henüz YOK — P1/P2)

- `barCompare` / `percentage`, `timeline`, `map_route` (statik harita + ASS
  vektör rota), `ranking`. Hepsi saf ffmpeg/SVG, aynı guard + fallback deseni.
