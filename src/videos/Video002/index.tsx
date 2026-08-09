import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { themes } from '../../tokens'
import { TitleCard } from '../../templates/TitleCard'
import { TextSlide } from '../../templates/TextSlide'
import { BulletReveal } from '../../templates/BulletReveal'
import { StatCard } from '../../templates/StatCard'
import { OutroCard } from '../../templates/OutroCard'
import { meta, sequence } from './data'

const bg = themes[sequence[0].props.theme].bg

export const Video002: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: bg }}>
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
