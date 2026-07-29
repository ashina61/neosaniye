import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

/**
 * Remotion normalde kendi Chromium'unu remotion.media'dan indirir. Bu ortamın
 * ağ politikası o hostu 403'lüyor, ama makinede kullanılabilir bir Chromium
 * zaten var. REMOTION_BROWSER ile üzerine yazılabilir; yoksa ortamdaki
 * headless shell kullanılır. Değer yalnızca dosya gerçekten varsa uygulanır,
 * böylece Chromium'u kendi indirebilen makinelerde bu ayar yolu bozmaz.
 */
import {existsSync} from 'node:fs';

const candidates = [
  process.env.REMOTION_BROWSER,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter((p): p is string => typeof p === 'string' && p.length > 0);

const browser = candidates.find((p) => existsSync(p));
if (browser) Config.setBrowserExecutable(browser);
