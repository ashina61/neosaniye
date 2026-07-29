#!/usr/bin/env python3
"""
RENDER DOĞRULAMA

Referans videoya (Wayfinder) uygulanan ölçümlerin aynısını bizim çıktımıza
uygular. Amaç iddiaları kanıtlamak ya da çürütmek; "güzel oldu" demek değil.

Ölçülenler:
  1. KOMPOZİSYON KİLİDİ  — sahne içinde kaç piksel hiç değişmiyor?
                            Referansta arka plan/metin/ok tamamen sabitti.
  2. STOP-MOTION KADANSI — 30fps çıktıda kaç ayrı kare var? 12fps olmalı.
  3. KAMERA SABİTLİĞİ    — küresel kayma var mı? Olmamalı.
  4. AKSAN DİSİPLİNİ     — altın, karenin %8'inden fazlasını kaplamamalı
                            (referansta ölçülen: %3.6).
  5. GÜVENLİ ALAN        — Shorts arayüzünün yediği kenarlarda içerik var mı?
  6. KESME SAYISI        — storyboard'daki sahne sayısıyla eşleşiyor mu?

Kullanım: python3 pipeline/verify-render.py out/test.mp4 [content/storyboard.json]
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

FPS = 30
ACCENT = (0xD2, 0xA0, 0x3C)
ACCENT_MAX_SHARE = 0.08
SAFE = {"top": 150, "bottom": 330, "left": 70, "right": 150}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def probe(path):
    r = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames",
        "-count_frames", "-of", "json", str(path),
    ])
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return {
        "width": s["width"],
        "height": s["height"],
        "fps": float(num) / float(den),
        "frames": int(s.get("nb_read_frames", 0)),
    }


def extract(path, outdir, start, count, scale=None):
    """start saniyesinden itibaren count kare çıkar (PNG, kayıpsız)."""
    vf = f"scale={scale}:-1" if scale else "null"
    run([
        "ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path),
        "-frames:v", str(count), "-vf", vf, "-start_number", "0",
        str(Path(outdir) / "f_%04d.png"), "-y",
    ])
    return sorted(Path(outdir).glob("f_*.png"))


def load(paths):
    return [np.asarray(Image.open(p).convert("RGB")).astype(np.int16) for p in paths]


# ---------------------------------------------------------------- 1 + 3
def composition_lock(frames, tol=6):
    """
    Sahne içinde ilk ve son kare arasında değişmeyen piksel oranı.
    Referansta ölçülen davranış: arka plan, metin, kart, ok TAMAMEN sabit;
    yalnızca bir iki cutout kayıyor. Yüksek oran = kompozisyon kilitli.
    """
    a, b = frames[0], frames[-1]
    d = np.abs(a - b).max(axis=2)
    still = float((d <= tol).mean())
    moving = float((d > 40).mean())
    return still, moving


def camera_locked(frames, tol=6):
    """
    Küresel kayma testi: son kareyi ±1..4 px kaydırıp ilk kareyle karşılaştır.
    En iyi eşleşme kaydırmasız (0,0) ise kamera sabittir. Bir kaydırma daha iyi
    eşleşiyorsa kare kaymış demektir.
    """
    a, b = frames[0], frames[-1]
    h, w, _ = a.shape
    m = 6
    best = None
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            bb = b[m + dy : h - m + dy, m + dx : w - m + dx]
            aa = a[m : h - m, m : w - m]
            err = float(np.abs(aa - bb).mean())
            if best is None or err < best[0]:
                best = (err, dx, dy)
    return best[1] == 0 and best[2] == 0, best


# ---------------------------------------------------------------- 2
def stepped_cadence(frames, tol=2.0):
    """
    Ardışık kareler arası ortalama farkı ölç; fark eşiğin altındaysa "tutulan
    kare" say. 12fps adımda 30fps çıktıda tutma deseni 3,2,3,2… olur, yani
    karelerin yaklaşık %60'ı öncekiyle aynıdır.

    NOT: mp4 sıkıştırması düz zeminde her karede gürültü bırakır, o yüzden
    md5 karşılaştırması işe yaramaz — eşikli fark kullanılıyor.
    """
    held = 0
    diffs = []
    for i in range(1, len(frames)):
        d = float(np.abs(frames[i] - frames[i - 1]).mean())
        diffs.append(d)
        if d < tol:
            held += 1
    return {
        "held_ratio": round(held / max(len(frames) - 1, 1), 3),
        "mean_diff": round(float(np.mean(diffs)), 3) if diffs else 0.0,
    }


# ---------------------------------------------------------------- 4
def accent_share(frame):
    """Altın aksanın kapladığı piksel oranı."""
    d = np.abs(frame - np.array(ACCENT)).sum(axis=2)
    return float((d < 90).mean())


# ---------------------------------------------------------------- 5
def safe_area_clean(frame, ink_tol=110):
    """
    Güvenli alanın dışında koyu/kontrastlı içerik var mı? Zemin kremdir
    (#E4E4D8); kenar bantlarında ondan belirgin sapma = taşan içerik.
    Zemin dokusu ve vinyet sapma sayılmaz, o yüzden eşik gevşek.
    """
    h, w, _ = frame.shape
    g = frame.mean(axis=2)
    ground = float(np.median(g))
    bands = {
        "top": g[: SAFE["top"], :],
        "bottom": g[h - SAFE["bottom"] :, :],
        "left": g[:, : SAFE["left"]],
        "right": g[:, w - SAFE["right"] :],
    }
    out = {}
    for k, band in bands.items():
        out[k] = round(float((np.abs(band - ground) > ink_tol).mean()), 4)
    return out


# ---------------------------------------------------------------- 6
def cut_times(path, threshold=0.30):
    r = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-filter:v", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-",
    ])
    times = []
    for line in r.stderr.splitlines():
        if "pts_time:" in line:
            try:
                times.append(float(line.split("pts_time:")[1].split()[0]))
            except (IndexError, ValueError):
                pass
    return times


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    video = Path(sys.argv[1])
    sb_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("content/storyboard.json")
    if not video.exists():
        print(f"video yok: {video}")
        sys.exit(1)

    info = probe(video)
    sb = json.loads(sb_path.read_text()) if sb_path.exists() else None

    print("=" * 66)
    print("RENDER DOĞRULAMA")
    print("=" * 66)
    print(f"dosya      : {video}  ({video.stat().st_size / 1e6:.1f} MB)")
    print(f"çözünürlük : {info['width']}x{info['height']}  {info['fps']:.0f} fps  {info['frames']} kare")
    dur = info["frames"] / info["fps"] if info["fps"] else 0
    print(f"süre       : {dur:.1f} s")

    ok = True

    # 9:16 kontrolü
    is_vertical = info["width"] == 1080 and info["height"] == 1920
    print(f"\n[FORMAT] 1080x1920 (9:16) : {'GEÇTİ' if is_vertical else 'BAŞARISIZ'}")
    ok &= is_vertical

    # Sahne sınırlarını storyboard'dan hesapla; sahne ortalarını örnekle.
    scene_windows = []
    if sb:
        t = 0.0
        for s in sb["scenes"]:
            d = s["durationInFrames"] / FPS
            scene_windows.append((s["template"], t, d))
            t += d

    with tempfile.TemporaryDirectory() as td:
        # ---- 2. kadans: tek sahnenin ortasından 40 kare
        mid_start = (scene_windows[3][1] + 0.4) if len(scene_windows) > 3 else dur * 0.4
        d1 = Path(td) / "cad"
        d1.mkdir()
        cad = load(extract(video, d1, mid_start, 40, scale=360))
        st = stepped_cadence(cad)
        # 12fps: her 2-3 karede bir değişim → tutulanların payı ~%55-70
        cadence_ok = 0.40 <= st["held_ratio"] <= 0.80
        print(f"\n[KADANS] tutulan kare payı: %{st['held_ratio'] * 100:.0f}  (12fps için beklenen %40-80)")
        print(f"         ortalama ardışık fark: {st['mean_diff']}")
        print(f"         12fps stop-motion    : {'GEÇTİ' if cadence_ok else 'BAŞARISIZ'}")
        ok &= cadence_ok

        # ---- 1 + 3: her sahnenin başı ve sonu
        print(f"\n[KOMPOZİSYON KİLİDİ] sahne başına sabit piksel oranı")
        print(f"{'#':>3} {'şablon':<18} {'sabit':>7} {'oynayan':>8} {'kamera':>8}")
        stills = []
        cam_fails = []
        for i, (tpl, start, d) in enumerate(scene_windows):
            if d < 1.0:
                continue
            sd = Path(td) / f"s{i}"
            sd.mkdir()
            # Giriş animasyonu bittikten sonrasını ölç: build-on zaten değişim
            # üretiyor, ölçmek istediğimiz şey YERLEŞTİKTEN SONRAKİ kilit.
            fr = load(extract(video, sd, start + d * 0.55, 2, scale=360))
            if len(fr) < 2:
                continue
            # Aynı sahnenin sonuna yakın ikinci örnek
            fr2 = load(extract(video, sd, start + d * 0.92, 1, scale=360))
            pair = [fr[0], fr2[0]] if fr2 else fr
            still, moving = composition_lock(pair)
            locked, best = camera_locked(pair)
            stills.append(still)
            if not locked:
                cam_fails.append((i, tpl, best))
            print(f"{i + 1:>3} {tpl:<18} %{still * 100:5.1f} %{moving * 100:6.1f} {'sabit' if locked else 'KAYDI':>8}")

        mean_still = float(np.mean(stills)) if stills else 0
        lock_ok = mean_still >= 0.80
        print(f"\n         ortalama sabit piksel: %{mean_still * 100:.1f}  (referans davranışı: yüksek)")
        print(f"         kompozisyon kilidi   : {'GEÇTİ' if lock_ok else 'BAŞARISIZ'}")
        print(f"         kamera sabitliği     : {'GEÇTİ' if not cam_fails else f'BAŞARISIZ ({len(cam_fails)} sahne)'}")
        ok &= lock_ok and not cam_fails

        # ---- 4 + 5: sahne ortalarından birer kare
        print(f"\n[AKSAN + GÜVENLİ ALAN]")
        acc = []
        bad_safe = []
        for i, (tpl, start, d) in enumerate(scene_windows):
            sd = Path(td) / f"a{i}"
            sd.mkdir()
            fr = load(extract(video, sd, start + d * 0.8, 1))
            if not fr:
                continue
            a = accent_share(fr[0])
            acc.append((i, tpl, a))
            sa = safe_area_clean(fr[0])
            worst = max(sa.values())
            if worst > 0.06:
                bad_safe.append((i, tpl, sa))
        over = [(i, t, a) for i, t, a in acc if a > ACCENT_MAX_SHARE]
        mean_acc = float(np.mean([a for _, _, a in acc])) if acc else 0
        print(f"         ortalama aksan payı  : %{mean_acc * 100:.2f}  (referans %3.6, tavan %{ACCENT_MAX_SHARE * 100:.0f})")
        if over:
            for i, t, a in over:
                print(f"           ← sahne {i + 1} ({t}) aksan %{a * 100:.1f}")
        print(f"         aksan disiplini      : {'GEÇTİ' if not over else f'BAŞARISIZ ({len(over)} sahne)'}")
        if bad_safe:
            for i, t, sa in bad_safe[:6]:
                worst_k = max(sa, key=sa.get)
                print(f"           ← sahne {i + 1} ({t}) {worst_k} bandında %{sa[worst_k] * 100:.1f} içerik")
        print(f"         güvenli alan         : {'GEÇTİ' if not bad_safe else f'BAŞARISIZ ({len(bad_safe)} sahne)'}")
        ok &= not over and not bad_safe

    # ---- 6. kesmeler
    cuts = cut_times(video)
    expected = len(scene_windows) - 1 if scene_windows else 0
    print(f"\n[KESME] tespit edilen: {len(cuts)}   storyboard sahnesi: {len(scene_windows)} (beklenen kesme ~{expected})")
    # Sahne geçişleri sert kesme olduğu için tespit oranı yüksek olmalı.
    cut_ok = expected == 0 or len(cuts) >= expected * 0.6
    print(f"        sahneler kesmeyle ayrılıyor: {'GEÇTİ' if cut_ok else 'BAŞARISIZ'}")
    ok &= cut_ok

    print("\n" + "=" * 66)
    print(f"SONUÇ: {'TÜM ÖLÇÜMLER GEÇTİ' if ok else 'BAŞARISIZ ÖLÇÜM VAR'}")
    print("=" * 66)
    sys.exit(0 if ok else 2)


if __name__ == "__main__":
    main()
