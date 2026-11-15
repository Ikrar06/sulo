import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@/assets/tailwind.css';

const startedAt = performance.now();
const root = document.getElementById('root');
if (!root) throw new Error('Popup root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App startedAt={startedAt} />
  </React.StrictMode>,
);
