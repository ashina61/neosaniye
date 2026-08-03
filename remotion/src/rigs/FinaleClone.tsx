import React from 'react';
import type {Beat} from '../schema';
import {GroundedPunch} from './GroundedPunch';

/**
 * FINALE CLONE — the button.
 *
 * Barely a new scene at all: it is GROUNDED PUNCH, cloned. Same parallax punch
 * anchored to the feet, same cast shadow, same camera, same treatment. Three
 * things change — the character, the words, and a gesture instead of a payoff
 * word.
 *
 * Keeping this as a thin wrapper rather than a copied file is deliberate: if
 * the punch is ever re-tuned, the finale inherits it. Reuse is the payoff of
 * coding a reel instead of keyframing one.
 */
export const FinaleClone: React.FC<{beat: Beat}> = ({beat}) => (
  <GroundedPunch
    beat={{
      ...beat,
      props: {
        // The finale keeps the character centred — no shift — and answers with
        // a wag rather than a word.
        shiftFrame: 0,
        shiftPx: 0,
        gesture: 'wag',
        ...beat.props,
      },
    }}
  />
);
