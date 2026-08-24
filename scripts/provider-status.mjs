#!/usr/bin/env node
/**
 * WHO IS ACTUALLY REACHABLE FROM HERE.
 *
 *   npm run assets:providers
 *
 * Three seconds, no episode, no downloads. Worth its own command because the
 * answer changes with the environment rather than with the code, and because
 * the first question anybody asks about an acquisition run that found nothing
 * is whether it ever made a request.
 */
import {preflight} from '../acquire/providers/index.mjs';
import {generationConfigured, usableRungs} from '../acquire/ladder.mjs';

const availability = await preflight();

console.log('PROVIDERS\n');
for (const p of availability) {
  const mark = p.available ? '  ok  ' : ' DOWN ';
  const note = p.available ? p.detail ?? '' : `${p.reason ?? p.why}`;
  console.log(`${mark}${p.id.padEnd(11)} ${p.name.padEnd(30)} ${String(p.ms).padStart(5)}ms  ${note}`);
  if (!p.available && p.detail) console.log(`${' '.repeat(19)}${p.detail}`);
}

console.log('\nLADDER\n');
for (const rung of usableRungs(availability)) {
  const mark = rung.usable ? '  ok  ' : ' DOWN ';
  console.log(`${mark}${rung.n}. ${rung.label.padEnd(36)} ${rung.usable ? (rung.live ?? []).join(', ') : rung.because ?? ''}`);
}

const up = availability.filter((p) => p.available).length;
console.log(
  `\n${up}/${availability.length} provider(s) reachable · ` +
    `image generation ${generationConfigured() ? 'configured' : 'not configured'}`,
);
if (!up) process.exitCode = 0;
