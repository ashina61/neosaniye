#!/usr/bin/env python3
"""
ALFA CUTOUT ÜRETİMİ

Mimarinin göbeğindeki engel buydu: katmanlı kolaj, alfa kanallı parça ister.
Görsel modellerinin çoğu şeffaf arka plan vermiyor.

=========================== NEDEN MODEL YOK ===========================

rembg/u2net gibi segmentasyon modelleri ~176 MB indirme ister ve bu ortamın ağ
politikası o hostları engelliyor. Ama daha önemlisi: bu estetik için gerekli
DEĞİL.

Referans stil zaten "aged newsprint üstünde siyah-beyaz halftone mürekkep".
Yani görsel modelinden BEYAZ ZEMİNDE HALFTONE istendiğinde, alfa kanalı
doğrudan parlaklıktan türetilebilir: koyu mürekkep opak, beyaz kağıt şeffaf.
Segmentasyon problemi hiç ortaya çıkmıyor.

İki mod var:

  ink   — parlaklık → alfa. Halftone grafik, gravür, siluet, harita, damga
          için doğru mod. Sıfır maliyet, mükemmel kenar, model yok.
          Bedeli: öznenin AÇIK tonları da şeffaflaşır (beyaz gömlek delik
          olur). Grafik öğede istenen davranış, portrede değil.

  matte — kenardan taşma-doldurma. Öznenin tam ton aralığı korunur, ama
          arka planın tekdüze olmasını şart koşar. Portre ve nesne için.

=========================== ALFA DOĞRULAMA ===========================

Bu modülün en önemli parçası `verify_alpha`. Diğer bir yaklaşımda prompt'a
"TRANSPARENCY IS MANDATORY" yazılmış ama modelden `image/jpeg` istenmişti —
JPEG'in alfa kanalı YOKTUR. Sonuç: dört opak katman üst üste biniyor, en
üstteki alttakileri tamamen kapatıyor, ve hiçbir yerde kontrol edilmediği için
sessizce bozuk çalışıyor.

Buradaki kural: alfa üretildiğini İDDİA ETMEK yetmez, ÖLÇÜLÜR. Tamamen opak
ya da tamamen şeffaf çıktı hatadır ve reddedilir.
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

# Kabul edilebilir alfa aralığı: bu sınırların dışı "cutout olmamış" demektir.
MIN_OPAQUE_SHARE = 0.02   # görselin en az %2'si opak olmalı, yoksa boş
MAX_OPAQUE_SHARE = 0.94   # en fazla %94, yoksa hiç kesilmemiş


class CutoutError(RuntimeError):
    pass


# --------------------------------------------------------------------------
# ink modu
# --------------------------------------------------------------------------
def ink_alpha(rgb: np.ndarray, white_point: int = 238, black_point: int = 60) -> np.ndarray:
    """
    Parlaklığı alfaya çevir: beyaz kağıt şeffaf, koyu mürekkep opak.

    white_point/black_point arası doğrusal geçiş verir, yani halftone
    noktalarının kenarı yumuşak kalır — sert eşik "merdiven" kenar üretirdi.
    """
    luma = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.float32)
    a = (white_point - luma) / max(white_point - black_point, 1)
    return np.clip(a, 0.0, 1.0)


# --------------------------------------------------------------------------
# matte modu
# --------------------------------------------------------------------------
def border_flood_alpha(rgb: np.ndarray, tolerance: int = 26, feather: int = 2) -> np.ndarray:
    """
    Kenarlardan başlayarak arka plan rengine benzeyen bölgeyi şeffaflaştır.

    Taşma-doldurma (flood fill) kullanılıyor, "arka plan rengine benzeyen TÜM
    pikselleri sil" değil: ikincisi öznenin içindeki aynı renkli bölgeleri de
    (gözün beyazı, gömlek) siler. Bağlantılılık şartı bunu engeller.
    """
    h, w, _ = rgb.shape
    img = rgb.astype(np.int16)

    # Arka plan rengi: dört kenarın medyanı. Ortalama değil — köşedeki bir
    # imza/damga ortalamayı kaydırır, medyan dayanıklıdır.
    edge = np.concatenate([
        img[0, :, :].reshape(-1, 3),
        img[h - 1, :, :].reshape(-1, 3),
        img[:, 0, :].reshape(-1, 3),
        img[:, w - 1, :].reshape(-1, 3),
    ])
    bg = np.median(edge, axis=0)

    similar = np.abs(img - bg).sum(axis=2) <= tolerance * 3

    # Kenardaki benzer piksellerden içeri doğru yayıl.
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not visited[y, x] and similar[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while q:
        y, x = q.popleft()
        push(y + 1, x)
        push(y - 1, x)
        push(y, x + 1)
        push(y, x - 1)

    alpha = (~visited).astype(np.float32)

    # Kenar yumuşatma: sert alfa kenarı kesik kağıt gibi değil, testere gibi
    # durur. Kutu bulanıklığı deterministiktir (Gauss çekirdeği sabit).
    if feather > 0:
        alpha = _box_blur(alpha, feather)
    return np.clip(alpha, 0.0, 1.0)


# --------------------------------------------------------------------------
# chroma modu — en dayanıklısı, çünkü girdiyi biz sipariş ediyoruz
# --------------------------------------------------------------------------
def chroma_alpha(rgb: np.ndarray, sat_min: float = 0.34, feather: int = 2) -> np.ndarray:
    """
    Doygun anahtar rengi sil.

    NEDEN BU MOD VAR: `matte` modu kendi test fikstüründe bir zayıflık gösterdi.
    Öznenin gradyanı arka plan tonuna yaklaştığı yerde taşma-doldurma özneye
    girip bir parça yedi. Tolerans daralttıkça arka plandaki sıkıştırma
    gürültüsü kaldı, gevşettikçe özne yendi; ikisinin arası yok.

    Çözüm mimari: prompt'u BİZ yazıyoruz. Arka planı doygun magenta istersek,
    siyah-beyaz halftone bir öznede o doygunlukta piksel HİÇ olamaz — ayrım
    tonda değil, doygunlukta yapılır ve kesin olur.

    Kural: doygunluğu eşiği geçen piksel arka plandır. Griler (özne) kalır.
    """
    f = rgb.astype(np.float32) / 255.0
    mx = f.max(axis=2)
    mn = f.min(axis=2)

    # MUTLAK kroma (mx - mn), göreli doygunluk (mx-mn)/mx DEĞİL.
    #
    # NEDEN: göreli doygunluk karanlıkta kararsızdır. Siyaha yakın bir pikselde
    # sıkıştırma gürültüsü mx=10, mn=4 yaparsa göreli doygunluk %60 çıkar ve
    # piksel "arka plan" sayılır. Kendi kanıt görüntümde bu, öznenin koyu
    # kenarını tırtıklı bir gürültüye çevirdi.
    #
    # Mutlak kromada aynı gürültü 0.024 eder; tam doygun magenta ise 1.0.
    # Ayrım kesindir ve parlaklıktan bağımsızdır.
    chroma = mx - mn
    alpha = (chroma < sat_min).astype(np.float32)
    if feather > 0:
        alpha = _box_blur(alpha, feather)
    return np.clip(alpha, 0.0, 1.0)


def keep_largest_blob(alpha: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    """
    En büyük opak bileşeni tut, iç boşlukları doldur.

    İki işi birden yapar: arka planda kalan tek tük lekeleri atar, ve öznenin
    içinde yanlışlıkla şeffaflaşmış bölgeleri geri kapatır. `matte` modunun
    özneden parça yeme sorununu büyük ölçüde onarır.
    """
    solid = alpha >= threshold
    h, w = solid.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes: list[int] = [0]
    cur = 0
    for sy in range(h):
        for sx in range(w):
            if not solid[sy, sx] or labels[sy, sx]:
                continue
            cur += 1
            n = 0
            q: deque[tuple[int, int]] = deque([(sy, sx)])
            labels[sy, sx] = cur
            while q:
                y, x = q.popleft()
                n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = cur
                        q.append((ny, nx))
            sizes.append(n)
    if cur == 0:
        return alpha
    best = int(np.argmax(sizes))
    mask = labels == best

    # İç boşlukları doldur: kenardan erişilemeyen şeffaf bölge, öznenin içidir.
    outside = np.zeros((h, w), dtype=bool)
    q2: deque[tuple[int, int]] = deque()

    def push2(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not outside[y, x] and not mask[y, x]:
            outside[y, x] = True
            q2.append((y, x))

    for x in range(w):
        push2(0, x)
        push2(h - 1, x)
    for y in range(h):
        push2(y, 0)
        push2(y, w - 1)
    while q2:
        y, x = q2.popleft()
        push2(y + 1, x)
        push2(y - 1, x)
        push2(y, x + 1)
        push2(y, x - 1)

    filled = mask | (~outside)

    # DİKKAT — burada bir hata yapıldı ve kanıt görüntüsünde görüldü.
    # Önce `np.where(filled, np.maximum(alpha, 1.0), alpha)` yazılmıştı: gövdeyi
    # opak yapıyor ama gövde DIŞINDAKİ parçaların özgün alfasını geri veriyordu.
    # Yani "en büyük parçayı tut" deyip diğerlerini hiç silmiyordu; öznenin
    # kopmuş parçası kompozisyonda asılı kalıyordu.
    #
    # Doğrusu: gövde opak, gövde dışı SIFIR. Tek piksellik bulanıklık gövdenin
    # sınırında kesik kağıt kenarı için gereken yarı saydam bandı bırakır.
    body = _box_blur(filled.astype(np.float32), 1)
    return np.clip(body, 0.0, 1.0)


def _box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """Ayrılabilir kutu bulanıklığı — kenar yumuşatma için yeterli, hızlı."""
    if r <= 0:
        return a
    k = 2 * r + 1
    pad = np.pad(a, r, mode="edge")
    # yatay
    cs = np.cumsum(pad, axis=1)
    horiz = (cs[:, k - 1 :] - np.concatenate([np.zeros((cs.shape[0], 1)), cs[:, : -k]], axis=1)) / k
    # dikey
    cs2 = np.cumsum(horiz, axis=0)
    vert = (cs2[k - 1 :, :] - np.concatenate([np.zeros((1, cs2.shape[1])), cs2[: -k, :]], axis=0)) / k
    return vert


# --------------------------------------------------------------------------
# halftone + doğrulama
# --------------------------------------------------------------------------
def to_halftone(rgb: np.ndarray, contrast: float = 1.25) -> np.ndarray:
    """
    Gri tona indir ve kontrastı aç. Renk bilgisi ATILIR: referans stilde her
    fotoğraf siyah-beyaz halftone, tek aksan rengi kompozisyonun kendisinden
    geliyor. Renkli cutout paleti anında bozar.
    """
    luma = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.float32)
    out = (luma - 128.0) * contrast + 128.0
    g = np.clip(out, 0, 255).astype(np.uint8)
    return np.dstack([g, g, g])


def verify_alpha(alpha: np.ndarray) -> dict:
    """
    Alfanın gerçekten anlamlı olduğunu ÖLÇ.

    Bu fonksiyon var, çünkü alfa üretimini iddia etmek ile üretmek arasındaki
    farkı yalnızca ölçüm kapatır. Tamamen opak çıktı "kesilmemiş", tamamen
    şeffaf çıktı "her şey silinmiş" demektir; ikisi de sessizce geçmemeli.
    """
    opaque = float((alpha > 0.6).mean())
    transparent = float((alpha < 0.1).mean())
    # Yarı saydam kenar bandı: gerçek bir kesikte küçük ama sıfır olmayan olur.
    edge = float(((alpha >= 0.1) & (alpha <= 0.6)).mean())
    ok = MIN_OPAQUE_SHARE <= opaque <= MAX_OPAQUE_SHARE and transparent > 0.02
    return {
        "opaque_share": round(opaque, 4),
        "transparent_share": round(transparent, 4),
        "edge_share": round(edge, 4),
        "ok": ok,
    }


def trim_to_content(rgba: np.ndarray, pad: int = 6) -> np.ndarray:
    """
    Şeffaf kenar boşluğunu kırp.

    Gerekli: model genelde özneyi karenin ortasına küçük koyar, etrafı boş
    bırakır. Kırpılmazsa Remotion'da cutout'un görünen boyutu istenenin çok
    altında kalır ve yerleşim bozulur.
    """
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 40)
    if len(ys) == 0:
        return rgba
    y0 = max(int(ys.min()) - pad, 0)
    y1 = min(int(ys.max()) + pad + 1, rgba.shape[0])
    x0 = max(int(xs.min()) - pad, 0)
    x1 = min(int(xs.max()) + pad + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def make_cutout(
    src: Path,
    dst: Path,
    mode: str = "ink",
    halftone: bool = True,
    tolerance: int = 26,
    feather: int = 2,
    trim: bool = True,
) -> dict:
    """Bir görselden alfa kanallı cutout PNG üret. Ölçüm sözlüğü döndürür."""
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im)

    if mode == "ink":
        alpha = ink_alpha(rgb)
    elif mode == "matte":
        alpha = border_flood_alpha(rgb, tolerance=tolerance, feather=feather)
        # matte özneden parça yiyebiliyor; en büyük bileşen + boşluk doldurma onarır.
        alpha = keep_largest_blob(alpha)
    elif mode == "chroma":
        alpha = chroma_alpha(rgb, feather=feather)
        alpha = keep_largest_blob(alpha)
    else:
        raise CutoutError(f"bilinmeyen mod: {mode}")

    stats = verify_alpha(alpha)

    body = to_halftone(rgb) if halftone else rgb
    rgba = np.dstack([body, (alpha * 255).astype(np.uint8)])
    if trim:
        rgba = trim_to_content(rgba)

    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(dst, "PNG", optimize=True)

    stats["mode"] = mode
    stats["size"] = [int(rgba.shape[1]), int(rgba.shape[0])]
    stats["path"] = str(dst)
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Alfa kanallı kolaj cutout üret")
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--mode", choices=["ink", "matte", "chroma"], default="ink")
    ap.add_argument("--no-halftone", action="store_true")
    ap.add_argument("--tolerance", type=int, default=26)
    ap.add_argument("--feather", type=int, default=2)
    ap.add_argument("--strict", action="store_true", help="alfa doğrulaması başarısızsa hata ver")
    a = ap.parse_args()

    stats = make_cutout(
        Path(a.src),
        Path(a.dst),
        mode=a.mode,
        halftone=not a.no_halftone,
        tolerance=a.tolerance,
        feather=a.feather,
    )
    flag = "GEÇTİ" if stats["ok"] else "BAŞARISIZ"
    print(
        f"{stats['path']}  {stats['size'][0]}x{stats['size'][1]}  mod={stats['mode']}  "
        f"opak %{stats['opaque_share'] * 100:.1f}  şeffaf %{stats['transparent_share'] * 100:.1f}  "
        f"kenar %{stats['edge_share'] * 100:.2f}  alfa: {flag}"
    )
    if a.strict and not stats["ok"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
