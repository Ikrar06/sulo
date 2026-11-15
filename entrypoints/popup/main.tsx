import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@/assets/tailwind.css';
import { installInputModality } from '@/lib/ui/input-modality';

const startedAt = performance.now();
const root = document.getElementById('root');
if (!root) throw new Error('Popup root element not found');

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App startedAt={startedAt} />
  </React.StrictMode>,
);
