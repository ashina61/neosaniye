import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const topic = process.env.ASSET_TOPIC || 'first-traffic-light';
const manifestPath = path.join(ROOT, 'content', 'assets', `${topic}.json`);
const outputRoot = path.join(ROOT, 'out', 'asset-candidates', topic);
const reportPath = path.join(outputRoot, 'report.json');
const providers = (process.env.ASSET_PROVIDERS || 'gemini,pollinations,cloudflare,together,huggingface')
  .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const requestedAssetIds = (process.env.ASSET_IDS || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const requestTimeoutMs = Number(process.env.ASSET_REQUEST_TIMEOUT_MS || 180000);

const providerConfig = {
  gemini: {
    model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    secrets: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  },
  pollinations: {
    model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux',
    secrets: ['POLLINATIONS_API_KEY'],
  },
  cloudflare: {
    model: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell',
    secrets: ['CLOUDFLARE_API_TOKEN'],
    extraSecrets: ['CLOUDFLARE_ACCOUNT_ID'],
  },
  together: {
    model: process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free',
    secrets: ['TOGETHER_API_KEY'],
  },
  huggingface: {
    model: process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell',
    secrets: ['HUGGINGFACE_API_KEY', 'HF_TOKEN'],
  },
};

function firstSecret(names = []) {
  for (const name of names) {
    if (process.env[name]) return {name, value: process.env[name]};
  }
  return null;
}

function providerStatus(provider) {
  const config = providerConfig[provider];
  if (!config) return {configured: false, model: null, reason: 'unsupported-provider'};
  const primary = firstSecret(config.secrets);
  const missingExtra = (config.extraSecrets || []).filter((name) => !process.env[name]);
  return {
    configured: Boolean(primary) && missingExtra.length === 0,
    secretName: primary?.name || null,
    model: config.model,
    missingExtraSecrets: missingExtra,
  };
}

function dimensions(aspectRatio) {
  return ({
    '9:16': {width: 768, height: 1344},
    '2:3': {width: 896, height: 1344},
    '3:2': {width: 1344, height: 896},
    '4:5': {width: 1024, height: 1280},
    '1:1': {width: 1024, height: 1024},
  })[aspectRatio] || {width: 1024, height: 1024};
}

function buildPrompt(manifest, asset) {
  const output = asset.transparent
    ? 'One isolated subject only. Entire subject fully visible with generous clear margin. Plain flat off-white background because transparency will be cut out later. Strong clean silhouette. Do not crop any part.'
    : 'Complete edge-to-edge environment with clearly separable foreground, middle ground and background for 2.5D parallax. Keep the main background readable behind future animated cutouts.';
  return `${manifest.artDirection.prompt}\n\n${asset.prompt}\n\n${output}\n\nAvoid: ${manifest.artDirection.negativePrompt}.`;
}

async function request(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1800 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1800 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function errorMessage(response) {
  const body = await response.text();
  return `HTTP ${response.status}: ${body.slice(0, 1200)}`;
}

function findImageBase64(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['b64_json', 'image', 'data']) {
    if (typeof value[key] === 'string' && value[key].length > 1000) return value[key];
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const entry of child) {
        const result = findImageBase64(entry);
        if (result) return result;
      }
    } else if (child && typeof child === 'object') {
      const result = findImageBase64(child);
      if (result) return result;
    }
  }
  return null;
}

async function generateGemini({prompt, aspectRatio, secret}) {
  const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'x-goog-api-key': secret, 'content-type': 'application/json'},
    body: JSON.stringify({
      model: providerConfig.gemini.model,
      input: [{type: 'text', text: prompt}],
      response_format: {type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio, image_size: '1K'},
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const data = await response.json();
  const encoded = data.output_image?.data || findImageBase64(data);
  if (!encoded) throw new Error('Gemini response did not contain image bytes.');
  return {buffer: Buffer.from(encoded, 'base64'), extension: 'jpg'};
}

async function generatePollinations({prompt, aspectRatio, secret}) {
  const {width, height} = dimensions(aspectRatio);
  const encodedPrompt = encodeURIComponent(prompt);
  const query = new URLSearchParams({
    model: providerConfig.pollinations.model,
    size: `${width}x${height}`,
    width: String(width),
    height: String(height),
    seed: String(1868 + width + height),
    nologo: 'true',
  });
  const response = await request(`https://gen.pollinations.ai/image/${encodedPrompt}?${query}`, {
    headers: {authorization: `Bearer ${secret}`, accept: 'image/*'},
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 3000) throw new Error('Pollinations returned an invalid or empty image.');
  return {buffer, extension: 'jpg'};
}

async function generateCloudflare({prompt, aspectRatio, secret}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const {width, height} = dimensions(aspectRatio);
  const model = providerConfig.cloudflare.model;
  const response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json'},
    body: JSON.stringify({prompt, width, height, seed: 1868}),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    const encoded = data?.result?.image || findImageBase64(data);
    if (!encoded) throw new Error('Cloudflare response did not contain image bytes.');
    return {buffer: Buffer.from(encoded, 'base64'), extension: 'png'};
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 3000) throw new Error('Cloudflare returned an invalid or empty image.');
  return {buffer, extension: contentType.includes('png') ? 'png' : 'jpg'};
}

async function generateTogether({prompt, aspectRatio, secret}) {
  const {width, height} = dimensions(aspectRatio);
  const response = await request('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      model: providerConfig.together.model,
      prompt,
      width,
      height,
      seed: 1868,
      n: 1,
      response_format: 'b64_json',
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const data = await response.json();
  const encoded = data?.data?.[0]?.b64_json || findImageBase64(data);
  if (!encoded) throw new Error('Together response did not contain image bytes.');
  return {buffer: Buffer.from(encoded, 'base64'), extension: 'png'};
}

async function generateHuggingFace({prompt, aspectRatio, secret}) {
  const {width, height} = dimensions(aspectRatio);
  const model = providerConfig.huggingface.model;
  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${model}`,
    `https://api-inference.huggingface.co/models/${model}`,
  ];
  let lastError;
  for (const endpoint of endpoints) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json', accept: 'image/*'},
      body: JSON.stringify({
        inputs: prompt,
        parameters: {width, height, seed: 1868, num_inference_steps: 4},
      }),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 3000) throw new Error('Hugging Face returned an invalid or empty image.');
      return {buffer, extension: contentType.includes('png') ? 'png' : 'jpg'};
    }
    lastError = new Error(await errorMessage(response));
    if (![404, 410].includes(response.status)) break;
  }
  throw lastError || new Error('Hugging Face image generation failed.');
}

const generators = {
  gemini: generateGemini,
  pollinations: generatePollinations,
  cloudflare: generateCloudflare,
  together: generateTogether,
  huggingface: generateHuggingFace,
};

async function inspectAssets() {
  const processResult = spawnSync('python', [
    path.join(ROOT, 'scripts', 'inspect-assets.py'),
    '--root', outputRoot,
    '--manifest', manifestPath,
    '--report', reportPath,
  ], {stdio: 'inherit'});
  if (processResult.error) throw processResult.error;
  if (processResult.status !== 0) throw new Error(`Asset inspection failed with code ${processResult.status}.`);
}

async function main() {
  await mkdir(outputRoot, {recursive: true});
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const assetIds = requestedAssetIds.length ? requestedAssetIds : manifest.candidateTest;
  const assets = manifest.assets.filter((asset) => assetIds.includes(asset.id));
  const unknown = assetIds.filter((id) => !assets.some((asset) => asset.id === id));
  if (unknown.length) throw new Error(`Unknown asset IDs: ${unknown.join(', ')}`);

  const statuses = Object.fromEntries(providers.map((provider) => [provider, providerStatus(provider)]));
  const report = {
    version: 2,
    topic,
    startedAt: new Date().toISOString(),
    requestedProviders: providers,
    requestedAssets: assets.map((asset) => asset.id),
    providers: statuses,
    results: [],
    summary: {},
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const asset of assets) {
    for (const provider of providers) {
      const status = statuses[provider];
      const result = {assetId: asset.id, provider, model: status?.model || null, status: 'pending', durationMs: 0, file: null, qc: null, error: null};
      const started = Date.now();
      const secret = firstSecret(providerConfig[provider]?.secrets);
      if (!generators[provider]) {
        result.status = 'skipped';
        result.error = 'unsupported-provider';
      } else if (!status.configured || !secret) {
        result.status = 'skipped';
        result.error = status.missingExtraSecrets?.length ? `missing:${status.missingExtraSecrets.join(',')}` : 'secret-not-configured';
      } else {
        try {
          const generated = await generators[provider]({
            prompt: buildPrompt(manifest, asset),
            aspectRatio: asset.aspectRatio,
            secret: secret.value,
          });
          const directory = path.join(outputRoot, provider);
          await mkdir(directory, {recursive: true});
          const file = path.join(directory, `${asset.id}.${generated.extension}`);
          await writeFile(file, generated.buffer);
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

  const count = (name) => report.results.filter((result) => result.status === name).length;
  report.finishedAt = new Date().toISOString();
  report.summary = {successful: count('success'), failed: count('failed'), skipped: count('skipped')};
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.summary.successful) throw new Error('No configured provider produced an image. See report.json.');
  await inspectAssets();
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
