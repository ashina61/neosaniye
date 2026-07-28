import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const topic = process.env.ASSET_TOPIC || 'first-traffic-light';
const manifestPath = path.join(ROOT, 'content', 'assets', `${topic}.json`);
const outputRoot = path.join(ROOT, 'out', 'asset-candidates', topic);
const reportPath = path.join(outputRoot, 'report.json');
const providers = (process.env.ASSET_PROVIDERS || 'gemini,openai,bfl,stability')
  .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const explicitAssetIds = (process.env.ASSET_IDS || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const timeoutMs = Number(process.env.ASSET_REQUEST_TIMEOUT_MS || 180000);

const secretAliases = {
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  bfl: ['BFL_API_KEY', 'FLUX_API_KEY'],
  stability: ['STABILITY_API_KEY'],
};

const models = {
  gemini: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
  openai: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5',
  bfl: process.env.BFL_IMAGE_MODEL || 'flux-2-pro',
  stability: process.env.STABILITY_IMAGE_MODEL || 'core',
};

function secretFor(provider) {
  for (const name of secretAliases[provider] || []) {
    if (process.env[name]) return {name, value: process.env[name]};
  }
  return null;
}

function dimensionsFor(aspectRatio, provider) {
  if (provider === 'openai') {
    if (['9:16', '2:3', '4:5'].includes(aspectRatio)) return {width: 1024, height: 1536, size: '1024x1536'};
    if (aspectRatio === '3:2') return {width: 1536, height: 1024, size: '1536x1024'};
    return {width: 1024, height: 1024, size: '1024x1024'};
  }
  return ({
    '9:16': {width: 768, height: 1344},
    '2:3': {width: 896, height: 1344},
    '3:2': {width: 1344, height: 896},
    '4:5': {width: 1024, height: 1280},
    '1:1': {width: 1024, height: 1024},
  })[aspectRatio] || {width: 1024, height: 1024};
}

function buildPrompt(manifest, asset) {
  const outputInstruction = asset.transparent
    ? 'Create one isolated subject, fully visible with generous empty margin. Use a genuinely transparent background when supported. Keep edges clean and do not crop the subject.'
    : 'Create a complete edge-to-edge environment with clearly separable foreground, middle ground and background for 2.5D parallax.';
  return `${manifest.artDirection.prompt}\n\n${asset.prompt}\n\n${outputInstruction}\n\nAvoid: ${manifest.artDirection.negativePrompt}.`;
}

async function fetchWithTimeout(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function errorText(response) {
  return `HTTP ${response.status}: ${(await response.text()).slice(0, 1200)}`;
}

function locateBase64(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.b64_json === 'string' && value.b64_json.length > 500) return value.b64_json;
  if (typeof value.data === 'string' && value.data.length > 500 && (value.mime_type || value.mimeType || value.type === 'image')) return value.data;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = locateBase64(item);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = locateBase64(child);
      if (found) return found;
    }
  }
  return null;
}

async function gemini({prompt, aspectRatio, secret}) {
  const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'x-goog-api-key': secret, 'content-type': 'application/json'},
    body: JSON.stringify({
      model: models.gemini,
      input: [{type: 'text', text: prompt}],
      response_format: {type: 'image', mime_type: 'image/png', aspect_ratio: aspectRatio, image_size: '1K'},
    }),
  });
  if (!response.ok) throw new Error(await errorText(response));
  const json = await response.json();
  const encoded = json.output_image?.data || locateBase64(json);
  if (!encoded) throw new Error('Gemini response did not include image data.');
  return Buffer.from(encoded, 'base64');
}

async function openai({prompt, aspectRatio, transparent, secret}) {
  const {size} = dimensionsFor(aspectRatio, 'openai');
  const response = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      model: models.openai,
      prompt,
      size,
      quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
      background: transparent ? 'transparent' : 'opaque',
      output_format: 'png',
      n: 1,
    }),
  });
  if (!response.ok) throw new Error(await errorText(response));
  const json = await response.json();
  const encoded = json.data?.[0]?.b64_json || locateBase64(json);
  if (!encoded) throw new Error('OpenAI response did not include image data.');
  return Buffer.from(encoded, 'base64');
}

async function bfl({prompt, aspectRatio, secret}) {
  const {width, height} = dimensionsFor(aspectRatio, 'bfl');
  const response = await fetchWithTimeout(`https://api.bfl.ai/v1/${models.bfl}`, {
    method: 'POST',
    headers: {'x-key': secret, accept: 'application/json', 'content-type': 'application/json'},
    body: JSON.stringify({prompt, width, height, output_format: 'png', prompt_upsampling: false, safety_tolerance: 2}),
  });
  if (!response.ok) throw new Error(await errorText(response));
  const submitted = await response.json();
  if (!submitted.polling_url) throw new Error('BFL response did not include polling_url.');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 1000 : 2000));
    const poll = await fetchWithTimeout(submitted.polling_url, {headers: {'x-key': secret, accept: 'application/json'}}, 1);
    if (!poll.ok) throw new Error(await errorText(poll));
    const result = await poll.json();
    if (result.status === 'Ready' && result.result?.sample) {
      const image = await fetchWithTimeout(result.result.sample, {}, 2);
      if (!image.ok) throw new Error(await errorText(image));
      return Buffer.from(await image.arrayBuffer());
    }
    if (['Error', 'Failed', 'Request Moderated'].includes(result.status)) throw new Error(`BFL failed: ${JSON.stringify(result).slice(0, 1000)}`);
  }
  throw new Error('BFL generation timed out.');
}

async function stability({prompt, aspectRatio, negativePrompt, secret}) {
  const form = new FormData();
  form.append('none', new Blob([''], {type: 'application/octet-stream'}), 'none');
  form.append('prompt', prompt);
  form.append('aspect_ratio', aspectRatio);
  form.append('negative_prompt', negativePrompt);
  form.append('output_format', 'png');
  form.append('style_preset', 'digital-art');
  const endpoint = models.stability === 'ultra' ? 'ultra' : 'core';
  const response = await fetchWithTimeout(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: 'POST', headers: {authorization: `Bearer ${secret}`, accept: 'image/*'}, body: form,
  });
  if (!response.ok) throw new Error(await errorText(response));
  return Buffer.from(await response.arrayBuffer());
}

const generators = {gemini, openai, bfl, stability};

async function runInspection() {
  const inspection = spawnSync('python', [
    path.join(ROOT, 'scripts', 'inspect-assets.py'),
    '--root', outputRoot,
    '--manifest', manifestPath,
    '--report', reportPath,
  ], {stdio: 'inherit'});
  if (inspection.error) throw inspection.error;
  if (inspection.status !== 0) throw new Error(`Asset inspection exited with code ${inspection.status}.`);
}

async function main() {
  await mkdir(outputRoot, {recursive: true});
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const assetIds = explicitAssetIds.length ? explicitAssetIds : manifest.candidateTest;
  const assets = manifest.assets.filter((asset) => assetIds.includes(asset.id));
  const missing = assetIds.filter((id) => !assets.some((asset) => asset.id === id));
  if (missing.length) throw new Error(`Unknown asset IDs: ${missing.join(', ')}`);
  if (!assets.length) throw new Error('No assets selected.');

  const report = {
    version: 1,
    topic,
    startedAt: new Date().toISOString(),
    requestedProviders: providers,
    requestedAssets: assets.map((asset) => asset.id),
    providers: Object.fromEntries(providers.map((provider) => {
      const secret = secretFor(provider);
      return [provider, {configured: Boolean(secret), secretName: secret?.name || null, model: models[provider] || null}];
    })),
    results: [],
    summary: {},
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const asset of assets) {
    for (const provider of providers) {
      const secret = secretFor(provider);
      const result = {assetId: asset.id, provider, model: models[provider] || null, status: 'pending', durationMs: 0, file: null, qc: null, error: null};
      const started = Date.now();
      if (!generators[provider]) {
        result.status = 'skipped';
        result.error = 'unsupported-provider';
      } else if (!secret) {
        result.status = 'skipped';
        result.error = 'secret-not-configured';
      } else {
        try {
          const image = await generators[provider]({
            prompt: buildPrompt(manifest, asset),
            aspectRatio: asset.aspectRatio,
            transparent: asset.transparent,
            negativePrompt: manifest.artDirection.negativePrompt,
            secret: secret.value,
          });
          const directory = path.join(outputRoot, provider);
          await mkdir(directory, {recursive: true});
          const file = path.join(directory, `${asset.id}.png`);
          await writeFile(file, image);
          result.status = 'success';
          result.file = path.relative(ROOT, file);
        } catch (error) {
          result.status = 'failed';
          result.error = error instanceof Error ? error.message : String(error);
        }
      }
      result.durationMs = Date.now() - started;
      report.results.push(result);
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
  }

  const successful = report.results.filter((result) => result.status === 'success').length;
  const failed = report.results.filter((result) => result.status === 'failed').length;
  const skipped = report.results.filter((result) => result.status === 'skipped').length;
  report.finishedAt = new Date().toISOString();
  report.summary = {successful, failed, skipped};
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!successful) throw new Error('No image provider produced a candidate. See report.json.');

  await runInspection();
  console.log(JSON.stringify({topic, successful, failed, skipped}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
