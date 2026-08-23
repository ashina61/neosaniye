#!/usr/bin/env node
/**
 * THE ASSET MANIFEST — what this episode still needs somebody to supply.
 *
 * The motion engine does not solve missing photography and must never try. Its
 * job when a picture is unavailable is to say so precisely enough that someone
 * else — a researcher, a licensing desk, a generator, an archive — can act on
 * it without reading the brief, the config or any of this code.
 *
 * So the manifest is written for the PERSON DOING THE SOURCING, not for the
 * pipeline. Every entry answers the questions that decide whether a candidate
 * image is usable:
 *
 *   what it is of, and why the reel needs it
 *   how it should be composed and which way up
 *   what would make it historically or scientifically wrong
 *   what an acceptable substitute looks like
 *   what would cause it to be rejected on arrival
 *
 * The last two are the ones that get missed, and they are the ones that cost
 * money: a reel about a Greek shipwreck was once illustrated with an antique
 * brass dial because nobody had written down what "close enough" excluded.
 *
 *   node scripts/asset-manifest.mjs --episode=hormuz
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {episodeDir, exists, loadConfig, parseArgs} from './lib/episode.mjs';
import {NEEDS_A_PICTURE, readSubject} from './lib/semantics.mjs';

/**
 * WHAT A LINE IN THIS DOMAIN WANTS FROM A PHOTOGRAPH.
 *
 * Not a prompt. A brief: the shot it has to serve, the framing that serves it,
 * and the failure modes for that kind of subject. Written per DOMAIN rather
 * than per topic, for the same reason the representation layer is.
 */
const BRIEF = {
  geography: {
    purpose: 'establish where this is and how the parts of it stand relative to each other',
    composition: 'high or aerial view with a clear horizon; the relation between the two sides must be legible',
    orientation: 'landscape source, croppable to 9:16 without losing the relation',
    constraints: 'the actual named place; contemporary imagery is acceptable unless the line dates it',
    substitutes: 'a comparable coastline of the same character, LABELLED as illustrative and not as the place',
    reject: 'tourist framing, visible modern signage where the line is historical, any view that hides the relation the sentence is about',
  },
  process: {
    purpose: 'show the work being done — hands, tool, material, at the moment of contact',
    composition: 'close, over the work; the tool and the material both in frame',
    orientation: 'either, with room to crop tall',
    constraints: 'period-correct tools and technique; a modern reconstruction is acceptable if captioned as one',
    substitutes: 'a living practitioner of the same craft, captioned as a modern demonstration',
    reject: 'machine tooling standing in for hand work, safety equipment in a historical scene, staged studio lighting',
  },
  material: {
    purpose: 'show the substance itself at a scale where its structure is visible',
    composition: 'macro or section; the structure is the subject, not the object it came from',
    orientation: 'either',
    constraints: 'the actual material named; a sample of the same class only if labelled',
    substitutes: 'a published micrograph or core sample photograph with its source credited',
    reject: 'a generic texture, a rendered material, anything where the structure cannot be seen',
  },
  anatomy: {
    purpose: 'show the real thing the schematic is a reconstruction of',
    composition: 'specimen or plate, evenly lit, whole structure in frame',
    orientation: 'either',
    constraints: 'anatomically correct for the species named; historical plates acceptable and preferred where the reel is historical',
    substitutes: 'a public-domain anatomical plate, credited',
    reject: 'stylised medical illustration presented as a specimen, anything gratuitous, any image of an identifiable patient',
  },
  scale: {
    purpose: 'make the size felt by putting something known beside it',
    composition: 'the object with a person or a known object in the same plane; no telephoto compression',
    orientation: 'either; the whole object must fit',
    constraints: 'the actual object named, at the site',
    substitutes: 'another object of the same order of magnitude, captioned as a comparison',
    reject: 'any framing with no scale reference in it, which is the one thing this shot exists to provide',
  },
  mechanism: {
    purpose: 'show the working parts and how they engage',
    composition: 'the mechanism exposed, parts distinguishable',
    orientation: 'either',
    constraints: 'the actual mechanism or a documented reconstruction of it',
    substitutes: 'a radiograph or a museum photograph of the same object',
    reject: 'a different mechanism of the same family — the failure this repo is named after',
  },
  elapsed: {
    purpose: 'a dated document or place that fixes the span in something real',
    composition: 'the document or the place, legible',
    orientation: 'either',
    constraints: 'the date must be verifiable',
    substitutes: 'a contemporaneous document of the same kind',
    reject: 'undated material presented as dated',
  },
};

const GENERIC = {
  purpose: 'illustrate the claim the line makes',
  composition: 'the subject clear of clutter, with room to crop to 9:16',
  orientation: 'either',
  constraints: 'must depict the thing the line names',
  substitutes: 'none — a near miss is a rejection',
  reject: 'anything that is not the subject; approximation is what this manifest exists to prevent',
};

export async function manifest(episodeId) {
  const dir = episodeDir(episodeId);
  const briefPath = path.join(dir, 'brief.json');
  const brief = (await exists(briefPath)) ? JSON.parse(await readFile(briefPath, 'utf8')) : {lines: []};
  const {config} = await loadConfig(episodeId);

  /** What is already on screen, so a supplied asset is not requested twice. */
  const supplied = new Set(
    (config.scenes ?? []).flatMap((s) => Object.values(s.assets ?? {}).map((f) => String(f).split('/').pop())),
  );

  const wanted = [];
  for (const line of brief.lines ?? []) {
    const asked = line.image || line.imageCommons?.length || line.shot?.layers?.length;
    if (!asked) continue;
    const read = readSubject(line.vo ?? '');
    const spec = BRIEF[read.domain] ?? GENERIC;
    /**
     * WHETHER THE DRAWING ALREADY COVERS IT.
     *
     * A line that got a procedural representation is not blocked — the reel
     * works — but a photograph would still make it stronger, and the manifest
     * says which of those two situations this is. A researcher with a budget
     * needs to know what to buy FIRST.
     */
    const drawn = (config.scenes ?? []).find((s) => String(s.id).includes(line.slug) && s.diagram)?.diagram ?? null;
    wanted.push({
      line: line.slug,
      says: line.vo,
      subject: read.subject ?? read.domain,
      domain: read.domain,
      /** What the reel is currently doing instead. */
      currently: drawn ? `drawn as ${drawn.type}` : 'carried by typography',
      priority: drawn ? 'would strengthen' : NEEDS_A_PICTURE.includes(read.domain) ? 'BLOCKING' : 'optional',
      searches: line.imageCommons ?? [],
      described: line.image ?? null,
      ...spec,
    });
  }

  return {
    episode: episodeId,
    generatedAt: new Date().toISOString().slice(0, 10),
    $note:
      'Written for whoever is sourcing pictures, not for the pipeline. The reel renders without any of ' +
      'these: every line here is either drawn procedurally or stated in type, and each entry says which. ' +
      'BLOCKING means the line is about something type cannot depict and no drawing covers it.',
    supplied: [...supplied],
    outstanding: wanted.length,
    blocking: wanted.filter((w) => w.priority === 'BLOCKING').length,
    wanted,
  };
}

async function main() {
  const args = parseArgs();
  const ids = typeof args.episode === 'string' ? args.episode.split(',') : [];
  if (!ids.length) {
    console.error('Usage: node scripts/asset-manifest.mjs --episode=<id>[,<id>…]');
    process.exit(1);
  }
  for (const id of ids) {
    const out = await manifest(id.trim());
    await writeFile(path.join(episodeDir(id.trim()), 'assets.required.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log(
      `✓ ${id.trim()} — ${out.outstanding} outstanding (${out.blocking} blocking), ${out.supplied.length} supplied`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
