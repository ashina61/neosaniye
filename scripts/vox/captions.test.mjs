import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutCaption,validateCaptions} from './captions.mjs';

test('uzun Türkçe kelimeyi kelime ortasından bölmez',()=>assert.throws(()=>layoutCaption('muvaffakiyetsizleştiricileştiriveremeyebileceklerimizdenmişsinizcesine',{maxWidth:300}),/safe-area/));
test('noktalama işaretlerini korur',()=>assert.deepEqual(layoutCaption('Londra, Aralık 1868.').lines,['Londra, Aralık 1868.']));
test('üç satıra taşacak caption reddedilir',()=>assert.throws(()=>layoutCaption('bir iki üç dört beş altı yedi sekiz dokuz on',{maxWidth:150,maxChars:12}),/satır/));
test('safe-area ihlali reddedilir',()=>assert.throws(()=>layoutCaption('Westminster',{maxWidth:50}),/safe-area/));
test('boş caption reddedilir',()=>assert.throws(()=>layoutCaption('   '),/boş/));
test('caption timing overlap reddedilir',()=>assert.throws(()=>validateCaptions([{text:'a',lines:['a'],startFrame:0,endFrame:10},{text:'b',lines:['b'],startFrame:9,endFrame:20}]),/çakışıyor/));
