// Tracks how the user last interacted (mouse/touch or keyboard) in one place
// and writes it to <html data-input>. The focus-ring variants in
// assets/tailwind.css show rings only when that is not "mouse".
//
// Why: Chrome shows :focus-visible when focus is moved by script, so when a
// Radix menu closes after a mouse click and returns focus to its trigger,
// the trigger lit up as if it had been reached with Tab. Focus still returns
// to the trigger (keyboard users keep their place); only the ring is hidden.

export type InputModality = 'mouse' | 'keyboard';

/** Keys that move focus or act on the focused control. Typing text does not count. */
const NAVIGATION_KEYS = new Set([
  'Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
]);

export function modalityForKey(key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): InputModality | null {
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return null;
  return NAVIGATION_KEYS.has(key) ? 'keyboard' : null;
}

interface ModalityTarget {
  addEventListener(type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: (event: Event) => void, options?: EventListenerOptions): void;
}

/**
 * Installs the listeners (capture phase, so they run before any handler that
 * moves focus). Returns a function that removes them.
 */
export function installInputModality(target: ModalityTarget, root: { dataset: DOMStringMap }): () => void {
  const set = (modality: InputModality) => {
    if (root.dataset.input !== modality) root.dataset.input = modality;
  };
  const onKey = (event: Event) => {
    const e = event as KeyboardEvent;
    const modality = modalityForKey(e.key, e);
    if (modality) set(modality);
  };
  const onPointer = () => set('mouse');
  const options = { capture: true, passive: true };
  target.addEventListener('keydown', onKey, options);
  target.addEventListener('pointerdown', onPointer, options);
  return () => {
    target.removeEventListener('keydown', onKey, options);
    target.removeEventListener('pointerdown', onPointer, options);
  };
}
