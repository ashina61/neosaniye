// Generates a script for a YouTube Shorts video using AI providers
// Uses OpenRouter to call various LLMs for script generation
// Fallback: If AI providers fail, uses local pre-written scripts

import { readJson, writeJson } from '../util/jsonHandler.js';
import { getEnvelope } from '../util/envelope.js';
import { log } from '../util/logger.js';
import { pickFallbackScript } from './fallback-scripts.js';

const CONFIG_PATT = '../../config/scriptConfig.json';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(messages, model, maxTokens = 500) {
  const apiKey = getEnvelope('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status}`);

  const data = await response.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) throw new Error('OpenRouter returned empty response');

  return choice;
}

async function generateScript(topic, style, duration = 60) {
  const config = readJson(CONFIG_PATH);
  const prompt = `
You are a YouTube Shorts scriptwriter. Write a script for a ${duration}-second video.

Topic: ${topic}
Style: ${style}

Requirements:
- Hook in first 3 seconds
- Clear beginning, middle, and end
-  Call-to-action at the end
- Natural, conversational tone
- Only return the script, no extra text
`;

  try {
    const script = await callOpenRouter([
      { role: 'system', content: 'You are a YouTube Shorts scriptwriter.' },
      { role: 'user', content: prompt },
    ], config.model, config.maxTokens);

    return {
      script,
      metadata: {
        topic,
        style,
        duration,
        generatedAt: new Date().toISOString(),
        provider: 'openrouter',
      },
    };
  } catch (error) {
    log(`SCRIPT GENERATION FAILED: ${error.message}`, 'ERROR');
    log('Falling back to local pre-written scripts...', 'WARN');

    // Use fallback script from local pool
    const fallback = pickFallbackScript(topic, style);
    return {
      script: fallback.script,
      metadata: {
        topic,
        style,
        duration,
        generatedAt: new Date().toISOString(),
        provider: 'fallback',
        fallbackReason: error.message,
      },
    };
  }
}

export { generateScript };