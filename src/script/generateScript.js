import { GoogleGenAI, Type } from '@google/genai';
import { config, assertGemini } from '../config.js';
import {
  getRecentUsedTopics,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';

/**
 * Faz 1 — Script Üretim Motoru (Google Gemini).
 * Gemini'ye istek atıp niş içinde yeni bir konu + 30-45 sn'lik senaryo üretir.
 * Structured output için Gemini'nin responseSchema (JSON schema) desteği kullanılır,
 * böylece çıktının şeması garanti edilir.
 */

export const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: 'Kısa konu başlığı (Türkçe), tekrar kontrolü için kullanılır',
    },
    hook: {
      type: Type.STRING,
      description: 'İlk 3 saniyede izleyiciyi durduran dikkat çekici cümle',
    },
    body: {
      type: Type.STRING,
      description: 'Ana anlatım metni (seslendirilecek düz metin)',
    },
    cta: {
      type: Type.STRING,
      description: 'Kapanış / harekete geçirici cümle',
    },
    visual_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Pexels aramaları için 4-6 adet İngilizce anahtar kelime',
    },
    estimated_duration_seconds: {
      type: Type.INTEGER,
      description: 'Tahmini toplam seslendirme süresi (30-45)',
    },
  },
  required: [
    'topic',
    'hook',
    'body',
    'cta',
    'visual_keywords',
    'estimated_duration_seconds',
  ],
  // Gemini'de alan sırasını sabitlemek için önerilir.
  propertyOrdering: [
    'topic',
    'hook',
    'body',
    'cta',
    'visual_keywords',
    'estimated_duration_seconds',
  ],
};

function buildSystemPrompt() {
  return `Sen bir YouTube Shorts senaryo yazarısın. Türkçe, "ilginç bilgiler / nasıl çalışır / nasıl yapılır" temalı, 30-45 saniyelik dikey kısa video senaryoları üretirsin.

Kurallar:
- Metin akıcı, sohbet havasında ve TEK bir kişinin seslendirebileceği şekilde olmalı.
- Hook ilk 3 saniyede izleyiciyi durduracak kadar merak uyandırıcı olmalı ("Biliyor muydun...", "Şu an cebindeki telefon..." gibi).
- Body somut, şaşırtıcı ve DOĞRU bilgi içermeli; jargon yok, sade Türkçe.
- CTA kısa olmalı (ör. "Takip et, her gün yeni bir bilgi.").
- Toplam seslendirme süresi 30-45 saniye olacak şekilde uzunluğu ayarla (yaklaşık 80-120 kelime, hook+body+cta toplamı).
- visual_keywords MUTLAKA İngilizce olmalı (Pexels stok arşivi İngilizce çalışır) ve anlatılan sahnelerle eşleşmeli. 4-6 kelime.
- Emoji, hashtag veya markdown KULLANMA; sadece seslendirilecek düz metin üret.`;
}

function buildUserPrompt(avoidTopics) {
  const avoid = avoidTopics.length
    ? `Daha önce kullanılmış konular (bunları ve çok benzerlerini SEÇME):\n${avoidTopics
        .map((t) => `- ${t}`)
        .join('\n')}`
    : 'Henüz kullanılmış konu yok.';
  return `Tema: ${config.niche.theme}\n\n${avoid}\n\nYukarıdaki temaya uygun, listedekilerden farklı YENİ ve ilgi çekici bir konu seç ve senaryoyu üret.`;
}

/**
 * Yeni bir script üretir.
 * @param {object} opts
 * @param {number} [opts.maxRetries=3] - Konu tekrarı halinde yeniden deneme sayısı.
 * @returns {Promise<object>} - SCRIPT_SCHEMA'ya uygun script + normalizedTopic.
 */
export async function generateScript({ maxRetries = 3 } = {}) {
  assertGemini();
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const recent = await getRecentUsedTopics(50);
  const avoidTopics = recent.map((r) => r.topic).filter(Boolean);

  let lastScript = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: buildUserPrompt(avoidTopics),
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        responseSchema: SCRIPT_SCHEMA,
        // Kısa JSON çıktısı için "düşünme"yi kapatıyoruz: daha hızlı ve
        // ücretsiz tier kotasında daha verimli.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason || 'bilinmiyor';
      throw new Error(`Gemini boş yanıt döndü (finishReason: ${reason}).`);
    }

    const script = JSON.parse(text);
    lastScript = script;

    // Firestore aktifse konu tekrarını engelle.
    if (await isTopicUsed(script.topic)) {
      avoidTopics.push(script.topic);
      continue;
    }

    return { ...script, normalizedTopic: normalizeTopic(script.topic) };
  }

  // maxRetries sonunda hâlâ taze konu bulunamadıysa son scripti işaretleyerek döndür.
  return {
    ...lastScript,
    normalizedTopic: normalizeTopic(lastScript.topic),
    duplicate: true,
  };
}
