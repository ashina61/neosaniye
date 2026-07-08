/**
 * Üretim bildirimi (best-effort, asla boru hattını kırmaz).
 *
 * Yapılandırma (.env / GitHub Secrets-Variables):
 *   - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *     (BotFather'dan bot aç, token'ı al; chat id için bota mesaj atıp
 *      api.telegram.org/bot<TOKEN>/getUpdates ile "chat":{"id":...} değerini oku)
 *   - Discord: DISCORD_WEBHOOK_URL (kanal ayarları -> Integrations -> Webhook)
 * İkisi de tanımlıysa ikisine de gönderir; hiçbiri yoksa sessizce atlar.
 */

async function post(url, body, headers = { 'content-type': 'application/json' }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
}

/** @param {string} text - düz metin mesaj (Telegram + Discord'a gider). */
export async function notify(text) {
  const tasks = [];

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) {
    tasks.push(
      post(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        chat_id: tgChat,
        text,
        disable_web_page_preview: false,
      }).catch(() => false),
    );
  }

  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (discord) {
    tasks.push(post(discord, { content: text.slice(0, 1900) }).catch(() => false));
  }

  if (!tasks.length) return false;
  const results = await Promise.all(tasks);
  return results.some(Boolean);
}
