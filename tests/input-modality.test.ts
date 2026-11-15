import { describe, expect, it } from 'vitest';
import { installInputModality, modalityForKey } from '../lib/ui/input-modality';

function fakeDocument() {
  const listeners = new Map<string, (e: Event) => void>();
  return {
    target: {
      addEventListener: (type: string, fn: (e: Event) => void) => void listeners.set(type, fn),
      removeEventListener: (type: string) => void listeners.delete(type),
    },
    fire: (type: string, init: Record<string, unknown> = {}) => listeners.get(type)?.(init as unknown as Event),
    listeners,
    root: { dataset: {} as DOMStringMap },
  };
}

describe('input modality', () => {
  it('counts navigation keys as keyboard, but not typing or shortcuts', () => {
    expect(modalityForKey('Tab', {})).toBe('keyboard');
    expect(modalityForKey('ArrowDown', {})).toBe('keyboard');
    expect(modalityForKey(' ', {})).toBe('keyboard');
    expect(modalityForKey('a', {})).toBeNull();
    expect(modalityForKey('Tab', { metaKey: true })).toBeNull();
  });

  it('switches between mouse and keyboard on the root element', () => {
    const doc = fakeDocument();
    installInputModality(doc.target, doc.root);
    expect(doc.root.dataset.input).toBeUndefined(); // rings show until the first input
    doc.fire('pointerdown');
    expect(doc.root.dataset.input).toBe('mouse');
    doc.fire('keydown', { key: 'Tab' });
    expect(doc.root.dataset.input).toBe('keyboard');
    doc.fire('keydown', { key: 'x' });
    expect(doc.root.dataset.input).toBe('keyboard');
  });

  it('removes its listeners', () => {
    const doc = fakeDocument();
    installInputModality(doc.target, doc.root)();
    expect(doc.listeners.size).toBe(0);
  });
});
