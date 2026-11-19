import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { readPrefs } from '@sulo/core/prefs';
import { initPerf } from './perf';
import { createMobilePlatform } from './platform';
import './styles.css';

const platform = createMobilePlatform();

// The performance tier before the first frame, so nothing starts in the
// wrong mode; never waits more than 250 ms (full until then).
await Promise.race([
  readPrefs(platform.store).then((p) => initPerf(platform.store, p.animation)).catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 250)),
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);
