import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { getVideosWithYouTube } from '../lib/firestore.js';
import { generateWithRetry } from '../script/generateScript.js';

/**
 * ORKESTRA — Baş Analist (veri şefi).
 *
 * Geçmiş videoların İZLENME verisini format / görsel stil / kategoriye göre
 * toplar ve tüm orkestraya (yazar + görüntü yönetmeni + kurgucu) yön veren kısa
 * bir "strateji notu" üretir. Böylece şefler körlemesine değil, NEYİN TUTTUĞUNA
 * göre karar verir — öğrenme döngüsünün eksik halkası buydu.
 *
 * Kota-cimri: yalnızca yeterli veri (>=6 izlenen video) varsa TEK bir Gemini
 * çağrısı yapar. Düşerse mekanik nota (en iyi format/stil/kategori) düşer;
 * o da yoksa null döner ve sistem eskisi gibi çalışır. Boru hattı kırılmaz.
 */

const MIN_VIDEOS = 6;

const ANALYST_SYSTEM = `You are the DATA ANALYST for a faceless YouTube Shorts channel.
You receive average view counts grouped by content FORMAT, VISUAL STYLE, and TOPIC CATEGORY.
Output ONLY a 2-3 sentence, concrete production directive for the NEXT video: which formats,
visual styles, moods and topic types to favor (and which to avoid), based strictly on the data.
Be specific and actionable. No preamble, no bullet points, no restating the numbers.`;

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

/** Videoları bir anahtara göre grupla → [{key, count, avgViews}] (izlenme sıralı). */
function groupStat(videos, keyFn) {
  const m = {};
  for (const v of videos) {
    const k = String(keyFn(v) || '').trim() || 'unknown';
    (m[k] = m[k] || []).push(v.stats.views);
  }
  return Object.entries(m)
    .map(([key, views]) => ({ key, count: views.length, avgViews: avg(views) }))
    .filter((x) => x.key !== 'unknown')
    .sort((a, b) => b.avgViews - a.avgViews);
}

/** İzlenme verisini format/stil/kategori kırılımına çevirir. */
export function buildDigest(videos) {
  return {
    total: videos.length,
    byFormat: groupStat(videos, (v) => v.format || v.script?.format),
    byStyle: groupStat(videos, (v) => v.visualStyle),
    byCategory: groupStat(videos, (v) => v.script?.category),
  };
}

function digestToText(d) {
  const line = (arr) =>
    arr.length ? arr.map((x) => `${x.key}: ${x.avgViews} avg (${x.count})`).join(', ') : 'no data';
  return (
    `Videos analyzed: ${d.total}\n` +
    `By format — ${line(d.byFormat)}\n` +
    `By visual style — ${line(d.byStyle)}\n` +
    `By topic category — ${line(d.byCategory)}`
  );
}

/** Gemini düşerse: en iyi format/kategori/stilden mekanik nota. */
function mechanicalBrief(d) {
  const parts = [];
  if (d.byFormat[0]) parts.push(`the "${d.byFormat[0].key}" format performs best (${d.byFormat[0].avgViews} avg views)`);
  if (d.byCategory[0]) parts.push(`"${d.byCategory[0].key}" topics resonate most`);
  if (d.byStyle[0] && d.byStyle.length > 1) parts.push(`"${d.byStyle[0].key}" visuals do slightly better`);
  return parts.length ? `Favor ${parts.join('; ')}.` : '';
}

/**
 * @returns {Promise<{brief:string, digest:object}|null>}
 */
export async function analyzePerformance() {
  try {
    const vids = (await getVideosWithYouTube(60)).filter((v) => v.stats?.views > 0);
    if (vids.length < MIN_VIDEOS) return null; // yeterli veri yok, körlemesine devam

    const digest = buildDigest(vids);
    const mech = mechanicalBrief(digest);
    if (!config.gemini.apiKey) return mech ? { brief: mech, digest } : null;

    try {
      const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
      const resp = await generateWithRetry(
        ai,
        {
          model: config.gemini.model,
          contents: `Performance data for our channel:\n${digestToText(digest)}\n\nWrite the directive.`,
          config: { systemInstruction: ANALYST_SYSTEM, thinkingConfig: { thinkingBudget: 0 } },
        },
        3,
      );
      const brief = String(resp.text || '').trim().replace(/\s+/g, ' ').slice(0, 400);
      return { brief: brief || mech, digest };
    } catch {
      return mech ? { brief: mech, digest } : null;
    }
  } catch {
    return null;
  }
}
