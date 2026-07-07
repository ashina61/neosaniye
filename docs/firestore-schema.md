# Firestore Şeması

Projenin durum (state) katmanı Firestore'da tutulur. Faz 1'de sadece
`used_topics` koleksiyonu kullanılır; `videos` koleksiyonu Faz 5'te devreye girer.

## Koleksiyon: `used_topics`

Amaç: aynı konunun tekrar üretilmesini engellemek. Doc id, konu başlığının
normalize edilmiş hali (`normalizeTopic`) — böylece benzer başlıklar çakışır.

| Alan             | Tip       | Açıklama                                            |
| ---------------- | --------- | -------------------------------------------------- |
| `topic`          | string    | Konu başlığı (Türkçe, orijinal)                    |
| `normalizedTopic`| string    | Doc id ile aynı; ascii + tireli hali               |
| `createdAt`      | timestamp | Sunucu zaman damgası                               |
| `scriptPreview`  | string    | (opsiyonel) hook'un ilk hali, hızlı bakış için     |
| `videoId`        | string    | (Faz 5) İlgili `videos` dokümanına referans         |

**Örnek doküman** (`used_topics/balin-asla-bozulmamasi`):

```json
{
  "topic": "Balın asla bozulmaması",
  "normalizedTopic": "balin-asla-bozulmamasi",
  "createdAt": "2026-07-07T10:00:00Z",
  "scriptPreview": "Mısır piramitlerinde bulunan 3000 yıllık bal..."
}
```

## Koleksiyon: `videos` (Faz 5'te eklenecek — önizleme)

Her üretilen video için tam kayıt.

| Alan            | Tip       | Açıklama                                          |
| --------------- | --------- | ------------------------------------------------- |
| `topic`         | string    | Konu başlığı                                      |
| `script`        | map       | `{ hook, body, cta, visual_keywords, ... }`       |
| `audioPath`     | string    | (Faz 2) Üretilen mp3 yolu / storage referansı     |
| `videoPath`     | string    | (Faz 4) Üretilen mp4 yolu / storage referansı     |
| `youtube`       | map       | (Faz 6) `{ videoId, url, publishedAt }`           |
| `status`        | string    | `draft` \| `rendered` \| `published` \| `failed`  |
| `createdAt`     | timestamp | Üretim tarihi                                     |

## İndeks Notu

`used_topics` üzerinde `createdAt` alanına göre `orderBy` yapıldığı için
tek alanlı otomatik indeks yeterlidir; ek composite indeks gerekmez.
