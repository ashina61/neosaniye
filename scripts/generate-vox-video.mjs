#!/usr/bin/env node
import {runVox} from './vox/orchestrator.mjs';

runVox(process.argv.slice(2)).catch((error) => {
  console.error(`[vox] ${error.message}`);
  process.exitCode = 1;
});
