#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPO="https://github.com/ashina61/neosaniye-remotion-lab.git"
SOURCE_SHA="1661e9707103096d81e95531cb8ff098fb8fdaf9"
TARGET_BRANCH="agent/clean-eiffel-rebuild"
SOURCE_DIR="/tmp/neosaniye-eiffel-source"

rm -rf "$SOURCE_DIR"
git clone --no-checkout "$SOURCE_REPO" "$SOURCE_DIR"
git -C "$SOURCE_DIR" checkout "$SOURCE_SHA"
test "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$SOURCE_SHA"

# The rebuild is intentionally destructive. The legacy repository is preserved
# on backup/legacy-factory-before-eiffel-rebuild.
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

install -D "$SOURCE_DIR/src/index.ts" src/index.ts
install -D "$SOURCE_DIR/src/shorts/EiffelTowerShort.tsx" src/shorts/EiffelTowerShort.tsx
install -D "$SOURCE_DIR/src/shorts/CollageKit.tsx" src/shorts/CollageKit.tsx
install -D "$SOURCE_DIR/src/engine/FilmTreatment.tsx" src/engine/FilmTreatment.tsx
install -D "$SOURCE_DIR/src/engine/motion.ts" src/engine/motion.ts
install -D "$SOURCE_DIR/scripts/generate-eiffel-audio.py" scripts/generate-eiffel-audio.py
install -D "$SOURCE_DIR/tsconfig.json" tsconfig.json

cat > .gitignore <<'EOF'
node_modules/
out/
public/audio/
.DS_Store
EOF

python - <<'PY'
from pathlib import Path
path = Path('src/shorts/CollageKit.tsx')
text = path.read_text()
start = text.find('export const CaptionStrip')
end = text.find('export const Sparkles', start)
if start >= 0 and end > start:
    text = text[:start] + text[end:]
path.write_text(text)
PY

cat > src/Root.tsx <<'EOF'
import React from 'react';
import {Composition} from 'remotion';
import {EIFFEL_SHORT_DURATION, EiffelTowerShort} from './shorts/EiffelTowerShort';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NeoSaniyeEiffelTower"
    component={EiffelTowerShort}
    durationInFrames={EIFFEL_SHORT_DURATION}
    fps={30}
    width={1080}
    height={1920}
  />
);
EOF

cat > package.json <<'EOF'
{
  "name": "neosaniye-premium-motion-factory",
  "version": "1.0.0",
  "private": true,
  "description": "NeoSaniye procedural Remotion motion-graphics factory",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "audio": "python scripts/generate-eiffel-audio.py",
    "typecheck": "tsc --noEmit",
    "render": "remotion render src/index.ts NeoSaniyeEiffelTower out/neosaniye-eiffel-tower.mp4 --codec=h264 --crf=17 --pixel-format=yuv420p"
  },
  "dependencies": {
    "@remotion/cli": "4.0.499",
    "remotion": "4.0.499",
    "react": "19.1.1",
    "react-dom": "19.1.1"
  },
  "devDependencies": {
    "@types/react": "19.1.10",
    "@types/react-dom": "19.1.7",
    "typescript": "5.9.2"
  }
}
EOF

cat > README.md <<'EOF'
# NeoSaniye Premium Motion Factory

Onaylanan Eyfel videosunun kaynak kodundan kurulmuş temiz Remotion deposu.

- Konuşmayı tekrar eden video içi altyazı yok.
- Caption veya karaoke şeridi yok.
- Stock, Pexels, Pixabay ve AI görsel üretimi yok.
- Bütün görsel katmanlar React, CSS ve SVG ile çizilir.
- İngilizce anlatım, müzik ve katmanlı SFX bulunur.
- Çıktı: 1080x1920, 30 FPS, H.264/AAC.

Eski sistem yalnız `backup/legacy-factory-before-eiffel-rebuild` dalında saklanır.
EOF

mkdir -p .github/workflows
cat > .github/workflows/validate.yml <<'EOF'
name: Validate NeoSaniye Premium Motion Factory

on:
  workflow_dispatch:
  push:
    branches:
      - agent/clean-eiffel-rebuild
      - claude/youtube-shorts-automation-9dbrjx
  pull_request:

permissions:
  contents: read

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install tools
        run: |
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends ffmpeg
          npm install --no-audit --no-fund
          python -m pip install --disable-pip-version-check edge-tts==7.2.7 mutagen==1.47.0
      - name: Enforce clean procedural-only source
        run: |
          test "$(find src -type f | wc -l)" -eq 6
          if grep -RniE 'CaptionStrip|subtitle|karaoke|generateImages|Pexels|Pixabay|OffthreadVideo|<Img|<video' src package.json; then
            exit 1
          fi
      - name: Generate audio
        run: npm run audio
      - name: Typecheck
        run: npm run typecheck
      - name: Render
        run: npm run render
      - name: Validate streams
        run: |
          test -s out/neosaniye-eiffel-tower.mp4
          ffprobe -v error -show_entries stream=codec_name,width,height,channels -show_entries format=duration -of json out/neosaniye-eiffel-tower.mp4 | tee out/ffprobe.json
          python - <<'PY'
          import json
          data=json.load(open('out/ffprobe.json'))
          streams=data['streams']
          video=next(s for s in streams if s.get('width'))
          audio=next(s for s in streams if s.get('channels'))
          duration=float(data['format']['duration'])
          assert video['codec_name']=='h264'
          assert (video['width'], video['height']) == (1080, 1920)
          assert audio
          assert 43.5 <= duration <= 44.5
          PY
      - uses: actions/upload-artifact@v4
        with:
          name: neosaniye-approved-eiffel-engine
          path: |
            out/neosaniye-eiffel-tower.mp4
            out/ffprobe.json
          if-no-files-found: error
          retention-days: 7
EOF

# Hard policy: no legacy code and exactly the six required source files.
test "$(find src -type f | wc -l)" -eq 6
if grep -RniE 'CaptionStrip|subtitle|karaoke|generateImages|Pexels|Pixabay|OffthreadVideo|<Img|<video' src package.json; then
  echo 'Forbidden legacy media/subtitle implementation survived'
  exit 1
fi

npm install --no-audit --no-fund
python -m pip install --disable-pip-version-check edge-tts==7.2.7 mutagen==1.47.0
npm run audio
npm run typecheck
npm run render
test -s out/neosaniye-eiffel-tower.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,channels -show_entries format=duration -of json out/neosaniye-eiffel-tower.mp4 | tee out/ffprobe.json

rm -rf node_modules out public/audio

git config user.name "neosaniye-clean-rebuild"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "refactor: replace legacy repository with approved Eiffel motion engine"
git push origin "HEAD:${TARGET_BRANCH}"
