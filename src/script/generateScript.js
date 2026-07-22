import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import {
  getRecentUsedTopics,
  getRecentFormats,
  getTopPerformingTopics,
  getWinningHooks,
  isTopicUsed,
  normalizeTopic,
} from '../lib/firestore.js';
import { softenAdText } from '../lib/adSafe.js';
import { validateViewerFirstScript } from '../pipeline/viewerFirstValidation.js';
import { evaluateNarrationLength } from '../pipeline/durationPolicy.js';
import { pickViralTemplate, findViralTemplate } from './viral-templates.js';
import { pickFallbackScript, getFallbackPoolSize } from './fallback-scripts.js';