import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { themes } from '../../tokens'
import { TitleCard } from '../../templates/TitleCard'
import { TextSlide } from '../../templates/TextSlide'
import { BulletReveal } from '../../templates/BulletReveal'
import { StatCard } from '../../templates/StatCard'
import { ListRace } from '../../templates/ListRace'
import { OutroCard } from '../../templates/OutroCard'
import { meta, sequence } from './data'

// Kalıcı zemin. Şablonlar çıkışta kendi kök div'lerinin opacity'sini düşürür;
// altında bu olmazsa kareler arasında canvas görünür.
const bg = themes[sequence[0].props.theme].bg

export const Video003: React.FC = () => {
  return (
    <AbsoluteFill lang={meta.lang} style={{ background: bg }}>
      <Series>
        {sequence.map((item, i) => (
          <Series.Sequence key={i} durationInFrames={item.durationInFrames}>
            {item.template === 'TitleCard' && (
              <TitleCard {...item.props} durationInFrames={item.durationInFrames} />
            )}
            {item.template === 'TextSlide' && (
              <TextSlide {...item.props} durationInFrames={item.durationInFrames} />
            )}
            {item.template === 'BulletReveal' && (
              <BulletReveal {...item.props} durationInFrames={item.durationInFrames} />
            )}
            {item.template === 'StatCard' && (
              <StatCard {...item.props} durationInFrames={item.durationInFrames} />
            )}
            {item.template === 'ListRace' && (
              <ListRace {...item.props} durationInFrames={item.durationInFrames} />
            )}
            {item.template === 'OutroCard' && (
              <OutroCard {...item.props} durationInFrames={item.durationInFrames} />
            )}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  )
}

export { meta }
