import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { createBridge, sha256Hex, type BridgeDeps } from '@sulo/core/neosia/bridge';
import type { Message } from '@/lib/messages';

// Isolated-world bridge for NEOSIA (document_start), registered at runtime
// only while the module is on (lib/neosia/module.ts). Checks every message
// from the page-world script (lib/neosia/bridge.ts) and hands the valid
// ones to the service worker, which validates them again. Makes no request.
export default defineUnlistedScript(() => {
  const deps: BridgeDeps = {
    self: window,
    nowMs: () => Date.now(),
    hash: sha256Hex,
    send: (capture) => {
      browser.runtime.sendMessage({ type: 'neosia/capture', capture } satisfies Message).catch(() => undefined);
    },
  };
  // Development builds only: forward the observation listing (paths and key names).
  if (import.meta.env.MODE === 'development') {
    deps.other = (data) => {
      browser.runtime.sendMessage({ type: 'dev/neosia/observe', observation: data }).catch(() => undefined);
    };
  }
  const onMessage = createBridge(deps);
  window.addEventListener('message', (event) => void onMessage(event));
});
