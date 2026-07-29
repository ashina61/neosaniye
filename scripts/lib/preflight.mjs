const STORY_REQUIREMENTS = {
  gemini: [['GEMINI_API_KEY', 'GOOGLE_API_KEY']],
  groq: [['GROQ_API_KEY']],
  cerebras: [['CEREBRAS_API_KEY']],
  'github-models': [['GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN']],
  mistral: [['MISTRAL_API_KEY']],
  cloudflare: [['CLOUDFLARE_API_TOKEN'], ['CLOUDFLARE_ACCOUNT_ID']],
  openrouter: [['OPENROUTER_API_KEY']],
};

const IMAGE_REQUIREMENTS = {
  gemini: [['GEMINI_API_KEY', 'GOOGLE_API_KEY']],
  openai: [['OPENAI_API_KEY']],
  bfl: [['BFL_API_KEY', 'FLUX_API_KEY']],
  stability: [['STABILITY_API_KEY']],
  pollinations: [],
  cloudflare: [['CLOUDFLARE_API_TOKEN'], ['CLOUDFLARE_ACCOUNT_ID']],
  together: [['TOGETHER_API_KEY']],
};

const configured = (env, alternatives) => alternatives.some((name) => typeof env[name] === 'string' && env[name].trim());

export function commandVersionArguments(command) {
  return command === 'ffmpeg' || command === 'ffprobe' ? ['-version'] : ['--version'];
}

function providerStatus(chain, requirements, env) {
  return chain.map((name) => {
    const groups = requirements[name];
    if (!groups) return {name, available: false, reason: 'unsupported-provider'};
    const missing = groups.filter((group) => !configured(env, group));
    return {name, available: missing.length === 0, ...(missing.length ? {reason: `missing:${missing.map((group) => group.join('|')).join(',')}`} : {})};
  });
}

export function evaluatePreflight({env, commands, styleReference}) {
  const storyChain = String(env.STORY_PROVIDER_CHAIN || 'gemini,groq,cerebras,github-models,mistral,cloudflare,openrouter')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const imageChain = String(env.IMAGE_PROVIDER_CHAIN || 'pollinations,together,gemini,cloudflare,openai,bfl,stability')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const storyProviders = providerStatus(storyChain, STORY_REQUIREMENTS, env);
  const imageProviders = providerStatus(imageChain, IMAGE_REQUIREMENTS, env);
  const tools = ['edge-tts', 'ffmpeg', 'ffprobe'].map((name) => ({name, available: Boolean(commands[name])}));
  const style = {
    available: Buffer.isBuffer(styleReference) && styleReference.length >= 1000,
    bytes: Buffer.isBuffer(styleReference) ? styleReference.length : 0,
  };
  const errors = [];
  if (!storyProviders.some((provider) => provider.available)) errors.push('No configured story provider is available.');
  if (!imageProviders.some((provider) => provider.available)) errors.push('No configured image provider is available.');
  for (const tool of tools) if (!tool.available) errors.push(`Required command is missing: ${tool.name}.`);
  if (!style.available) errors.push('Style reference is missing or invalid.');
  return {ok: errors.length === 0, storyProviders, imageProviders, tools, style, errors};
}
