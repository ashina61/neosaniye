import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SubtitleCue} from '../schema';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/**
 * THE NARRATOR'S WORDS, ON THE FRAME THEY ARE SPOKEN.
 *
 * The zeroth law one level down. Scene lengths were already cut to the measured
 * line windows; these are the measured WORD windows inside them, so the caption
 * is not a typewriter effect running alongside the voice — it is the voice.
 *
 * Reel frames, not scene frames. This layer sits outside every `<Sequence>` for
 * the same reason the narration does: sequencing it per scene would let each
 * cut's rounding push the words a frame further from the mouth saying them, and
 * six cuts in, the caption is a word behind.
 *
 * A WINDOW OF WORDS, NOT ONE WORD. A single word popping alone is a meme
 * caption; a short phrase with the spoken word lit inside it is a documentary
 * subtitle, and it lets the eye read ahead the way it does with any subtitle.
 */
export const Subtitles: React.FC<{cues?: SubtitleCue[]; accent?: string; window?: number}> = ({
  cues,
  accent = '#f2e9d6',
  window = 4,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (!cues?.length) return null;

  const index = cues.findIndex((cue) => frame >= cue.from && frame < cue.to);
  if (index < 0) return null;

  // Look back for the phrase this word sits in, but never across the silence
  // that separates two lines: a caption that carries the tail of the previous
  // sentence under the first word of the next one reads as a lag.
  const start = Math.max(0, index - window);
  const phrase: {text: string; live: boolean}[] = [];
  for (let i = start; i <= index; i += 1) {
    if (i > start && cues[i].from - cues[i - 1].to > 14) phrase.length = 0;
    phrase.push({text: cues[i].text, live: i === index});
  }

  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          maxWidth: width * 0.84,
          marginBottom: height * 0.14,
          padding: `${width * 0.022}px ${width * 0.032}px`,
          // A scrim, not a box: the words have to stay legible over a lit
          // frame, and a hard card at the bottom of every shot is a lower third
          // from a news package.
          background: 'linear-gradient(rgba(6,5,4,0.0), rgba(6,5,4,0.62) 22%, rgba(6,5,4,0.62) 78%, rgba(6,5,4,0.0))',
          textAlign: 'center',
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: width * 0.052,
          lineHeight: 1.26,
          letterSpacing: '0.005em',
          textShadow: '0 3px 18px rgba(0,0,0,0.85)',
        }}
      >
        {phrase.map((word, i) => (
          <span key={`${word.text}-${i}`} style={{color: word.live ? accent : 'rgba(240,234,220,0.62)'}}>
            {word.text}
            {i < phrase.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
