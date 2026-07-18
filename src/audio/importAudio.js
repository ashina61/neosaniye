import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const run = promisify(execFile);
const BUF = { maxBuffer: 64 * 1024 * 1024 };

/**
 * CC0/PUBLIC DOMAIN SES İTHALAT SİSTEMİ.
 *
 * İlkeler:
 *  - Kaynaklar config/audio-sources.json'da SABİT commit SHA ile kilitlidir;
 *    branch adıyla indirme yok — kaynak sonradan değişse bile kütüphane değişmez.
 *  - Yalnızca açık CC0 1.0 / Public Domain kanıtı doğrulanan kaynak kabul edilir.
 *    CC-BY / SA / NC / ND / GPL / belirsiz lisans → RED (rejected-assets.json).
 *  - Whitelist (allowedPaths) dışındaki hiçbir dosya taranmaz.
 *  - Kaynak dosya değiştirilmez; optimize kopya assets/audio/ altına üretilir.
 *  - Idempotent: aynı kaynak dosya (sha256) ikinci kez eklenmez.
 */

// ---- lisans doğrulama (saf) ----

const CC0_ACCEPT = /CC0 1\.0|Creative Commons 0|Creative Commons Zero|publicdomain\/zero|placed in the public domain|dedicated to the public domain/i;
const LICENSE_REJECT = [
  [/\bCC[- ]BY\b|Creative Commons Attribution|\bAttribution[- ](ShareAlike|NonCommercial|NoDerivs)/i, 'CC-BY ailesi (atıf şartlı) lisans'],
  [/NonCommercial|\bCC[- ]?NC\b/i, 'NonCommercial (NC) kısıtı'],
  [/NoDeriv/i, 'NoDerivatives (ND) kısıtı'],
  [/GNU General Public License|\bGPLv?\d?\b/i, 'GPL lisansı'],
  [/All rights reserved/i, 'tüm hakları saklı ibaresi'],
];

/**
 * Lisans metnini doğrular. Açık CC0/PD kanıtı yoksa veya kısıtlı lisans
 * işareti varsa reddeder. "Royalty-free"/"free to use" tek başına KANIT DEĞİLDİR.
 */
export function checkLicenseText(text, expectedLicense = 'CC0-1.0') {
  const t = String(text || '');
  if (!t.trim()) return { ok: false, reason: 'lisans metni boş/eksik' };
  for (const [re, why] of LICENSE_REJECT) {
    if (re.test(t)) return { ok: false, reason: `kısıtlı lisans işareti: ${why}` };
  }
  if (expectedLicense === 'CC0-1.0' || expectedLicense === 'Public-Domain') {
    if (CC0_ACCEPT.test(t)) return { ok: true, reason: 'CC0/Public Domain beyanı doğrulandı' };
    return { ok: false, reason: 'açık CC0/Public Domain beyanı bulunamadı (belirsiz lisans)' };
  }
  return { ok: false, reason: `desteklenmeyen beklenen lisans: ${expectedLicense}` };
}

// ---- kaynak doğrulama ----

/**
 * Kaynağı geçici dizine klonlar (depth 1), HEAD'in pinlenen commit ile
 * eşleştiğini ve lisans kanıtlarını doğrular. Uyuşmazlık → kaynak REDDEDİLİR.
 */
export async function verifySource(source, { cacheDir }) {
  const dir = path.join(cacheDir, source.id);
  if (!existsSync(path.join(dir, '.git'))) {
    await mkdir(cacheDir, { recursive: true });
    await run('git', ['clone', '--quiet', '--depth', '1', source.repository, dir], BUF);
  }
  let head = (await run('git', ['-C', dir, 'rev-parse', 'HEAD'])).stdout.trim();
  if (head !== source.commit) {
    // Uç ilerlemiş olabilir; pinlenen commit'i özel olarak getirip dene.
    const fetched = await run('git', ['-C', dir, 'fetch', '--quiet', '--depth', '1', 'origin', source.commit], BUF)
      .then(() => true).catch(() => false);
    if (fetched) {
      await run('git', ['-C', dir, 'checkout', '--quiet', source.commit], BUF).catch(() => {});
      head = (await run('git', ['-C', dir, 'rev-parse', 'HEAD'])).stdout.trim();
    }
  }
  if (head !== source.commit) {
    return { ok: false, dir, reason: `commit SHA uyuşmazlığı: beklenen ${source.commit}, bulunan ${head}` };
  }

  // Lisans kanıtı: LICENSE dosyası (varsa) + README beyanı.
  const ev = source.licenseEvidence || {};
  const evidence = {};
  if (ev.licenseFile) {
    const p = path.join(dir, ev.licenseFile);
    if (!existsSync(p)) return { ok: false, dir, reason: `lisans dosyası yok: ${ev.licenseFile}` };
    evidence.licenseText = await readFile(p, 'utf8');
    if (ev.licenseMustContain && !evidence.licenseText.includes(ev.licenseMustContain)) {
      return { ok: false, dir, reason: `lisans dosyası beklenen ibareyi içermiyor: "${ev.licenseMustContain}"` };
    }
    const lc = checkLicenseText(evidence.licenseText, source.expectedLicense);
    if (!lc.ok) return { ok: false, dir, reason: `LICENSE: ${lc.reason}` };
  }
  if (ev.readmeFile) {
    const p = path.join(dir, ev.readmeFile);
    if (!existsSync(p)) return { ok: false, dir, reason: `README yok: ${ev.readmeFile}` };
    evidence.readmeText = await readFile(p, 'utf8');
    if (ev.readmeSection && !evidence.readmeText.includes(ev.readmeSection)) {
      return { ok: false, dir, reason: `README beklenen lisans beyanını içermiyor: "${ev.readmeSection}"` };
    }
  }
  // En az bir kanıt kaynağı CC0 doğrulamasından geçmeli.
  if (!ev.licenseFile) {
    const lc = checkLicenseText(evidence.readmeText || '', source.expectedLicense);
    if (!lc.ok) return { ok: false, dir, reason: `README lisans beyanı: ${lc.reason}` };
  }
  return { ok: true, dir, evidence };
}

/** allowedPaths (dosya veya klasör) içindeki ses dosyalarını listeler. */
export async function listCandidateFiles(dir, allowedPaths) {
  const exts = new Set(['.wav', '.mp3', '.ogg', '.flac']);
  const out = [];
  for (const rel of allowedPaths || []) {
    const abs = path.join(dir, rel);
    const st = await stat(abs).catch(() => null);
    if (!st) continue;
    if (st.isFile()) {
      if (exts.has(path.extname(abs).toLowerCase())) out.push(rel);
    } else if (st.isDirectory()) {
      for (const e of await readdir(abs, { withFileTypes: true })) {
        if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
          out.push(path.join(rel, e.name));
        }
      }
    }
  }
  return out.sort();
}

// ---- teknik ölçüm ----

/** ffprobe ile ses doğrulama; bozuk dosya reddedilir. */
export async function probeAudio(file) {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name,sample_rate,channels',
      '-of', 'json', file,
    ], BUF);
    const info = JSON.parse(stdout);
    const a = (info.streams || []).find((s) => s.codec_type === 'audio');
    if (!a) return { ok: false, reason: 'ses akışı yok' };
    const duration = parseFloat(info.format?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0.05) return { ok: false, reason: `geçersiz süre (${duration})` };
    // Tam decode: bitstream hatası varsa yakala.
    const dec = await run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], BUF)
      .then((r) => String(r.stderr || '').trim())
      .catch((e) => String(e.stderr || e.message).trim() || 'decode hatası');
    if (dec) return { ok: false, reason: `decode hatası: ${dec.split('\n')[0].slice(0, 100)}` };
    return {
      ok: true,
      durationSeconds: +duration.toFixed(3),
      sampleRate: Number(a.sample_rate) || null,
      channels: a.channels || null,
      codec: a.codec_name || null,
    };
  } catch (err) {
    return { ok: false, reason: `ffprobe okuyamadı: ${String(err.message).slice(0, 100)}` };
  }
}

/** Loudness (LUFS) + peak (dB) ölçümü. Kısa dosyada LUFS null olabilir. */
export async function measureLoudness(file) {
  const { stderr } = await run('ffmpeg', [
    '-i', file, '-af', 'loudnorm=print_format=summary,volumedetect', '-f', 'null', '-',
  ], BUF).catch((e) => ({ stderr: e.stderr || '' }));
  const lufs = /Input Integrated:\s*(-?[\d.]+)/.exec(stderr || '');
  const peak = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr || '');
  return {
    lufs: lufs ? parseFloat(lufs[1]) : null,
    peakDb: peak ? parseFloat(peak[1]) : null,
  };
}

export async function sha256File(file) {
  const buf = await readFile(file);
  return createHash('sha256').update(buf).digest('hex');
}

/** Normalize PCM hash: codec/metadata'dan bağımsız near-duplicate anahtarı
 *  (aynı kayıt wav+flac gibi farklı kaplarda gelse de yakalanır). */
export async function normalizedPcmHash(file) {
  const { stdout } = await run('ffmpeg', [
    '-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 's16le', '-',
  ], { ...BUF, encoding: 'buffer' });
  return createHash('sha256').update(stdout).digest('hex');
}

// ---- sınıflandırma (deterministik) ----

/**
 * Tip/mood/energy sınıflandırması. Yanlış sınıflandırma yapılmaz:
 * birkaç saniyelik one-shot → sfx; doku/loop → ambience; enstrüman tek
 * sesi → sample; MUSIC yalnızca kaynak assetType=music VE ≥20sn ise verilir.
 */
export function classifyAsset(relPath, probe, source, rules = {}) {
  const name = path.basename(relPath).toLowerCase();
  for (const kw of rules.rejectKeywords?.unfit || []) {
    if (name.includes(kw)) {
      return { rejected: true, reason: `Shorts anlatımına uygun değil (yasak anahtar: "${kw}")` };
    }
  }
  const d = probe.durationSeconds;
  let type;
  if (source.assetType === 'music' && d >= 20) type = 'music';
  else if (d < 2.5) type = 'sfx';
  else if (source.assetType === 'sfx') type = 'sfx';
  else if (source.assetType === 'samples') type = 'sample';
  else type = 'ambience';

  const moods = [];
  for (const [mood, kws] of Object.entries(rules.moodKeywords || {})) {
    if (Array.isArray(kws) && kws.some((kw) => name.includes(kw))) moods.push(mood);
  }
  if (!moods.length) moods.push(...(source.defaultMoods?.length ? source.defaultMoods : ['neutral']));

  const loopable = type !== 'sfx' && (/loop|stream|hum|drone|noise/.test(name) || (type === 'music' && d >= 30));
  return { rejected: false, type, moods: [...new Set(moods)], topics: source.defaultTopics || [], loopable };
}

/** Ölçülen LUFS'tan deterministik enerji etiketi. */
export function energyFromLufs(lufs) {
  if (lufs === null || lufs === undefined) return 'medium';
  if (lufs > -14) return 'high';
  if (lufs > -22) return 'medium';
  return 'low';
}

// ---- normalizasyon (kaynak dosyaya dokunmadan optimize kopya) ----

/** Baş sessizliği süresini ölçer (silencedetect, salt-okuma geçişi).
 *  NOT: silenceremove FİLTRESİ bilinçli olarak kullanılmıyor — bu ffmpeg
 *  sürümünde mp3 muxer'a EOF iletmeyip süreci sonsuza dek askıda bırakıyor
 *  (canlı importta yakalandı). Bunun yerine ölç + `-ss` ile atla. */
export async function detectLeadingSilence(file, durationSeconds) {
  const { stderr } = await run('ffmpeg', [
    '-nostdin', '-i', file, '-af', 'silencedetect=noise=-55dB:d=0.05', '-f', 'null', '-',
  ], BUF).catch((e) => ({ stderr: e.stderr || '' }));
  const start = /silence_start:\s*(-?[\d.]+)/.exec(stderr || '');
  const end = /silence_end:\s*([\d.]+)/.exec(stderr || '');
  if (!start || parseFloat(start[1]) > 0.05 || !end) return 0;
  const lead = parseFloat(end[1]);
  // Dosyanın yarısından fazlasını asla kırpma (tamamı sessiz sayılan uçlar).
  if (!Number.isFinite(lead) || lead <= 0.05) return 0;
  return Math.min(lead, (durationSeconds || lead * 2) / 2);
}

/**
 * Shorts hedefli optimize kopya üretir: 48kHz stereo mp3 192k, loudness
 * normalize, baş sessizliği temizlenir (-ss ile), kısa fade'ler eklenir.
 * loopable dosyalarda fade/trim YAPILMAZ (loop dikişi bozulur).
 * sfx'te loudnorm yerine peak normalizasyonu kullanılır (kısa girdide
 * loudnorm güvenilmez).
 */
export async function normalizeAsset(srcFile, destFile, { type, loopable, peakDb, durationSeconds }) {
  await mkdir(path.dirname(destFile), { recursive: true });
  const filters = [];
  const pre = [];
  if (type === 'sfx') {
    const gain = peakDb !== null && peakDb !== undefined ? Math.max(-20, Math.min(20, -1 - peakDb)) : 0;
    filters.push(`volume=${gain.toFixed(1)}dB`);
    const lead = await detectLeadingSilence(srcFile, durationSeconds);
    if (lead > 0.05) pre.push('-ss', lead.toFixed(3));
  } else if (loopable) {
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11'); // fade/trim yok — loop bütünlüğü
  } else {
    const lead = await detectLeadingSilence(srcFile, durationSeconds);
    if (lead > 0.05) pre.push('-ss', lead.toFixed(3));
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    filters.push('afade=t=in:st=0:d=0.03');
  }
  await run('ffmpeg', [
    '-nostdin', '-y', '-v', 'error', ...pre, '-i', srcFile,
    '-af', filters.join(','),
    '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k',
    destFile,
  ], BUF);
  // Fade-out (loop olmayanlarda): normalize edilmiş sürenin sonuna uygulanır.
  if (type !== 'sfx' && !loopable) {
    const p = await probeAudio(destFile);
    if (p.ok && p.durationSeconds > 1) {
      const tmp = destFile + '.fade.mp3';
      const st = Math.max(0, p.durationSeconds - 0.15);
      await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', destFile,
        '-af', `afade=t=out:st=${st.toFixed(2)}:d=0.15`,
        '-codec:a', 'libmp3lame', '-b:a', '192k', tmp], BUF);
      await run('mv', [tmp, destFile]);
    }
  }
  const post = await probeAudio(destFile);
  if (!post.ok) throw new Error(`normalize çıktısı bozuk: ${post.reason}`);
  return post;
}

// ---- ana ithalat akışı ----

function slugify(s) {
  return s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * İthalatı uçtan uca çalıştırır. dryRun=true: hiçbir dosya kopyalanmaz,
 * manifest yazılmaz; yalnızca doğrulama + sınıflandırma raporu döner.
 * Idempotent: manifestte kayıtlı sha256'lar atlanır.
 */
export async function runImport({
  configPath = 'config/audio-sources.json',
  outRoot = 'assets/audio',
  cacheDir,
  dryRun = false,
  onlySource = null,
} = {}) {
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  const manifestPath = path.join(outRoot, 'manifests', 'audio-manifest.json');
  const rejectedPath = path.join(outRoot, 'manifests', 'rejected-assets.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : { generatedAt: null, assets: [] };
  const rejected = existsSync(rejectedPath)
    ? JSON.parse(await readFile(rejectedPath, 'utf8'))
    : { rejected: [] };
  const knownSha = new Set(manifest.assets.map((a) => a.sha256));
  const knownPcm = new Set(manifest.assets.map((a) => a.pcmHash).filter(Boolean));
  const rejectKey = (s, p) => `${s} ${p}`;
  const knownRejects = new Set(rejected.rejected.map((x) => rejectKey(x.source, x.path)));
  const addReject = (source, relPath, reason) => {
    console.warn(`  ✗ RED ${source}:${relPath} — ${reason}`);
    if (knownRejects.has(rejectKey(source, relPath))) return; // idempotent log
    knownRejects.add(rejectKey(source, relPath));
    rejected.rejected.push({ source, path: relPath, reason, at: new Date().toISOString() });
  };

  const summary = { accepted: [], rejectedCount: 0, skippedDuplicate: 0, sources: [] };
  for (const source of cfg.sources) {
    if (onlySource && source.id !== onlySource) continue;
    if (!source.enabled) {
      summary.sources.push({ id: source.id, status: 'devre dışı (enabled:false)' });
      continue;
    }
    console.log(`\n▶ Kaynak: ${source.id} @ ${source.commit.slice(0, 10)}`);
    const v = await verifySource(source, { cacheDir });
    if (!v.ok) {
      addReject(source.id, '(kaynak)', v.reason);
      summary.rejectedCount += 1;
      summary.sources.push({ id: source.id, status: `RED: ${v.reason}` });
      continue;
    }
    console.log('  ✓ commit + lisans kanıtı doğrulandı');
    const files = await listCandidateFiles(v.dir, source.allowedPaths);
    console.log(`  ${files.length} aday dosya (whitelist)`);
    let ok = 0;
    for (const rel of files) {
      const abs = path.join(v.dir, rel);
      // Uygunsuz içerik adından belli — probe'a gelmeden reddet.
      const unfit = (cfg.rejectKeywords?.unfit || []).find((kw) =>
        path.basename(rel).toLowerCase().includes(kw));
      if (unfit) {
        addReject(source.id, rel, `Shorts anlatımına uygun değil (yasak anahtar: "${unfit}")`);
        summary.rejectedCount += 1;
        continue;
      }
      const probe = await probeAudio(abs);
      if (!probe.ok) { addReject(source.id, rel, probe.reason); summary.rejectedCount += 1; continue; }
      const cls = classifyAsset(rel, probe, source, cfg);
      if (cls.rejected) { addReject(source.id, rel, cls.reason); summary.rejectedCount += 1; continue; }
      const sha = await sha256File(abs);
      if (knownSha.has(sha)) { summary.skippedDuplicate += 1; continue; }
      const pcm = await normalizedPcmHash(abs).catch(() => null);
      if (pcm && knownPcm.has(pcm)) {
        addReject(source.id, rel, 'normalize edilmiş PCM kopyası (near-duplicate)');
        summary.rejectedCount += 1;
        continue;
      }
      const loud = await measureLoudness(abs);
      const id = `${source.id}-${slugify(path.basename(rel))}`;
      const destRel = path.join(cls.type === 'sample' ? 'samples' : cls.type, `${id}.mp3`);
      const destAbs = path.join(outRoot, destRel);
      const entry = {
        id,
        filename: destRel,
        title: path.basename(rel).replace(/\.[a-z0-9]+$/i, ''),
        sourceRepository: source.repository,
        sourceCommit: source.commit,
        sourcePath: rel,
        license: source.expectedLicense,
        licenseEvidence: source.licenseEvidence?.licenseFile
          ? `${source.licenseEvidence.licenseFile} + README`
          : `README: "${source.licenseEvidence?.readmeSection}"`,
        sha256: sha,
        pcmHash: pcm,
        durationSeconds: probe.durationSeconds,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        sourceCodec: probe.codec,
        lufs: loud.lufs,
        peakDb: loud.peakDb,
        type: cls.type,
        moods: cls.moods,
        topics: cls.topics,
        energy: energyFromLufs(loud.lufs),
        loopable: cls.loopable,
        attributionRequired: false, // CC0/PD: atıf zorunlu değil
        importedAt: new Date().toISOString(),
      };
      if (!dryRun) {
        const post = await normalizeAsset(abs, destAbs, {
          ...cls, peakDb: loud.peakDb, durationSeconds: probe.durationSeconds,
        }).catch((err) => ({ ok: false, reason: err.message }));
        if (post.ok === false) { addReject(source.id, rel, `normalize hatası: ${post.reason}`); summary.rejectedCount += 1; continue; }
        entry.processedDurationSeconds = post.durationSeconds;
        manifest.assets.push(entry);
        knownSha.add(sha);
        if (pcm) knownPcm.add(pcm);
      }
      summary.accepted.push(entry);
      ok += 1;
    }
    summary.sources.push({ id: source.id, status: `OK — ${ok} kabul` });
  }

  if (!dryRun) {
    manifest.generatedAt = new Date().toISOString();
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await writeFile(rejectedPath, JSON.stringify(rejected, null, 2));
  }
  return { summary, manifest, rejected };
}
