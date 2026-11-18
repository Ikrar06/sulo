import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpikeScreen } from './SpikeScreen';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikeScreen />
  </StrictMode>,
);
