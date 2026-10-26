import '@fontsource-variable/inter';
import '@agenda/tokens/tokens.css';
import '@agenda/ui/styles.css';
import './playground.css';
import { ToastProvider } from '@agenda/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './router';
import { applyTheme, readTheme } from './theme';

// Before the first render, so the saved theme is used from the first frame.
applyTheme(readTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
