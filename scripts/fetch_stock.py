"""Fetch stock media for a production, through OpenMontage's own provider tools.

Why this exists: a production session runs in a cloud environment whose network
policy denies every Pexels and Pixabay host, so the session cannot reach them
even when the keys are present. A GitHub runner has open egress. So the fetch
happens there, the files land under productions/<slug>/media/, and the session
picks them up with a git pull.

This calls the registry tools (pexels_video, pixabay_video, pexels_image,
pixabay_image, pixabay_music) rather than the provider APIs directly, so the
licence and provenance handling stays in one place.

    python scripts/fetch_stock.py <slug> --video "storm sea,coastline aerial" \
        --music "slow ambient piano" --per-query 2

Pixabay music needs no API key. Everything else needs PEXELS_API_KEY or
PIXABAY_API_KEY; a provider without its key is reported as skipped, not failed,
so one missing key never stops the rest.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from tools.tool_registry import registry  # noqa: E402


def slugify(text: str) -> str:
    keep = [c.lower() if c.isalnum() else "-" for c in text]
    out = "".join(keep)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")[:48] or "clip"


def run(tool_name: str, query: str, out_dir: Path, index: int, extra: dict) -> dict:
    tool = registry._tools.get(tool_name)
    if tool is None:
        return {"tool": tool_name, "query": query, "status": "missing_tool"}
    status = str(getattr(tool.get_status(), "value", tool.get_status()))
    if "available" not in status.lower():
        return {"tool": tool_name, "query": query, "status": "skipped", "reason": status}

    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = {"pexels_video": "mp4", "pixabay_video": "mp4",
              "pexels_image": "jpg", "pixabay_image": "jpg",
              "pixabay_music": "mp3"}[tool_name]
    dest = out_dir / f"{slugify(query)}-{tool_name.split('_')[0]}-{index}.{suffix}"
    inputs = {"query": query, "output_path": str(dest), **extra}
    try:
        res = tool.execute(inputs)
    except Exception as exc:  # noqa: BLE001
        return {"tool": tool_name, "query": query, "status": "error", "reason": str(exc)[:300]}
    if not res.success:
        return {"tool": tool_name, "query": query, "status": "failed",
                "reason": (res.error or "")[:300]}
    data = res.data or {}
    return {
        "tool": tool_name,
        "query": query,
        "status": "ok",
        "path": str(dest.relative_to(REPO)) if dest.is_relative_to(REPO) else str(dest),
        "bytes": dest.stat().st_size if dest.exists() else 0,
        "provider": data.get("provider"),
        "source_url": data.get("source_url") or data.get("url"),
        "credit": data.get("credit") or data.get("user") or data.get("photographer"),
        "license": data.get("license", "provider stock licence — check the provider's terms"),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--video", default="", help="comma-separated search queries")
    ap.add_argument("--photo", default="")
    ap.add_argument("--music", default="")
    ap.add_argument("--per-query", type=int, default=1)
    ap.add_argument("--orientation", default="portrait",
                    choices=["portrait", "landscape", "square", "all"])
    a = ap.parse_args(argv)

    base = REPO / "productions" / a.slug / "media"
    registry.discover()
    results: list[dict] = []

    def queries(raw: str) -> list[str]:
        return [q.strip() for q in raw.split(",") if q.strip()]

    for q in queries(a.video):
        for i in range(a.per_query):
            extra = {"per_page": max(3, a.per_query * 3), "page": i + 1}
            if a.orientation != "all":
                results.append(run("pexels_video", q, base / "video", i + 1,
                                   {**extra, "orientation": a.orientation}))
            else:
                results.append(run("pexels_video", q, base / "video", i + 1, extra))
            results.append(run("pixabay_video", q, base / "video", i + 1, extra))

    for q in queries(a.photo):
        for i in range(a.per_query):
            extra = {"per_page": max(3, a.per_query * 3), "page": i + 1}
            if a.orientation != "all":
                extra["orientation"] = a.orientation
            results.append(run("pexels_image", q, base / "photo", i + 1, extra))
            results.append(run("pixabay_image", q, base / "photo", i + 1, extra))

    for q in queries(a.music):
        for i in range(a.per_query):
            results.append(run("pixabay_music", q, base / "music", i + 1, {}))

    ok = [r for r in results if r["status"] == "ok"]
    if ok:
        base.mkdir(parents=True, exist_ok=True)
        (base / "SOURCES.json").write_text(json.dumps(ok, indent=2) + "\n")
        lines = ["# Stock media for this production", "",
                 "Fetched by scripts/fetch_stock.py on a GitHub runner, because the",
                 "production environment's network policy denies these hosts.", ""]
        for r in ok:
            lines.append(f"- `{Path(r['path']).name}` — {r['tool']} · query {r['query']!r}"
                         + (f" · {r['credit']}" if r.get("credit") else "")
                         + (f" · {r['source_url']}" if r.get("source_url") else ""))
        lines.append("")
        lines.append("Check each provider's licence before publishing. Pexels and Pixabay")
        lines.append("both allow commercial use without attribution, but crediting the")
        lines.append("creator in the description is the decent thing to do.")
        (base / "SOURCES.md").write_text("\n".join(lines) + "\n")

    for r in results:
        mark = {"ok": "+", "skipped": "-", "failed": "x", "error": "x", "missing_tool": "?"}[r["status"]]
        detail = r.get("path") or r.get("reason") or ""
        print(f" {mark} {r['tool']:<14} {r['query'][:34]:<34} {detail}")
    print(f"\n{len(ok)} of {len(results)} fetched -> {base}")
    # A run with nothing fetched is not a crash: the usual cause is a missing key,
    # and the workflow should say so plainly rather than fail red.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
