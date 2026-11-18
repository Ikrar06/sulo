import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Scaffold (M8b part A): the screens come with SuloSession.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-4">
      <h1 className="text-[20px] leading-7 font-semibold">Sulo</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.</p>
    </main>
  </StrictMode>,
);
