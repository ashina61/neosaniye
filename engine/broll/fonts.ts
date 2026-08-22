/**
 * THE TYPEFACE, SHIPPED RATHER THAN HOPED FOR.
 *
 * Every caption in this engine asked for `"Archivo Black", "Arial Black",
 * Arial, sans-serif` and got the last one. This machine has Liberation Sans
 * and DejaVu and nothing heavier than Bold, so a headline set at weight 900
 * came out as a normal-weight sans at ninety pixels — which is exactly what
 * "the design has no life in it" looks like. A documentary title is carried by
 * the WEIGHT of the type; asking for a face that is not installed and letting
 * the browser choose the fallback is not a typographic decision, it is the
 * absence of one.
 *
 * Loading it from Google's CDN at render time is not an option either: the
 * font host is outside this machine's egress policy, and a film whose titles
 * depend on a network call is a film that renders differently on a bad day.
 *
 * So the files come from npm and are bundled. `latin-ext` is not optional —
 * it is the subset that carries ğ, ş, ı, İ, ç, ö and ü, and a Turkish reel set
 * in `latin` alone loses a glyph in almost every headline.
 */
import blackExt from '@fontsource/archivo-black/files/archivo-black-latin-ext-400-normal.woff2';
import black from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2';
import boldExt from '@fontsource/archivo/files/archivo-latin-ext-700-normal.woff2';
import bold from '@fontsource/archivo/files/archivo-latin-700-normal.woff2';
import semiExt from '@fontsource/archivo/files/archivo-latin-ext-600-normal.woff2';
import semi from '@fontsource/archivo/files/archivo-latin-600-normal.woff2';

export const DISPLAY = '"Archivo Black", "Arial Black", Arial, sans-serif';
export const TEXT = '"Archivo", Arial, sans-serif';

const face = (family: string, weight: number, url: string, range?: string) =>
  `@font-face{font-family:${family};font-style:normal;font-weight:${weight};font-display:block;src:url(${url}) format('woff2');${
    range ? `unicode-range:${range};` : ''
  }}`;

/** The Latin Extended-A block, which is where the Turkish letters live. */
const EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export const FONT_CSS = [
  face('"Archivo Black"', 400, blackExt, EXT),
  face('"Archivo Black"', 400, black),
  face('"Archivo"', 700, boldExt, EXT),
  face('"Archivo"', 700, bold),
  face('"Archivo"', 600, semiExt, EXT),
  face('"Archivo"', 600, semi),
].join('');

let injected = false;

/**
 * Injected once per bundle rather than rendered as a <style> inside a
 * component: a face that mounts and unmounts with a scene can be missing on
 * the first frame of a shot and present on the second, and the caption then
 * REFLOWS mid-cut. `font-display: block` is the other half of that — a
 * fallback drawn for three frames before the real face arrives is a flicker
 * nobody can explain later.
 */
export function useFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = FONT_CSS;
  document.head.appendChild(style);
}
