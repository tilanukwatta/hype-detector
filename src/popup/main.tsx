import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui/theme.css';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
