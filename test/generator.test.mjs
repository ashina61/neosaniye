/**
 * The draw/skip decision, which once made the whole generation step a no-op.
 *
 * An episode is scaffolded with stand-ins and those stand-ins are committed, so
 * "the file already exists" is true for every asset before a single one has
 * been drawn. Skipping on that alone means the run draws nothing, exits green,
 * commits nothing, and the reel is still grey boxes — with a tick on every
 * step. The ledger is the only thing that can tell a hole from artwork.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldDraw} from '../scripts/generate-assets.mjs';

test('a missing asset is drawn', () => {
  assert.equal(shouldDraw({onDisk: false, isStandIn: false, force: false}), true);
});

test('a stand-in is drawn over, even though the file is right there', () => {
  assert.equal(shouldDraw({onDisk: true, isStandIn: true, force: false}), true);
});

test('real artwork is left alone', () => {
  assert.equal(shouldDraw({onDisk: true, isStandIn: false, force: false}), false);
});

test('--force redraws real artwork too', () => {
  assert.equal(shouldDraw({onDisk: true, isStandIn: false, force: true}), true);
});
