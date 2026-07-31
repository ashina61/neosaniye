"""
ÖZNE SEGMENTASYONU — kesmeyi modelden istemeyi bırak, kendin kes.

============ NEDEN BU DOSYA VAR ============

Beş turdur parça promtu modele "BACKGROUND: blank flat white, completely
empty" diyor. 5. turun ÖLÇÜMÜ (a83d56d ile koşan run, hepsi Pollinations/FLUX):

    01-cold_open-a.png   kenar-beyaz %0.0
    01-cold_open-b.png   kenar-beyaz %0.0
    01-cold_open-plate   kenar-beyaz %0.0
    02-fact-a.png        kenar-beyaz %0.0
    02-fact-plate.png    kenar-beyaz %0.0

Beş görselin beşinde de dış çerçevenin %4'lük şeridinde tek beyaz piksel yok.
Aynı turda büyük harfle yazılmış iki talimat daha yok sayıldı: plakada
"ABSOLUTELY NO WRITING OF ANY KIND" (plaka uydurma manşetle geldi) ve portrede
"A black censor bar runs across the eyes" (bar yok).

Üç açık talimat, aynı model, aynı tur, üçü de tutmadı. Bu bir promt hatası
değil. Pollinations'ın bedava ucu schnell sınıfı bir FLUX: 4 adım, guidance
damıtılmış. O sınıfta OLUMSUZ talimatın yönlendirme gücü pratikte sıfırdır —
"no X" cümlesi modeli X'ten uzaklaştırmaz. Altıncı turda promta daha çok
büyük harf eklemek altıncı kez aynı duvara çarpmak olurdu.

============ ÇÖZÜM: İŞİ MODELDEN AL ============

Model yaşlanmış bir arşiv sayfası çizmeyi SEVİYOR ve o sayfa malzeme olarak
tam da istediğimiz şey. Onunla kavga etmek yerine bırakalım çizsin, özneyi
BİZ kesip alalım. `isnet-general-use` (rembg) tam bunu yapıyor.

5. turun görselleri üstünde ÖLÇÜLDÜ:

    02-fact-a.png      kaplama %36.8  → çerçeveli sayfadan kişi temiz kalktı
    01-cold_open-a.png kaplama %17.8  → duvara asılı çerçeveden kişi kalktı
    01-cold_open-b.png kaplama %62.9  → yırtık harita parçası kendi düzensiz
                                        kenarıyla kalktı (elle kesilmiş kağıt)

Model 179 MB ve GitHub releases'ten iniyor; bu depodan erişilebilen iki
hosttan biri (Google + GitHub). Ağ yoksa ya da onnxruntime kurulu değilse
`available()` False döner ve `cutout.py` eski `matte` moduna düşer —
AGENTS.md'nin "eksik sağlayıcı atlanır, bir sonrakine düşülür" kuralı.
"""

from __future__ import annotations

import os
from functools import lru_cache

import numpy as np

MODEL = os.environ.get("NEOSANIYE_SEG_MODEL", "isnet-general-use")


class SegmentError(RuntimeError):
    pass


def available() -> bool:
    """rembg + onnxruntime kurulu mu? Model indirmeyi DENEMEZ, sadece importu ölçer."""
    try:
        import rembg  # noqa: F401
    except Exception:
        return False
    return True


@lru_cache(maxsize=2)
def _session(name: str):
    try:
        from rembg import new_session
    except Exception as exc:  # pragma: no cover - ortam bağımlı
        raise SegmentError(f"rembg yok: {exc}") from exc
    try:
        return new_session(name)
    except Exception as exc:  # pragma: no cover - ağ bağımlı
        raise SegmentError(f"segmentasyon modeli yüklenemedi ({name}): {exc}") from exc


def segment_alpha(rgb: np.ndarray, model: str | None = None) -> np.ndarray:
    """
    RGB dizisinden 0..1 alfa üret. Girdinin zemini NE OLURSA OLSUN çalışır —
    beyaz zemin şartı yok, çünkü ölçüldü ki model beyaz zemin vermiyor.
    """
    from PIL import Image
    from rembg import remove

    sess = _session(model or MODEL)
    out = remove(Image.fromarray(rgb.astype(np.uint8), mode="RGB"), session=sess)
    return np.asarray(out)[:, :, 3].astype(np.float32) / 255.0


def drop_halo(rgb: np.ndarray, alpha: np.ndarray, white_point: int = 244) -> np.ndarray:
    """
    KENARDA KALAN BEYAZ HALEYİ AT.

    ÖLÇÜLDÜ: 02-fact-a'nın segmentinde öznenin sağında, yırtık kağıt kenarından
    kalan beyaz bir şerit vardı. Segmentasyon onu "özneye ait" saydı çünkü
    fotoğrafın parçasıydı; bizim için o kağıt, özne değil.

    Kural dar tutuldu: SADECE neredeyse saf beyaz (>=244 üç kanalda birden) ve
    doygunluğu yok sayılacak kadar düşük pikseller düşürülür. Yaşlanmış kağıdın
    kendisi (ölçülen kenar ortalaması RGB 213/193/160) bu eşiğin çok altında,
    yani harita parçası gibi meşru kağıt öğeler korunur.
    """
    f = rgb.astype(np.float32)
    near_white = (f.min(axis=2) >= white_point) & ((f.max(axis=2) - f.min(axis=2)) <= 8)
    return np.where(near_white, 0.0, alpha).astype(np.float32)
