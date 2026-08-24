/**
 * WHAT WE ARE ALLOWED TO USE, AND WHAT WE OWE FOR IT.
 *
 * "Free" on an archive means free as in speech, not free as in nobody has to be
 * told. Most of Wikimedia Commons is CC BY or CC BY-SA, both of which REQUIRE
 * credit wherever the work is published — and a reel is published. So the
 * decision here is not "may we download this" but "may we publish a derivative
 * of this, and what has to travel with it".
 *
 * Two refusals are absolute:
 *
 *   NON-COMMERCIAL. A reel may be monetised, and even when it is not, the
 *       licence is decided at publication, not at intent.
 *   NO-DERIVATIVES. A reel crops, pushes, grades and overlays. Every one of
 *       those is a derivative work.
 *
 * And one rule that exists because it is the easy thing to get wrong:
 * **never record an asset as public domain without provenance.** A file with no
 * stated source is not public domain, it is a file with no stated source, and
 * the difference is the whole of the risk.
 */

/** Free enough to publish a derivative of, given credit where required. */
const FREE = [
  [/^(cc0|public[\s-]?domain|pd([\s-]|$)|pd-old|pd-us|no known copyright|nkc)/i, {needsCredit: false, family: 'public-domain'}],
  [/^cc[\s-]?by[\s-]?sa/i, {needsCredit: true, family: 'cc-by-sa'}],
  [/^cc[\s-]?by(?![\s-]?(nc|nd))/i, {needsCredit: true, family: 'cc-by'}],
  [/^attribution(?![\s-]?(non|no))/i, {needsCredit: true, family: 'cc-by'}],
  [/^(pexels|pixabay|unsplash)[\s-]?licen[cs]e/i, {needsCredit: true, family: 'stock-free'}],
];

/** Refused outright, whatever else the page says about it. */
const REFUSED = [
  [/non[\s-]?commercial|[\s-]nc[\s-]|cc[\s-]?by[\s-]?nc|by-nc/i, 'non-commercial: a reel may be monetised and the licence is decided at publication'],
  [/no[\s-]?derivat|[\s-]nd[\s-]|cc[\s-]?by[\s-]?nd|by-nd/i, 'no-derivatives: a reel crops, pushes, grades and overlays'],
  [/fair[\s-]?use/i, 'fair use is a defence, not a licence'],
  [/all rights reserved|©|\(c\)\s*\d{4}/i, 'all rights reserved'],
  [/copyrighted|copyright,/i, 'asserted copyright with no free licence'],
];

export const LICENCE_REQUIREMENT =
  'free for commercial use and for derivative works; credit recorded where the licence requires it';

/**
 * Decide a licence, and say why.
 *
 * Order matters: the refusals run FIRST, because "CC BY-NC-SA 4.0" matches the
 * CC-BY family on a naive read and is exactly the licence we may not use.
 */
export function judgeLicence({licence, licenceUrl, source, sourceUrl, creator}) {
  const text = `${licence ?? ''} ${licenceUrl ?? ''}`.trim();
  /**
   * A CONTRADICTION IN THE RECORD IS A REFUSAL, not a tie broken in our favour.
   *
   * One file in this repository's own corpus carries the licence "CC BY 2.0"
   * and the author string "All rights reserved, Julian Watters". Those two
   * cannot both be true, and the pipeline does not get to pick the convenient
   * one. Somebody has to look at the source page and write down what it
   * actually says.
   */
  if (creator && /all rights reserved|©|\(c\)\s*\d{4}/i.test(String(creator))) {
    return {
      ok: false,
      why: `the licence says "${licence}" and the author field says "${creator}" — a contradictory record has to be resolved by a person, not guessed`,
      family: null,
      needsCredit: true,
    };
  }
  if (!text) {
    return {ok: false, why: 'no licence stated — an asset with no licence is not an asset we may publish', family: null, needsCredit: true};
  }
  for (const [pattern, why] of REFUSED) {
    if (pattern.test(text)) return {ok: false, why, family: null, needsCredit: true};
  }
  for (const [pattern, rule] of FREE) {
    if (pattern.test(text.trim())) {
      /**
       * PUBLIC DOMAIN NEEDS PROVENANCE MORE THAN ANY OTHER CLAIM, not less.
       * Anything else at least names a licensor; "public domain" names nobody,
       * so the only thing standing behind it is where we got it.
       */
      if (rule.family === 'public-domain' && !(source && sourceUrl)) {
        return {
          ok: false,
          why: 'claimed public domain with no source and source URL — provenance is the only thing that claim rests on',
          family: null,
          needsCredit: true,
        };
      }
      if (rule.needsCredit && !creator && rule.family !== 'stock-free') {
        return {
          ok: false,
          why: `${rule.family} requires attribution and no creator was recorded`,
          family: rule.family,
          needsCredit: true,
        };
      }
      return {ok: true, why: null, family: rule.family, needsCredit: rule.needsCredit};
    }
  }
  return {ok: false, why: `licence not recognised as free: "${licence}"`, family: null, needsCredit: true};
}

/** One credit line, in the form a licence actually asks for. */
export function creditLine(record) {
  const bits = [];
  bits.push(record.creator ? `${record.creator}` : 'Unknown author');
  if (record.title) bits.push(`*${record.title}*`);
  bits.push(record.licence ?? 'licence unrecorded');
  const where = record.sourceUrl ? `[${record.source}](${record.sourceUrl})` : record.source ?? 'source unrecorded';
  return `${bits.join(' — ')} — ${where}`;
}
