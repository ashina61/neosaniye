export const fps = 30

export const formats = {
  portrait:  { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square:    { width: 1080, height: 1080 },
}

export const themes = {
  dark: {
    bg:      '#0a0a0a',
    text:    '#ffffff',
    accent:  '#f5c518',
    muted:   '#666666',
    surface: '#1a1a1a',
  },
  light: {
    bg:      '#f8f8f8',
    text:    '#0a0a0a',
    accent:  '#e63946',
    muted:   '#999999',
    surface: '#eeeeee',
  },
  neon: {
    bg:      '#04040f',
    text:    '#ffffff',
    accent:  '#00ffcc',
    muted:   '#7b61ff',
    surface: '#0d0d2b',
  },
  paper: {
    bg:      '#f5f0e8',
    text:    '#1a1008',
    accent:  '#c9541a',
    muted:   '#8a7560',
    surface: '#ede8df',
  },
  brutal: {
    bg:      '#ffffff',
    text:    '#000000',
    accent:  '#ff0000',
    muted:   '#555555',
    surface: '#f0f0f0',
  },
}

/**
 * Type sizes AS DRAWN IN A 1920×1080 FRAME. Never used raw by a template —
 * see `typeScaleFor` below and the `useType` hook.
 */
export const fontSizes = {
  hero:    120,
  title:   80,
  heading: 56,
  body:    38,
  caption: 26,
}

/**
 * TYPE IS SIZED BY THE FRAME IT LIVES IN.
 *
 * A pixel size is only meaningful next to the frame around it. 56px of body
 * copy fills a comfortable measure across 1920; the same 56px in a 1080-wide
 * vertical reel is a caption floating in the middle of the screen with two
 * thirds of the frame empty above and below it — which is exactly what the
 * first portrait render came out as.
 *
 * Vertical is not just "narrower". It is watched at arm's length on a phone,
 * one line at a time, so its type is proportionally MUCH larger than the same
 * design in landscape. That is a format decision, not a per-template one, so it
 * lives here and every template asks for it the same way.
 *
 * The scale is derived from the frame's own aspect ratio rather than a format
 * NAME, so a composition registered at any size gets the right answer without
 * the template ever learning what "portrait" means.
 */
export const typeScaleFor = (width: number, height: number) => {
  const ratio = width / height
  if (ratio < 0.85) return 1.55
  if (ratio > 1.25) return 1
  return 1.28
}

export const fontFamilies = {
  display: 'Bebas Neue',
  body:    'DM Sans',
  mono:    'JetBrains Mono',
}

export const easings = {
  snap:   [0.19, 1, 0.22, 1] as const,
  bounce: [0.34, 1.56, 0.64, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
}
