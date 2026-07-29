import {access} from 'node:fs/promises';
import path from 'node:path';
export async function validateAudioMix(project,mix){if(!mix?.voice?.path)throw new Error('Voice audio yolu zorunludur.');const assets=[mix.voice,mix.music,mix.ambience,...(mix.paperSfx||[]),...(mix.eventSfx||[])].filter(Boolean);for(const asset of assets){if(path.isAbsolute(asset.path)||asset.path.split('/').includes('..'))throw new Error(`Geçersiz audio path: ${asset.path}`);await access(path.join(project,asset.path)).catch(()=>{throw new Error(`Audio asset bulunamadı: ${asset.path}`);});}return true;}
