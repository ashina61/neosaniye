import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkLicenseText,
  verifySource,
  listCandidateFiles,
  probeAudio,
  sha256File,
  normalizedPcmHash,
  classifyAsset,
  energyFromLufs,
  runImport,
} from '../src/audio/importAudio.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);
const hasGit = await run('git', ['--version']).then(() => true).catch(() => false);

const CC0_TEXT = 'CC0 1.0 Universal\n\nThe person who associated a work with this deed has dedicated the work to the public domain.';

// ---- lisans doğrulama (saf) ----

test('lisans: açık CC0 kabul edilir', () => {
  assert.equal(checkLicenseText(CC0_TEXT, 'CC0-1.0').ok, true);
  assert.equal(checkLicenseText('samples placed in the public domain via the Creative Commons 0 License', 'CC0-1.0').ok, true);
});

test('lisans: CC-BY reddedilir', () => {
  const r = checkLicenseText('Licensed under Creative Commons Attribution 4.0 (CC BY 4.0)', 'CC0-1.0');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('CC-BY'));
});

test('lisans: NC/ND/GPL/all-rights reddedilir', () => {
  assert.equal(checkLicenseText('CC BY-NC 4.0 NonCommercial', 'CC0-1.0').ok, false);
  assert.equal(checkLicenseText('NoDerivatives allowed under...', 'CC0-1.0').ok, false);
  assert.equal(checkLicenseText('GNU General Public License v3', 'CC0-1.0').ok, false);
  assert.equal(checkLicenseText('Free download! All rights reserved.', 'CC0-1.0').ok, false);
});

test('lisans: belirsiz "royalty-free/free to use" reddedilir', () => {
  const r = checkLicenseText('This music is 100% royalty-free and free to use in your videos!', 'CC0-1.0');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('belirsiz'));
  assert.equal(checkLicenseText('', 'CC0-1.0').ok, false);
});

test('energyFromLufs deterministik eşikler', () => {
  assert.equal(energyFromLufs(-10), 'high');
  assert.equal(energyFromLufs(-18), 'medium');
  assert.equal(energyFromLufs(-30), 'low');
  assert.equal(energyFromLufs(null), 'medium');
});

// ---- fixture kaynak repo (yerel git; ağ YOK) ----

async function makeFixtureRepo(dir, { license = CC0_TEXT, readme = 'Licensed under CC0 1.0 Universal' } = {}) {
  await mkdir(path.join(dir, 'sounds'), { recursive: true });
  await writeFile(path.join(dir, 'LICENSE.txt'), license);
  await writeFile(path.join(dir, 'README.md'), `# Fixture\n\n${readme}\n`);
  // 1sn bip (sfx adayı) + 6sn drone (ambience adayı) + kopya (flac, near-dup).
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1',
    '-ar', '44100', path.join(dir, 'sounds', 'beep.wav')]);
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=110:duration=6',
    '-ar', '44100', path.join(dir, 'sounds', 'dark_drone_loop.wav')]);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'sounds', 'beep.wav'),
    path.join(dir, 'sounds', 'beep_copy.flac')]); // aynı PCM, farklı codec
  await writeFile(path.join(dir, 'sounds', 'broken.wav'), 'bu ses degil');
  await writeFile(path.join(dir, 'sounds', 'burp_funny.wav'), 'x'); // yasak anahtar (probe'a gelmeden reddedilir mi? sınıflandırma testi ayrı)
  await mkdir(path.join(dir, 'private'), { recursive: true });
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    path.join(dir, 'private', 'secret.wav')]);
  await run('git', ['-C', dir, 'init', '-q']);
  await run('git', ['-C', dir, 'add', '-A'], {});
  await run('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture']);
  return (await run('git', ['-C', dir, 'rev-parse', 'HEAD'])).stdout.trim();
}

function fixtureSource(repoDir, sha, over = {}) {
  return {
    id: 'fixture',
    repository: repoDir,
    commit: sha,
    allowedPaths: ['sounds'],
    rejectedPaths: ['private'],
    expectedLicense: 'CC0-1.0',
    licenseEvidence: {
      licenseFile: 'LICENSE.txt',
      licenseMustContain: 'CC0 1.0 Universal',
      readmeFile: 'README.md',
      readmeSection: 'CC0 1.0 Universal',
    },
    assetType: 'ambience',
    defaultMoods: ['dark'],
    defaultTopics: [],
    enabled: true,
    ...over,
  };
}

const RULES = {
  moodKeywords: { dark: ['dark'], space: ['drone'], neutral: ['beep'] },
  rejectKeywords: { unfit: ['burp'] },
};

test('kaynak doğrulama: CC0 fixture kabul, SHA uyuşmazlığı red', { skip: (!hasFfmpeg || !hasGit) && 'ffmpeg/git yok' }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'audio-src-'));
  try {
    const repo = path.join(tmp, 'repo');
    await mkdir(repo);
    const sha = await makeFixtureRepo(repo);
    const cache1 = path.join(tmp, 'c1');
    const ok = await verifySource(fixtureSource(repo, sha), { cacheDir: cache1 });
    assert.equal(ok.ok, true, ok.reason);

    const cache2 = path.join(tmp, 'c2');
    const bad = await verifySource(
      fixtureSource(repo, '0000000000000000000000000000000000000000'),
      { cacheDir: cache2 },
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.reason.includes('commit SHA uyuşmazlığı'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('kaynak doğrulama: CC-BY lisanslı fixture reddedilir', { skip: (!hasFfmpeg || !hasGit) && 'ffmpeg/git yok' }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'audio-ccby-'));
  try {
    const repo = path.join(tmp, 'repo');
    await mkdir(repo);
    const sha = await makeFixtureRepo(repo, {
      license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      readme: 'Licensed under CC BY 4.0',
    });
    const src = fixtureSource(repo, sha, {
      licenseEvidence: { licenseFile: 'LICENSE.txt', readmeFile: 'README.md' },
    });
    const v = await verifySource(src, { cacheDir: path.join(tmp, 'c') });
    assert.equal(v.ok, false);
    assert.ok(v.reason.includes('CC-BY'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sınıflandırma: süre + anahtar kelime kuralları, yasak içerik reddi', () => {
  const src = fixtureSource('/x', 'sha');
  const short = classifyAsset('sounds/beep.wav', { durationSeconds: 1.0 }, src, RULES);
  assert.equal(short.type, 'sfx'); // <2.5s one-shot → sfx (ambience değil)
  const amb = classifyAsset('sounds/dark_drone_loop.wav', { durationSeconds: 6 }, src, RULES);
  assert.equal(amb.type, 'ambience');
  assert.ok(amb.moods.includes('dark') && amb.moods.includes('space'));
  assert.equal(amb.loopable, true);
  const bad = classifyAsset('sounds/burp_funny.wav', { durationSeconds: 1 }, src, RULES);
  assert.equal(bad.rejected, true);
  // music tipi yalnızca assetType=music VE ≥20sn ile mümkün — sample müzik sayılmaz.
  const notMusic = classifyAsset('x/loop.wav', { durationSeconds: 30 }, { ...src, assetType: 'samples' }, RULES);
  assert.notEqual(notMusic.type, 'music');
  const music = classifyAsset('x/theme.wav', { durationSeconds: 35 }, { ...src, assetType: 'music' }, RULES);
  assert.equal(music.type, 'music');
});

test('uçtan uca import: whitelist, bozuk ses reddi, duplicate, idempotency, manifest', { skip: (!hasFfmpeg || !hasGit) && 'ffmpeg/git yok' }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'audio-e2e-'));
  try {
    const repo = path.join(tmp, 'repo');
    await mkdir(repo);
    const sha = await makeFixtureRepo(repo);
    const outRoot = path.join(tmp, 'out');
    const cfgPath = path.join(tmp, 'sources.json');
    await writeFile(cfgPath, JSON.stringify({
      sources: [fixtureSource(repo, sha)],
      ...RULES,
    }));

    const r1 = await runImport({ configPath: cfgPath, outRoot, cacheDir: path.join(tmp, 'c1') });
    const ids = r1.summary.accepted.map((a) => a.id).sort();
    // beep (sfx) + drone (ambience) kabul; beep_copy near-dup RED; broken RED; burp RED.
    assert.deepEqual(ids, ['fixture-beep', 'fixture-dark-drone-loop']);
    assert.ok(r1.rejected.rejected.some((x) => x.reason.includes('near-duplicate')));
    assert.ok(r1.rejected.rejected.some((x) => x.path === 'sounds/broken.wav'));
    assert.ok(r1.rejected.rejected.some((x) => x.reason.includes('burp')));
    // whitelist: private/secret.wav asla taranmaz.
    assert.ok(!r1.summary.accepted.some((a) => a.sourcePath.includes('secret')));
    assert.ok(!r1.rejected.rejected.some((x) => String(x.path).includes('secret')));

    // Manifest şeması + secret alan taraması.
    const manifest = JSON.parse(await readFile(path.join(outRoot, 'manifests', 'audio-manifest.json'), 'utf8'));
    assert.equal(manifest.assets.length, 2);
    for (const a of manifest.assets) {
      for (const k of ['id', 'filename', 'title', 'sourceRepository', 'sourceCommit', 'sourcePath',
        'license', 'licenseEvidence', 'sha256', 'durationSeconds', 'sampleRate', 'channels',
        'type', 'moods', 'energy', 'loopable', 'attributionRequired']) {
        assert.ok(k in a, `manifest alanı eksik: ${k}`);
      }
      assert.equal(a.license, 'CC0-1.0');
      assert.equal(a.attributionRequired, false);
      assert.ok(existsSync(path.join(outRoot, a.filename)), 'optimize kopya diskte yok');
      const flat = Object.keys(a).join(' ').toLowerCase();
      for (const banned of ['token', 'secret', 'password', 'apikey']) {
        assert.ok(!flat.includes(banned), `manifest'te yasak alan adı: ${banned}`);
      }
    }
    // Optimize kopya 48k stereo mp3 olmalı.
    const p = await probeAudio(path.join(outRoot, manifest.assets[0].filename));
    assert.equal(p.sampleRate, 48000);
    assert.equal(p.channels, 2);

    // IDEMPOTENT: ikinci çalıştırma hiçbir şey eklemez.
    const r2 = await runImport({ configPath: cfgPath, outRoot, cacheDir: path.join(tmp, 'c2') });
    assert.equal(r2.summary.accepted.length, 0);
    assert.equal(r2.summary.skippedDuplicate, 2);
    const manifest2 = JSON.parse(await readFile(path.join(outRoot, 'manifests', 'audio-manifest.json'), 'utf8'));
    assert.equal(manifest2.assets.length, 2);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('normalizedPcmHash: aynı kayıt farklı codec/kapta yakalanır', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'audio-pcm-'));
  try {
    const wav = path.join(tmp, 'a.wav');
    const flac = path.join(tmp, 'a.flac');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '22050', '-ac', '1', wav]);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', wav, flac]); // lossless kopya
    assert.notEqual(await sha256File(wav), await sha256File(flac)); // bayt farklı
    assert.equal(await normalizedPcmHash(wav), await normalizedPcmHash(flac)); // PCM aynı
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('listCandidateFiles yalnızca whitelist içini görür', { skip: (!hasFfmpeg || !hasGit) && 'ffmpeg/git yok' }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'audio-list-'));
  try {
    const repo = path.join(tmp, 'repo');
    await mkdir(repo);
    await makeFixtureRepo(repo);
    const files = await listCandidateFiles(repo, ['sounds']);
    assert.ok(files.every((f) => f.startsWith('sounds/')));
    assert.ok(!files.some((f) => f.includes('private')));
    const none = await listCandidateFiles(repo, []);
    assert.equal(none.length, 0);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
