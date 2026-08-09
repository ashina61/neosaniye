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

export const fontSizes = {
  hero:    120,
  title:   80,
  heading: 56,
  body:    38,
  caption: 26,
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
