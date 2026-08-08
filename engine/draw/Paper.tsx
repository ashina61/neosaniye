import React from 'react';
import {fitSize} from './Type';
import {hash01} from '../motion';

/**
 * PAPER, DRAWN.
 *
 * Newspapers, index cards, photographic prints, plaques. Every one of these was
 * being asked of an image generator, and every one of them came back either
 * refused or mediocre — because they are the hardest thing to generate (small
 * legible type, straight edges, clean rectangles) and the easiest thing to
 * draw.
 *
 * The division that makes this work, and that the reference reel follows
 * exactly: PEOPLE AND PLACES ARE PHOTOGRAPHED, EVERYTHING ELSE IS DRAWN. A
 * procedural human is a pictogram and always looks it. A procedural newspaper
 * is just typography, and typography is what a documentary graphic IS.
 *
 * Nothing here knows an episode. It takes words and numbers.
 */

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Courier New", ui-monospace, monospace';

/**
 * COLUMNS OF TYPE TOO SMALL TO RESOLVE — and a front page is mostly this.
 *
 * The first version drew three equal columns of identical bars and stopped
 * partway down, so the sheet read as a wireframe with a third of it blank. A
 * real page has PARAGRAPHS: a short indented first line, a ragged last one, a
 * gap, and then another. It also has a sub-head partway down a column and a
 * halftone block sitting in the middle of the text rather than above it.
 *
 * None of it is legible at reel size and none of it needs to be. What the eye
 * reads is the RHYTHM — and a rhythm is exactly what a grid of equal bars has
 * none of.
 */
const TypeBlock: React.FC<{
  seed: string;
  lines: number;
  columns?: number;
  colour?: string;
  /** A halftone block dropped into one column, as a fraction of its width. */
  cut?: number;
}> = ({seed, lines, columns = 3, colour = '#2b2620', cut = 0}) => (
  <div style={{display: 'flex', gap: '4.5%', width: '100%', flex: 1, alignItems: 'stretch'}}>
    {Array.from({length: columns}, (_, col) => {
      // Where this column's paragraphs break, and where its picture sits.
      const cutRow = cut > 0 && col === 1 ? Math.round(lines * 0.34) : -1;
      return (
        <div key={col} style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 3}}>
          {Array.from({length: lines}, (_, row) => {
            if (row === cutRow) {
              return (
                <div
                  key={`cut${row}`}
                  style={{
                    height: `${cut * 100}%`,
                    margin: '4px 0 6px',
                    background:
                      `repeating-linear-gradient(0deg, ${colour}30 0 2px, transparent 2px 4px),` +
                      `linear-gradient(158deg, ${colour}88, ${colour}22)`,
                  }}
                />
              );
            }
            const r = hash01(seed, col * 211 + row);
            // A paragraph is a short indent, some full lines, a ragged last one.
            const para = (row + Math.round(hash01(seed, col) * 4)) % 9;
            const indent = para === 0 ? 12 : 0;
            const width = para === 8 ? 34 + r * 30 : 88 + r * 12;
            return (
              <div
                key={row}
                style={{
                  height: 3,
                  marginLeft: `${indent}%`,
                  width: `${Math.min(100 - indent, width)}%`,
                  background: colour,
                  opacity: para === 8 ? 0.26 : 0.34,
                  marginBottom: para === 8 ? 7 : 0,
                }}
              />
            );
          })}
        </div>
      );
    })}
  </div>
);

/**
 * A NEWSPAPER FRONT PAGE.
 *
 * Masthead, rules, a headline, a halftone photo block and columns of unreadable
 * type. The headline is the only thing anyone reads, so it is the only thing
 * set large — everything else is texture whose job is to say "newspaper".
 */
export const Newspaper: React.FC<{
  masthead: string;
  headline: string;
  date?: string;
  width: number;
  seed?: string;
  tint?: string;
  ink?: string;
  /**
   * A CLOSE-UP ON THE TOP OF THE PAGE, rather than the whole sheet.
   *
   * A front page that IS the shot cannot be the whole front page. Drawn at full
   * frame, the fake halftone block becomes a grey slab and the fake columns
   * become grey lines — the sheet stops reading as a newspaper and starts
   * reading as a wireframe of one, which is exactly what a contact sheet showed.
   * A camera close on a paper sees the masthead, the rule and the headline, and
   * the columns run off the bottom of the frame. So at that size we draw that.
   */
  crop?: boolean;
}> = ({masthead, headline, date, width, seed = 'paper', tint = '#e8dcc0', ink = '#241f18', crop = false}) => {
  const height = Math.round(width * (crop ? 1.9 : 1.32));
  return (
    <div
      style={{
        width,
        height,
        background: tint,
        backgroundImage:
          `radial-gradient(ellipse at 18% 12%, rgba(120,96,52,0.16) 0%, transparent 44%),` +
          `radial-gradient(ellipse at 84% 82%, rgba(120,96,52,0.14) 0%, transparent 48%)`,
        padding: `${width * 0.055}px ${width * 0.06}px`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: width * 0.028,
        color: ink,
        boxShadow: '0 26px 52px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 900,
          // THE ENGINE GUARANTEES IT FITS. A masthead set at a fixed size is
          // fine until the words are long and then it simply runs off the
          // sheet — the same failure the slot cards had, in a different file.
          fontSize: fitSize(masthead, width * 0.092, width * 0.88, 0),
          letterSpacing: '-0.015em',
          textAlign: 'center',
          lineHeight: 1,
          borderBottom: `2px solid ${ink}`,
          paddingBottom: width * 0.018,
        }}
      >
        {masthead}
      </div>
      {date ? (
        <div style={{fontFamily: MONO, fontSize: width * 0.026, letterSpacing: '0.14em', textAlign: 'center', opacity: 0.7}}>
          {date}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: fitSize(headline, width * 0.088, width * 0.88, 0),
          lineHeight: 0.98,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          borderTop: `4px solid ${ink}`,
          borderBottom: `1px solid ${ink}`,
          padding: `${width * 0.022}px 0`,
        }}
      >
        {headline}
      </div>
      {/* The halftone photo band is what a small sheet needs to read as a
          newspaper at a glance. Blown up to fill a frame it is just a grey
          rectangle, so the close-up drops it and gives the columns the room. */}
      {crop ? null : (
        <div
          style={{
            height: height * 0.24,
            background: `repeating-linear-gradient(0deg, ${ink}22 0 2px, transparent 2px 4px), linear-gradient(150deg, ${ink}66, ${ink}22)`,
          }}
        />
      )}
      {/* The columns take whatever height is left, so the sheet is never a
          third empty — which is what a page of type actually looks like. */}
      <TypeBlock
        seed={seed}
        lines={Math.round(height * (crop ? 0.055 : 0.03))}
        colour={ink}
        cut={crop ? 0.26 : 0}
      />
    </div>
  );
};

/**
 * AN INDEX CARD or evidence label — the small typed rectangle pinned to a
 * board. Whatever is typed on it is the whole point, so it is set in mono.
 */
export const Card: React.FC<{
  title?: string;
  lines?: string[];
  width: number;
  tint?: string;
  ink?: string;
  stamp?: string;
}> = ({title, lines = [], width, tint = '#efe6d2', ink = '#22201c', stamp}) => (
  <div
    style={{
      width,
      background: tint,
      padding: width * 0.075,
      // A stamp lands in the margin, never across the typing it is stamping.
      paddingBottom: stamp ? width * 0.24 : width * 0.075,
      boxSizing: 'border-box',
      fontFamily: MONO,
      color: ink,
      boxShadow: '0 20px 44px rgba(0,0,0,0.62)',
      position: 'relative',
    }}
  >
    {title ? (
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: width * 0.085,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderBottom: `2px solid ${ink}`,
          paddingBottom: width * 0.03,
          marginBottom: width * 0.045,
        }}
      >
        {title}
      </div>
    ) : null}
    {/* REDACTION. Wrap anything in ~tildes~ and it is struck out under a black
        bar sized to the words it hides. The most economical documentary device
        there is: it says a record exists and that you are not being shown it,
        which is more interesting than any sentence that could have been there. */}
    {lines.map((line, i) => (
      <div key={i} style={{fontSize: width * 0.058, lineHeight: 1.55, letterSpacing: '0.02em'}}>
        {line.split('~').map((part, j) =>
          j % 2 === 1 ? (
            <span
              key={j}
              style={{
                display: 'inline-block',
                background: '#14120f',
                color: 'transparent',
                borderRadius: 1,
                transform: `rotate(${j % 3 === 1 ? -0.4 : 0.3}deg)`,
              }}
            >
              {part}
            </span>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
      </div>
    ))}
    {stamp ? (
      <div
        style={{
          position: 'absolute',
          right: -width * 0.03,
          bottom: width * 0.05,
          border: `4px solid #9c2b21`,
          color: '#9c2b21',
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: width * 0.07,
          letterSpacing: '0.1em',
          padding: `${width * 0.018}px ${width * 0.05}px`,
          transform: 'rotate(-8deg)',
          opacity: 0.82,
        }}
      >
        {stamp}
      </div>
    ) : null}
  </div>
);

/**
 * A PHOTOGRAPHIC PRINT — a white-bordered rectangle with something inside it.
 * The border is what makes an image read as a physical object on a table
 * rather than as the shot itself.
 */
export const Print: React.FC<{
  width: number;
  caption?: string;
  children?: React.ReactNode;
  border?: string;
  ratio?: number;
}> = ({width, caption, children, border = '#f2ece0', ratio = 1}) => (
  <div
    style={{
      width,
      background: border,
      padding: width * 0.05,
      paddingBottom: caption ? width * 0.16 : width * 0.05,
      boxSizing: 'border-box',
      boxShadow: '0 22px 46px rgba(0,0,0,0.66)',
      position: 'relative',
    }}
  >
    {/* A PRINT WITH NOTHING IN IT IS A BLACK HOLE. Handed no picture, this drew
        a white border round pure black — and that is what a contact sheet
        showed: a hole with a caption under it. So the empty case draws what an
        old print looks like from across a room instead: a soft duotone field,
        a corner of light, a vignette and the grain of the paper. It reads as a
        photograph whose subject you cannot quite make out, which is a
        documentary graphic; a black rectangle is a mistake. */}
    <div
      style={{
        width: '100%',
        height: width * ratio * 0.9,
        overflow: 'hidden',
        position: 'relative',
        background: children
          ? '#15120e'
          : `radial-gradient(ellipse at 26% 18%, #6b6154 0%, #3a342c 38%, #1b1813 78%),` +
            `linear-gradient(168deg, rgba(255,255,255,0.1), transparent 46%)`,
      }}
    >
      {children ?? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              `repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 4px),` +
              `radial-gradient(ellipse at 50% 50%, transparent 46%, rgba(0,0,0,0.55) 100%)`,
          }}
        />
      )}
    </div>
    {caption ? (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: width * 0.045,
          textAlign: 'center',
          fontFamily: MONO,
          fontSize: width * 0.052,
          letterSpacing: '0.1em',
          color: '#3a332a',
        }}
      >
        {caption}
      </div>
    ) : null}
  </div>
);

/**
 * A MUSEUM PLAQUE — small engraved serif on brass, under a hanging picture.
 * One of the reference reel's opening beats, and pure typography.
 */
export const Plaque: React.FC<{text: string; width: number}> = ({text, width}) => (
  <div
    style={{
      width,
      background: 'linear-gradient(168deg, #c9a75a 0%, #8d7238 48%, #b2924b 100%)',
      padding: `${width * 0.05}px ${width * 0.06}px`,
      boxSizing: 'border-box',
      textAlign: 'center',
      fontFamily: SERIF,
      fontStyle: 'italic',
      fontSize: fitSize(text, width * 0.115, width * 0.88, 0),
      color: '#2a2113',
      letterSpacing: '0.04em',
      boxShadow: '0 10px 22px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
    }}
  >
    {text}
  </div>
);
