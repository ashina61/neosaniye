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
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < attempts) {
        await sleep(retryDelay(response, body));
        lastError = error;
        continue;
      }
      throw error;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || String(error?.message || '').match(/HTTP\s+(\d{3})/)?.[1] || 0);
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
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Provider did not return JSON: ${source.slice(0, 500)}`);
  return JSON.parse(source.slice(start, end + 1));
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

function geminiImage(payload) {
  if (typeof payload?.output_image?.data === 'string') return payload.output_image.data;

  const imageBlock = walk(payload, (value) => Boolean(
    value &&
    typeof value === 'object' &&
    value.type === 'image' &&
    typeof value.data === 'string',
  ));
  if (imageBlock?.data) return imageBlock.data;

  const inlineBlock = walk(payload, (value) => Boolean(
    value &&
    typeof value === 'object' &&
    (typeof value?.inlineData?.data === 'string' || typeof value?.inline_data?.data === 'string'),
  ));
  if (inlineBlock?.inlineData?.data) return inlineBlock.inlineData.data;
  if (inlineBlock?.inline_data?.data) return inlineBlock.inline_data.data;

  throw new Error(`Gemini response contained no image: ${JSON.stringify(payload).slice(0, 600)}`);
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
    headers: {'HTTP-Referer': 'https://github.com/ashina61/neosaniye', 'X-Title': 'NeoSaniye'},
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
  return ({'9:16': {width: 768, height: 1344}, '4:5': {width: 1024, height: 1280}, '1:1': {width: 1024, height: 1024}})[aspectRatio] || {width: 768, height: 1344};
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
    return {buffer: Buffer.from(geminiImage(await response.json()), 'base64'), extension: 'jpg', model};
  },
  pollinations: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('POLLINATIONS_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const params = new URLSearchParams({model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux', width: String(width), height: String(height), seed: String(seed), nologo: 'true'});
    const response = await request(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params}`, {
      headers: {authorization: `Bearer ${apiKey}`, accept: 'image/*'},
    }, 1);
    return {buffer: Buffer.from(await response.arrayBuffer()), extension: (response.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg', model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux'};
  },
  cloudflare: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('CLOUDFLARE_API_TOKEN');
    const accountId = secret('CLOUDFLARE_ACCOUNT_ID');
    if (!apiKey || !accountId) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST', headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'}, body: JSON.stringify({prompt, width, height, seed}),
    }, 1);
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const data = await response.json();
      if (!data?.result?.image) throw new Error('Cloudflare returned no image.');
      return {buffer: Buffer.from(data.result.image, 'base64'), extension: 'png', model};
    }
    return {buffer: Buffer.from(await response.arrayBuffer()), extension: type.includes('png') ? 'png' : 'jpg', model};
  },
  together: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('TOGETHER_API_KEY');
    if (!apiKey) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const model = process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free';
    const response = await request('https://api.together.xyz/v1/images/generations', {
      method: 'POST', headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'}, body: JSON.stringify({model, prompt, width, height, seed, n: 1, response_format: 'b64_json'}),
    }, 1);
    const data = await response.json();
    if (!data?.data?.[0]?.b64_json) throw new Error('Together returned no image.');
    return {buffer: Buffer.from(data.data[0].b64_json, 'base64'), extension: 'png', model};
  },
  huggingface: async ({prompt, aspectRatio, seed}) => {
    const apiKey = secret('HUGGINGFACE_API_KEY', 'HF_TOKEN');
    if (!apiKey) throw new Error('secret-not-configured');
    const {width, height} = dimensions(aspectRatio);
    const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
    const response = await request(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST', headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'image/*'}, body: JSON.stringify({inputs: prompt, parameters: {width, height, seed, num_inference_steps: 4}}),
    }, 1);
    const type = response.headers.get('content-type') || '';
    return {buffer: Buffer.from(await response.arrayBuffer()), extension: type.includes('png') ? 'png' : 'jpg', model};
  },
};

export async function generateImageWithFallback({prompt, styleReference, aspectRatio = '9:16', seed = 1868}) {
  const chain = (process.env.IMAGE_PROVIDER_CHAIN || 'gemini,pollinations,cloudflare,together,huggingface')
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
      if (/secret-not-configured|401|403|429|quota|payment/i.test(message)) deadProviders.add(`image:${name}`);
    }
  }

  throw new Error(`Image providers exhausted: ${errors.join(' | ')}`);
}
