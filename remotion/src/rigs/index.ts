import React from 'react';
import type {Beat, RigId} from '../schema';
import {PortalZoom} from './PortalZoom';
import {VillainPunch} from './VillainPunch';
import {PaperDrop} from './PaperDrop';
import {GroundedPunch} from './GroundedPunch';
import {MoneyRoom} from './MoneyRoom';
import {FinaleClone} from './FinaleClone';

/**
 * THE RIG LIBRARY.
 *
 * Six signature animations. A beat picks one; nothing else in the render
 * chooses what a scene looks like. Adding a seventh means adding one file and
 * one line here — every rig already inherits the engine and the film look.
 */
export const RIGS: Record<RigId, React.FC<{beat: Beat}>> = {
  'portal-zoom': PortalZoom,
  'villain-punch': VillainPunch,
  'paper-drop': PaperDrop,
  'grounded-punch': GroundedPunch,
  'money-room': MoneyRoom,
  'finale-clone': FinaleClone,
};

export const RIG_IDS = Object.keys(RIGS) as RigId[];

export {PortalZoom, VillainPunch, PaperDrop, GroundedPunch, MoneyRoom, FinaleClone};
