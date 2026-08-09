import { continueRender, delayRender, staticFile } from "remotion"

/**
 * FONTS ARE SERVED FROM /public, NOT FROM GOOGLE.
 *
 * @remotion/google-fonts injects @font-face rules pointing at fonts.gstatic.com,
 * which means every render — local, CI, or cloud — depends on the renderer being
 * able to reach Google over TLS it trusts. Behind a proxy it cannot: Chromium
 * refuses the certificate, the fetch fails, and the still comes out either blank
 * or in a fallback face with completely different metrics. A video whose type
 * silently changes size depending on the network is not a video you can render
 * twice.
 *
 * So the woff2 files live in public/fonts/ and are referenced with staticFile().
 * latin + latin-ext are both included: Turkish needs ı (latin) and ğ ş İ
 * (latin-ext), and dropping the second subset is how you get a reel with tofu
 * boxes in half the words.
 *
 * font-display: block, not swap — a swap means the first frames render in the
 * fallback face and the type jumps mid-shot. Blocking is correct for video.
 *
 * The render is held with delayRender() until the faces are actually loaded, so
 * frame 0 is never measured against a fallback.
 */
const css = `
  @font-face {
    font-family: "Bebas Neue";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/bebas-neue-400-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "Bebas Neue";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/bebas-neue-400-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-400-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-400-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-500-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 500;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-500-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-700-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile("fonts/dm-sans-700-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/jetbrains-mono-400-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(${staticFile("fonts/jetbrains-mono-400-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile("fonts/jetbrains-mono-700-latin-ext.woff2")}) format("woff2");
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url(${staticFile("fonts/jetbrains-mono-700-latin.woff2")}) format("woff2");
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
`

const style = document.createElement("style")
style.textContent = css
document.head.appendChild(style)

/**
 * THE WAIT IS BOUNDED, IN BOTH DIRECTIONS.
 *
 * A render opens several browser pages and restarts a worker when one dies; on
 * a restarted, throttled page `document.fonts.load` can take longer than
 * Remotion's default 28s delayRender budget, and then the whole render fails at
 * whatever frame that worker happened to be on — frame 437 of 1650, with no
 * indication that fonts were the cause.
 *
 * So two changes: a longer budget, and a hard floor. The faces are local files
 * a few kilobytes each; if they are not ready in ten seconds they are not
 * coming, and rendering the frame in the fallback face is a far better outcome
 * than failing the render. `settle` is idempotent, because calling
 * continueRender twice on one handle is itself an error.
 */
const handle = delayRender("Loading local fonts", { timeoutInMilliseconds: 120000 })

let settled = false
const settle = () => {
  if (settled) return
  settled = true
  continueRender(handle)
}

setTimeout(settle, 10000)

Promise.all(
  [
    "400 100px \"Bebas Neue\"",
    "400 100px \"DM Sans\"",
    "500 100px \"DM Sans\"",
    "700 100px \"DM Sans\"",
    "400 100px \"JetBrains Mono\"",
    "700 100px \"JetBrains Mono\""
  ].map((font) => document.fonts.load(font)),
)
  .then(settle)
  .catch(settle)
