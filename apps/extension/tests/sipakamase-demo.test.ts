import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module of the screenshot scripts
import { demoSipakamase } from '../scripts/lib/demo-sipakamase.mjs';
import { PASSIVE_MESSAGE_TYPE, parsePassive } from '@sulo/core/sipakamase/schema';
import { FRAGMENTS } from '@sulo/core/sipakamase/store';

describe('demo Sipakamase data', () => {
  it('has every fragment, each valid as the passive reader would send it', () => {
    const data = demoSipakamase(1_794_000_000)['sipakamase:data'];
    for (const fragment of FRAGMENTS) expect(parsePassive({ type: PASSIVE_MESSAGE_TYPE, fragment, data: data.parts[fragment] }).kind).toBe('value');
  });
});
