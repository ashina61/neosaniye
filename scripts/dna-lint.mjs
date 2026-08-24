#!/usr/bin/env node
/**
 * THE SOURCE-LEVEL DNA LINT — the half of consistency a config cannot show.
 *
 * `scripts/lib/dna.mjs` audits what an episode DECIDED. This audits what the
 * engine is CAPABLE of deciding: a font stack spelled two ways, a stroke width
 * typed as a number instead of taken from the scale, a component forked instead
 * of extended. None of those appear in any config, and all of them are how a
 * design system stops being one.
 *
 *   npm run dna:lint
 *
 * It reads `engine/` only. The acquisition and casting layers do not draw.
 */
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {STROKE, TYPE} from '../visual-system/dna.mjs';
import {FORBIDDEN_NAME_PATTERNS, findComponent} from '../visual-system/components.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENGINE = path.join(ROOT, 'engine');

async function sources(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(full)));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !entry.name.includes('.generated.')) out.push(full);
  }
  return out;
}

/** Strip comments so a font stack quoted in prose is not reported as code. */
function code(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const findings = [];
const note = (level, file, what) => findings.push({level, file: path.relative(ROOT, file), what});

const files = await sources(ENGINE);

/* ------------------------------------------------------------- TYPOGRAPHY */

/**
 * A FONT STACK IS SPELLED ONCE.
 *
 * `sheet.tsx` exports MONO, SANS and SERIF. Any other file writing a stack
 * inline has forked the typography — and the two spellings of the mono stack
 * that this found were a real fork: `"Courier New", ui-monospace, monospace`
 * in one place and `"Courier New", monospace` in another.
 */
const KNOWN_STACKS = new Set(Object.values(TYPE.families));
/**
 * ONE DELIBERATE EXCEPTION: the MISSING TEMPLATE card. It is an error state and
 * it is supposed NOT to look like the channel — a diagnostic that blends in is
 * a diagnostic nobody sees. Exempted by name so the exemption is a decision
 * rather than a gap.
 */
const OFF_SYSTEM_BY_DESIGN = ['MissingTemplate'];

for (const file of files) {
  const raw = await readFile(file, 'utf8');
  const body = code(raw);
  if (file.endsWith('sheet.tsx')) continue;
  if (OFF_SYSTEM_BY_DESIGN.some((name) => raw.includes(`const ${name}:`))) continue;
  for (const match of body.matchAll(/fontFamily:\s*(['"`])([^'"`]*(?:serif|sans-serif|monospace)[^'"`]*)\1/g)) {
    const stack = match[2];
    if (!KNOWN_STACKS.has(stack)) {
      note('error', file, `font stack written inline: "${stack}" — import MONO/SANS/SERIF from draw/sheet.tsx (TYPE.families)`);
    }
  }
}

/* ----------------------------------------------------------------- STROKE */

/**
 * FOUR WEIGHTS, FROM THE FRAME.
 *
 * A literal `strokeWidth={4}` is a fifth weight that nobody agreed to, and it
 * does not scale with the frame — so it is a different weight at 1080 and at
 * 2160. `weights(w)` exists precisely so the scale survives a resolution
 * change.
 */
const SCALE_VALUES = new Set(Object.values(STROKE).filter((v) => typeof v === 'number' && v > 0));
for (const file of files) {
  const body = code(await readFile(file, 'utf8'));
  /**
   * THE HAND-MARK REGISTER IS A KNOWN DEVIATION, NOT A MYSTERY.
   *
   * Reported once per file with its reason and its remedy, rather than sixteen
   * times as an anonymous number. A check that repeats itself is a check people
   * filter out, and the deviation is already recorded in the DNA.
   */
  const marker = STROKE.registers.marker.files.some((f) => file.endsWith(f));
  const literals = [...body.matchAll(/strokeWidth=\{(\d+(?:\.\d+)?)\}/g)];
  if (literals.length && marker) {
    note(
      'deviation',
      file,
      `hand-mark register, ${STROKE.registers.marker.status} since ${STROKE.registers.marker.since}: ` +
        `${STROKE.registers.marker.why} — ${STROKE.registers.marker.remediation}`,
    );
  } else if (literals.length) {
    note(
      'warning',
      file,
      `${literals.length} literal strokeWidth value(s) (${[...new Set(literals.map((m) => m[1]))].join(', ')}) — ` +
        `the scale is weights(w) with four steps (STROKE); a literal does not survive a frame-size change`,
    );
  }
  /**
   * An ad-hoc fraction OF THE FRAME is a fifth weight in disguise. A fraction
   * of an existing step — `line.detail * 0.6` — is not: that is one of the four
   * weights being modulated, which is what the scale is for.
   */
  if (marker) continue;
  for (const match of body.matchAll(/strokeWidth=\{(?:w|width) \* (0\.\d+)\}/g)) {
    const value = Number(match[1]);
    if (![...SCALE_VALUES].some((v) => Math.abs(v - value) < 0.0002)) {
      note('warning', file, `stroke width ${match[1]}× frame is not one of the four steps (STROKE)`);
    }
  }
}

/* -------------------------------------------------------------- COMPONENTS */

/**
 * NO FORKS, AND NO TWO COMPONENTS WITH ONE NAME.
 *
 * The forbidden patterns catch the fork-by-naming (`Arrow2`, `BetterArrow`).
 * The collision check catches the subtler one: two files exporting different
 * components under the same name, which is what `Rays` was — a static
 * full-frame sunburst in `Field.tsx` and a rotating positioned motif in
 * `Motif.tsx`. Both are legitimate; sharing a name is not.
 */
const declared = new Map();
for (const file of files) {
  const body = await readFile(file, 'utf8');
  for (const match of body.matchAll(/^(?:export )?const ([A-Z][A-Za-z0-9]*): React\.FC/gm)) {
    const name = match[1];
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push(file);
  }
}
for (const [name, where] of declared) {
  for (const pattern of FORBIDDEN_NAME_PATTERNS) {
    if (pattern.test(name)) {
      note('error', where[0], `"${name}" is a fork-by-naming — extend the component it duplicates instead`);
      break;
    }
  }
  if (where.length > 1) {
    note(
      'warning',
      where[0],
      `"${name}" is declared in ${where.length} files (${where.map((f) => path.basename(f)).join(', ')}) — ` +
        `two components with one name; rename the more specific one`,
    );
  }
}

/**
 * AND EVERY EXPORTED COMPONENT IS IN THE REGISTRY.
 *
 * Not to police new work, but so that the next episode's author can find it. A
 * component nobody can discover gets rebuilt.
 */
for (const file of files) {
  const body = await readFile(file, 'utf8');
  for (const match of body.matchAll(/^export const ([A-Z][A-Za-z0-9]*): React\.FC/gm)) {
    if (!findComponent(match[1])) {
      note('warning', file, `"${match[1]}" is exported but not in visual-system/components.mjs — undiscoverable components get rebuilt`);
    }
  }
}

/* -------------------------------------------------------------------- OUT */

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warning');
const deviations = findings.filter((f) => f.level === 'deviation');

console.log(`\nVISUAL DNA LINT — engine/ (${files.length} files)\n${'─'.repeat(78)}`);
for (const f of [...errors, ...warnings, ...deviations]) {
  console.log(`  ${{error: 'ERROR', warning: 'warn ', deviation: 'known'}[f.level]}  ${f.file}`);
  console.log(`         ${f.what}`);
}
if (!findings.length) console.log('  clean');
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s), ${deviations.length} recorded deviation(s)\n`);
process.exitCode = errors.length ? 1 : 0;
