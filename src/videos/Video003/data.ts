import { fps } from '../../tokens'

/**
 * ZİFT DAMLASI DENEYİ — dikey, 55 saniye.
 *
 * Konu bilerek seçildi: tek bir görsel varlık gerektirmiyor. Anlatının tamamı
 * tarih, sayı ve bir adamın 52 yıllık talihsizliği — yani tipografiyle
 * anlatılabilecek bir hikâye. Şablonlar da tam olarak bunu yapıyor.
 *
 * Zamanlama sözleşmesi: her maddenin `from + durationInFrames` değeri bir
 * sonrakinin `from` değerine eşittir ve toplam `meta.durationInFrames` eder.
 */
export const meta = {
  id: 'Video003',
  title: 'Zift Damlası Deneyi',
  format: 'portrait' as const,
  fps,
  durationInFrames: fps * 55,
  /**
   * KARENİN DİLİ. `text-transform: uppercase` dile duyarlıdır ve dil
   * söylenmezse Türkçe "için" kelimesini "IÇIN" yapar — noktasız I. Kök
   * elemana lang="tr" konduğunda tarayıcı doğru eşlemeyi ("İÇİN") kullanır.
   */
  lang: 'tr',
}

export const sequence = [
  {
    template: 'TitleCard' as const,
    from: 0,
    durationInFrames: fps * 5,
    props: {
      title: '99 YILDIR AKIYOR',
      subtitle: 'Ve neredeyse kimse düşerken göremedi',
      theme: 'dark' as const,
      enterDuration: 16,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 5,
    durationInFrames: fps * 7,
    props: {
      text: '1927’de bir profesör huniye zift doldurdu ve akmasını beklemeye başladı',
      highlightWord: 'zift',
      icon: '⏳',
      theme: 'dark' as const,
    },
  },
  {
    template: 'StatCard' as const,
    from: fps * 12,
    durationInFrames: fps * 5,
    props: {
      label: 'İlk damla için beklenen',
      stat: 8,
      unit: 'YIL',
      theme: 'dark' as const,
      format: 'integer' as const,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 17,
    durationInFrames: fps * 6,
    props: {
      text: 'Zift katı görünür; aslında sudan 230 milyar kat koyu bir sıvıdır',
      highlightWord: 'sıvıdır',
      icon: '🫗',
      theme: 'dark' as const,
    },
  },
  {
    template: 'ListRace' as const,
    from: fps * 23,
    durationInFrames: fps * 8,
    props: {
      title: 'DÜŞEN DAMLALAR',
      items: [
        { label: '1938' },
        { label: '1947' },
        { label: '1954' },
        { label: '1962' },
        { label: '1970' },
        { label: '1979' },
      ],
      theme: 'dark' as const,
    },
  },
  {
    template: 'BulletReveal' as const,
    from: fps * 31,
    durationInFrames: fps * 8,
    props: {
      heading: 'NÖBETÇİ',
      bullets: [
        'Bir damla düşerken hafta sonu şehir dışındaydı',
        'Bir damla düşerken çay almaya gitmişti',
        'Bir damla düşerken kamera bozuldu',
      ],
      theme: 'dark' as const,
      staggerFrames: 26,
    },
  },
  {
    template: 'StatCard' as const,
    from: fps * 39,
    durationInFrames: fps * 5,
    props: {
      label: 'John Mainstone’un nöbeti',
      stat: 52,
      unit: 'YIL',
      theme: 'dark' as const,
      format: 'integer' as const,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 44,
    durationInFrames: fps * 6,
    props: {
      text: 'Elli iki yıl bekledi ve tek bir damlanın düştüğünü göremeden öldü',
      highlightWord: 'göremeden',
      theme: 'dark' as const,
    },
  },
  {
    template: 'OutroCard' as const,
    from: fps * 50,
    durationInFrames: fps * 5,
    props: {
      cta: 'Deney hâlâ akıyor',
      handle: '@neosaniye',
      theme: 'dark' as const,
      showProgressBar: true,
    },
  },
]
