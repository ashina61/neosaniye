import React from 'react';
import type {Look} from '../schema';
import {DEFAULT_LOOK} from '../schema';

/**
 * THE LOOK, AVAILABLE EVERYWHERE.
 *
 * Colours, treatment strengths, prop shapes and choreography polarity are
 * chosen once per video (see `src/story/look.js`) and read here by whatever
 * needs them. It is a context rather than a prop chain for one reason: a
 * component that can quietly fall back to a hard-coded colour is a component
 * that will, and one hard-coded colour is all it takes for every video this
 * repo ships to look like the same video again.
 */
export const LookContext = React.createContext<Look>(DEFAULT_LOOK);

export const useLook = (): Look => React.useContext(LookContext);
