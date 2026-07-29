import process from 'node:process';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadProviders = new Set();

function secret(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function retryDelay(response, body) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 65000);
  const match = String(body || '').match(/retry(?: in| after)?\s*([0-9.]+)s/i);
  return match ? Math.min(Math.ceil(Number(match[1]) * 1000) + 750, 65000) : 5000;
}

async function request(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.PROVIDER_TIMEOUT_MS || 240000));
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      if (response.ok) return response;

      const body = await response.text();
      const error = new Error(`HTTP ${response.status}: ${body.slice(0, 1400)}`);
      error.status = response.status;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < attempts) {
        await sleep(retryDelay(response, body));
        lastError = error;
        continue;
      }
      throw error;
    } catch (error) {
      lastError = error;
      const match = String(error?.message || '').match(/HTTP\s+(\d{3})/);
      const status = Number(error?.status || (match ? match[1] : 0) || 0);
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= attempts) throw error;
      await sleep(3000 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Provider request failed.');
}

function jsonObject(text) {
  const source = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // NOT: burada uzun süre `indexOf('{}')` yazıyordu — yani BOŞ nesne aranıyordu.
  // Sağlayıcı kusursuz JSON döndürse bile start=-1 olup "Provider did not return
  // JSON" hatası atılıyordu; zincirdeki yedi sağlayıcının hepsi bu yüzden düştü.
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0) throw new Error(`Provider returned no JSON object: ${source.slice(0, 500)}`);
  if (end <= start) {
    // Açılış süslü parantez var, kapanış yok => yanıt kesilmiş (finish_reason: length).
    throw new Error(`Provider returned truncated JSON (no closing brace): ${source.slice(0, 500)}`);
  }

  const candidate = source.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    // Son çare: ilk `{`den başlayıp dengeli biten nesneyi tara. Modelin JSON'dan
    // sonra açıklama yazdığı ya da art arda iki nesne döndürdüğü durumları kurtarır.
    const balanced = firstBalancedObject(source, start);
    if (balanced) return JSON.parse(balanced);
    throw new Error(`Provider returned unparsable JSON (${error.message}): ${candidate.slice(0, 500)}`);
  }
}

/** `start` konumundaki `{` ile eşleşen kapanışa kadar olan dilimi döndür (string/escape farkında). */
function firstBalancedObject(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function walk(value, predicate) {
  if (predicate(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walk(item, predicate);
      if (found !== undefined) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      const found = walk(child, predicate);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function geminiText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;

  const textBlock = walk(payload, (value) => Boolean(
    value &&
    typeof value === 'object' &&
    (value.type === 'text' || value.type === 'output_text') &&
    typeof value.text === 'string' &&
    value.text.trim(),
  ));
  if (textBlock?.text) return textBlock.text;

  const candidateText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean)
    .join('');
  if (candidateText) return candidateText;

  throw new Error(`Gemini response contained no text: ${JSON.stringify(payload).slice(0, 600)}`);
}

function imageBase64(payload) {
  if (typeof payload?.output_image?.data === 'string') return payload.output_image.data;

  const block = walk(payload, (value) => Boolean(
    value &&
    typeof value === 'object' &&
    (
      typeof value?.b64_json === 'string' ||
      typeof value?.inlineData?.data === 'string' ||
      typeof value?.inline_data?.data === 'string' ||
      (value.type === 'image' && typeof value.data === 'string')
    ),
  ));
  if (block?.b64_json) return block.b64_json;
  if (block?.inlineData?.data) return block.inlineData.data;
  if (block?.inline_data?.data) return block.inline_data.data;
  if (block?.data) return block.data;

  throw new Error(`Provider response contained no image data: ${JSON.stringify(payload).slice(0, 600)}`);
}

async function openAiText({url, apiKey, model, prompt, headers = {}}) {
  if (!apiKey) throw new Error('secret-not-configured');
  const response = await request(url, {
    method: 'POST',
    headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...headers},
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 2200,
      response_format: {type: 'json_object'},
      messages: [
        {role: 'system', content: 'Return only valid JSON. Do not use Markdown.'},
        {role: 'user', content: prompt},
      ],
    }),
  });
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!text) throw new Error(`Provider returned no text: ${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

const storyProviders = {
  gemini: async (prompt) => {
    const apiKey = secret('GEMINI_API_KEY', 'GOOGLE_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
    const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {'x-goog-api-key': apiKey, 'content-type': 'application/json', 'Api-Revision': '2026-05-20'},
      body: JSON.stringify({model, input: [{type: 'text', text: prompt}]}),
    });
    return geminiText(await response.json());
  },
  groq: (prompt) => openAiText({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: secret('GROQ_API_KEY'),
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    prompt,
  }),
  cerebras: (prompt) => openAiText({
    url: 'https://api.cerebras.ai/v1/chat/completions',
    apiKey: secret('CEREBRAS_API_KEY'),
    model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
    prompt,
  }),
  'github-models': (prompt) => openAiText({
    url: 'https://models.github.ai/inference/chat/completions',
    apiKey: secret('GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN'),
    model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o',
    prompt,
    headers: {
      accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  }),
  mistral: (prompt) => openAiText({
    url: 'https://api.mistral.ai/v1/chat/completions',
    apiKey: secret('MISTRAL_API_KEY'),
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
    prompt,
  }),
  cloudflare: async (prompt) => {
    const apiKey = secret('CLOUDFLARE_API_TOKEN');
    const accountId = secret('CLOUDFLARE_ACCOUNT_ID');
    if (!apiKey || !accountId) throw new Error('secret-not-configured');
    const model = process.env.CLOUDFLARE_TEXT_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({prompt, max_tokens: 4000}),
    });
    const data = await response.json();
    const text = data?.result?.response || data?.result?.text || '';
    if (!text) throw new Error(`Cloudflare returned no text: ${JSON.stringify(data).slice(0, 500)}`);
    return text;
  },
  openrouter: (prompt) => openAiText({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: secret('OPENROUTER_API_KEY'),
    model: process.env.OPENROUTER_MODEL || 'openrouter/free',
    prompt,
    headers: {'HTTP-Referer': 'https://github.com/ashina61/neosaniey', 'X-Title': 'NeoSaniye'},
  }),
};

export async function generateStoryJson(prompt, validate) {
  const chain = (process.env.STORY_PROVIDER_CHAIN || 'gemini,groq,cerebras,github-models,mistral,cloudflare,openrouter')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const errors = [];

  for (const name of chain) {
    if (deadProviders.has(`story:${name}`) || !storyProviders[name]) continue;
    try {
      console.log(`[story] trying provider: ${name}`);
      const text = await storyProviders[name](prompt);
      const raw = jsonObject(text);
      const value = typeof validate === 'function' ? validate(raw, name) : raw;
      console.log(`[story] provider succeeded: ${name}`);
      return {value, provider: name};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[story] provider failed: ${name}: ${message.slice(0, 500)}`);
      errors.push(`${name}: ${message.slice(0, 240)}`);
      if (/secret-not-configured|401|403|429|quota|payment/i.test(message)) deadProviders.add(`story:${name}`);
    }
  }

  throw new Error(`Story providers exhausted: ${errors.join(' | ')}`);
}

function dimensions(aspectRatio) {
  return ({
    '9:16': {width: 768, height: 1344},
    '4:5': {width: 1024, height: 1280},
    '1:1': {width: 1024, height: 1024},
  })[aspectRatio] || {width: 768, height: 1344};
}

function openAiSize(aspectRatio) {
  if (['9:16', '4:5'].includes(aspectRatio)) return '1024x1536';
  if (aspectRatio === '3:2') return '1536x1024';
  return '1024x1024';
}

const imageProviders = {
  gemini: async ({prompt, styleReference, aspectRatio}) => {
    const apiKey = secret('GEMINI_API_KEY', 'GOOGLE_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
    const input = [];
    if (styleReference) input.push({type: 'image', mime_type: 'image/jpeg', data: styleReference});
    input.push({type: 'text', text: prompt});
    const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {'x-goog-api-key': apiKey, 'content-type': 'application/json', 'Api-Revision': '2026-05-20'},
      body: JSON.stringify({
        model,
        input,
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: aspectRatio,
          image_size: process.env.GEMINI_IMAGE_SIZE || '1K',
        },
      }),
    }, 1);
    return {buffer: Buffer.from(imageBase64(await response.json()), 'base64'), extension: 'jpg', model};
  },

  openai: async ({prompt, aspectRatio}) => {
    const apiKey = secret('OPENAI_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
    const response = await request('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        model,
        prompt,
        size: openAiSize(aspectRatio),
        quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
        background: 'opaque',
        output_format: 'png',
        n: 1,
      }),
    }, 1);
    return {buffer: Buffer.from(imageBase64(await response.json()), 'base64'), extension: 'png', model};
  },

  bfl: async ({prompt, aspectRatio}) => {
    const apiKey = secret('BFL_API_KEY', 'FLUX_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const model = process.env.BFL_IMAGE_MODEL || 'flux-2-pro';
    const {width, height} = dimensions(aspectRatio);
    const response = await request(`https://api.bfl.ai/v1/${model}`, {
      method: 'POST',
      headers: {'x-key': apiKey, accept: 'application/json', 'content-type': 'application/json'},
      body: JSON.stringify({
        prompt,
        width,
        height,
        output_format: 'png',
        prompt_upsampling: false,
        safety_tolerance: 2,
      }),
    }, 1);
    const submitted = await response.json();
    if (!submitted?.polling_url) throw new Error(`BFL returned no polling URL: ${JSON.stringify(submitted).slice(0, 500)}`);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      await sleep(attempt < 10 ? 1000 : 2000);
      const poll = await request(submitted.polling_url, {
        headers: {'x-key': apiKey, accept: 'application/json'},
      }, 1);
      const result = await poll.json();
      if (result.status === 'Ready' && result.result?.sample) {
        const image = await request(result.result.sample, {}, 2);
        return {buffer: Buffer.from(await image.arrayBuffer()), extension: 'png', model};
      }
      if (['Error', 'Failed', 'Request Moderated'].includes(result.status)) {
        throw new Error(`BFL failed: ${JSON.stringify(result).slice(0, 800)}`);
      }
    }
    throw new Error('BFL generation timed out.');
  },

  stability: async ({prompt, aspectRatio}) => {
    const apiKey = secret('STABILITY_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const model = process.env.STABILITY_IMAGE_MODEL || 'core';
    const endpoint = model === 'ultra' ? 'ultra' : 'core';
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('aspect_ratio', aspectRatio);
    form.append('negative_prompt', 'readable text, logo, watermark, modern UI, glossy 3D, neon, anime, childish cartoon');
    form.append('output_format', 'png');
    form.append('style_preset', 'digital-art');
    const response = await request(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, accept: 'image/*'},
      body: form,
    }, 1);
    return {buffer: Buffer.from(await response.arrayBuffer()), extension: 'png', model};
  },

  pollinations: async ({prompt, aspectRatio, seed}) => {
    // Pollinations.ai works WITHOUT an API key — fully free & unlimited
    const {width, height} = dimensions(aspectRatio);
    const params = new URLSearchParams({
      model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux',
      width: String(width),
      height: String(height),
      seed: String(seed),
      nologo: 'true',
      private: 'true',
    });
    const response = await request(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`, {
      headers: {accept: 'image/*'},
    }, 2);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      extension: (response.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg',
      model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux',
    };
  },

  cloudflare: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('CLOUDFLARE_API_TOKEN');
    const accountId = secret('CLOUDFLARE_ACCOUNT_ID');
    if (!apiKey || !accountId) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({prompt, width, height, seed}),
    }, 1);
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const data = await response.json();
      return {buffer: Buffer.from(imageBase64(data), 'base64'), extension: 'png', model};
    }
    return {buffer: Buffer.from(await response.arrayBuffer()), extension: type.includes('png') ? 'png' : 'jpg', model};
  },

  together: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('TOGETHER_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const model = process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free';
    const response = await request('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
      body: JSON.stringify({model, prompt, width, height, seed, n: 1, response_format: 'b64_json'}),
    }, 1);
    return {buffer: Buffer.from(imageBase64(await response.json()), 'base64'), extension: 'png', model};
  },
};

export async function generateImageWithFallback({prompt, styleReference, aspectRatio = '9:16', seed = 1868}) {
  const chain = (process.env.IMAGE_PROVIDER_CHAIN || 'pollinations,together,gemini,cloudflare,openai,bfl,stability')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const errors = [];

  for (const name of chain) {
    if (deadProviders.has(`image:${name}`) || !imageProviders[name]) continue;
    try {
      console.log(`[image] trying provider: ${name}`);
      const result = await imageProviders[name]({prompt, styleReference, aspectRatio, seed});
      if (!result.buffer || result.buffer.length < 3000) throw new Error('invalid-image-bytes');
      console.log(`[image] provider succeeded: ${name}`);
      return {...result, provider: name};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[image] provider failed: ${name}: ${message.slice(0, 500)}`);
      errors.push(`${name}: ${message.slice(0, 240)}`);
      if (/secret-not-configured|401|402|403|429|quota|payment/i.test(message)) deadProviders.add(`image:${name}`);
      // Cooldown between providers to avoid rate-limit cascades
      await sleep(1500);
    }
  }

  throw new Error(`Image providers exhausted: ${errors.join(' | ')}`);
}
