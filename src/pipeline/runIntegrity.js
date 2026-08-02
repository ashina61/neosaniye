/**
 * RUN INTEGRITY — "bu artifact'ler gerçekten AYNI koşuya mı ait?"
 *
 * Sorun: script.json, scene-plan.json, production-report.json ve final MP4
 * ayrı ayrı yazılıyor. Bir koşu yarı yolda düşüp bir sonraki koşu aynı
 * dizine yazdığında, elimizde BİRBİRİNE AİT OLMAYAN artifact'ler kalır ve QC
 * bir koşunun planını başka bir koşunun videosuyla karşılaştırır. Kolibri
 * denetiminde raporlarla videonun çelişmesinin bir sebebi de bu ihtimaldi;
 * artık ihtimal olmaktan çıkıyor, ölçülüyor.
 *
 * Yöntem: her parçanın SHA-256'sı alınır ve deterministik sırada zincirlenir.
 * Zincir özeti (chainHash) tüm artifact'lere yazılır. Doğrulama, dosyaları
 * yeniden özetleyip zinciri yeniden kurar; uyuşmazsa QC başarısızdır.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Nesneyi anahtar sırasından bağımsız, deterministik JSON'a çevir. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Parça özetlerini deterministik sırada zincirle. */
export function chainOf(parts) {
  const keys = Object.keys(parts).sort();
  let chain = '';
  for (const k of keys) chain = sha(`${chain}|${k}|${parts[k] || ''}`);
  return chain;
}

async function hashFile(file) {
  try { return sha(await readFile(file)); } catch { return null; }
}

/**
 * Koşu kimliği + zincir özeti üret.
 *
 * @param {object} input
 * @param {string} input.workDir
 * @param {string} input.videoPath
 * @param {object} input.script
 * @param {object} input.renderPlan
 * @returns {Promise<{runId:string, chainHash:string, parts:object}>}
 */
export async function buildRunIntegrity({ workDir, videoPath, script = {}, renderPlan = {} }) {
  const parts = {
    script: sha(stableStringify({
      topic: script.topic, hook: script.hook_text,
      scenes: (script.scenes || []).map((s) => s.narration),
    })),
    scenePlan: sha(stableStringify((script.scenes || []).map((s) => ({
      t: s.story_template, p: s.image_prompt, n: s.negative_prompt, l: s.list_index ?? null,
    })))),
    renderPlan: sha(stableStringify({
      clips: renderPlan.clips || [], overlays: renderPlan.overlayLayers || [],
      windows: renderPlan.overlayWindows || {},
    })),
    finalVideo: await hashFile(videoPath),
  };
  const chainHash = chainOf(parts);
  // runId: içeriğe bağlı, kısa ve okunur.
  const runId = `${script.normalizedTopic || path.basename(workDir || 'run')}-${chainHash.slice(0, 10)}`;
  return { runId, chainHash, parts, createdAt: new Date().toISOString() };
}

/**
 * Zinciri YENİDEN kurup karşılaştır (artifact'ler aynı koşudan mı?).
 * @returns {{valid:boolean, expected:string, actual:string, mismatched:string[]}}
 */
export function verifyRunIntegrity(recorded, recomputed) {
  if (!recorded?.chainHash || !recomputed?.chainHash) {
    return { valid: false, expected: recorded?.chainHash || null, actual: recomputed?.chainHash || null, mismatched: ['MISSING_CHAIN'] };
  }
  const mismatched = Object.keys(recorded.parts || {})
    .filter((k) => (recorded.parts[k] || null) !== (recomputed.parts?.[k] || null));
  return {
    valid: recorded.chainHash === recomputed.chainHash && mismatched.length === 0,
    expected: recorded.chainHash,
    actual: recomputed.chainHash,
    mismatched,
  };
}
