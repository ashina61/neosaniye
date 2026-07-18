import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pickMusicTrack, describeMusicTrack, loadAudioManifest } from '../src/audio/musicSelect.js';

async function withPools(fn) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'music-sel-'));
  try {
    const musicDir = path.join(tmp, 'music');
    const audioRoot = path.join(tmp, 'audio');
    await mkdir(path.join(musicDir, 'mystery'), { recursive: true });
    await mkdir(path.join(audioRoot, 'music', 'mystery'), { recursive: true });
    await mkdir(path.join(audioRoot, 'manifests'), { recursive: true });
    return await fn({ tmp, musicDir, audioRoot });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

test('lisans manifesti kapısı: manifestte olmayan kütüphane dosyası SEÇİLMEZ', async () => {
  await withPools(async ({ musicDir, audioRoot }) => {
    // Kütüphanede dosya var ama manifestte YOK → aday bile olmamalı.
    await writeFile(path.join(audioRoot, 'music', 'mystery', 'rogue.mp3'), 'x');
    await writeFile(path.join(audioRoot, 'manifests', 'audio-manifest.json'),
      JSON.stringify({ assets: [] }));
    for (let i = 0; i < 20; i += 1) {
      const t = pickMusicTrack('mystery', { musicDir, audioRoot });
      assert.ok(!t || !t.includes('rogue'), 'manifest dışı dosya seçildi!');
    }
  });
});

test('manifestteki music asset mood eşleşmesiyle seçilebilir', async () => {
  await withPools(async ({ musicDir, audioRoot }) => {
    await writeFile(path.join(audioRoot, 'music', 'mystery', 'ok-track.mp3'), 'x');
    await writeFile(path.join(audioRoot, 'manifests', 'audio-manifest.json'), JSON.stringify({
      assets: [{ id: 'src-ok-track', filename: 'music/mystery/ok-track.mp3', type: 'music', moods: ['mystery'] }],
    }));
    const t = pickMusicTrack('mystery', { musicDir, audioRoot });
    assert.ok(t && t.endsWith('ok-track.mp3'));
  });
});

test('sfx/ambience tipli manifest kaydı müzik olarak SEÇİLMEZ', async () => {
  await withPools(async ({ musicDir, audioRoot }) => {
    await writeFile(path.join(audioRoot, 'music', 'mystery', 'whoosh.mp3'), 'x');
    await writeFile(path.join(audioRoot, 'manifests', 'audio-manifest.json'), JSON.stringify({
      assets: [{ id: 'x', filename: 'music/mystery/whoosh.mp3', type: 'sfx', moods: ['mystery'] }],
    }));
    for (let i = 0; i < 10; i += 1) {
      const t = pickMusicTrack('mystery', { musicDir, audioRoot });
      assert.ok(!t || !t.includes('whoosh'));
    }
  });
});

test('son kullanılan parça alternatif varken tekrar seçilmez', async () => {
  await withPools(async ({ musicDir, audioRoot }) => {
    await writeFile(path.join(musicDir, 'mystery', 'a.mp3'), 'x');
    await writeFile(path.join(musicDir, 'mystery', 'b.mp3'), 'x');
    for (let i = 0; i < 20; i += 1) {
      const t = pickMusicTrack('mystery', { musicDir, audioRoot, avoid: ['a.mp3'], manifest: null });
      assert.ok(t.endsWith('b.mp3'), `avoid delindi: ${t}`);
    }
    // Havuz tek parçaya düşerse tekrar serbest (müzik > sessizlik).
    const only = pickMusicTrack('mystery', { musicDir, audioRoot, avoid: ['a.mp3', 'b.mp3'], manifest: null });
    assert.ok(only, 'tüm havuz avoid diye müzik tamamen kapandı');
  });
});

test('eksik dizin/dosyada çökmez, güvenli fallback (null → prosedürel yatak)', async () => {
  const t = pickMusicTrack('mystery', {
    musicDir: '/nonexistent/music-dir',
    audioRoot: '/nonexistent/audio-root',
    manifest: null,
  });
  // config.video.musicPath da yoksa null döner — çağıran prosedürel yatağa düşer.
  assert.ok(t === null || typeof t === 'string');
});

test('describeMusicTrack: manifest kaydı lisans künyesine çevrilir', async () => {
  await withPools(async ({ audioRoot }) => {
    await writeFile(path.join(audioRoot, 'manifests', 'audio-manifest.json'), JSON.stringify({
      assets: [{
        id: 'kenney-click1', filename: 'music/neutral/kenney-click1.mp3', type: 'music',
        title: 'click1', sourceRepository: 'https://github.com/Calinou/kenney-ui-audio',
        sourceCommit: 'abc123', license: 'CC0-1.0', sha256: 'deadbeef',
      }],
    }));
    const d = describeMusicTrack('/some/where/kenney-click1.mp3', audioRoot);
    assert.equal(d.assetId, 'kenney-click1');
    assert.equal(d.license, 'CC0-1.0');
    assert.equal(d.sourceCommit, 'abc123');
    // Eski havuz dosyası: künye sınırlı ama null-güvenli.
    const legacy = describeMusicTrack('/x/Marianas.mp3', audioRoot);
    assert.equal(legacy.assetId, null);
    assert.equal(legacy.file, 'Marianas.mp3');
  });
});

test('loadAudioManifest: dosya yoksa null (kütüphane devre dışı, çökme yok)', () => {
  assert.equal(loadAudioManifest('/nonexistent/root'), null);
});
