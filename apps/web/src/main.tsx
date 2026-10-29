import '@fontsource-variable/inter';
import '@agenda/tokens/tokens.css';
import '@agenda/ui/styles.css';
import './playground.css';
import './auth/login.css';
import './shell/shell.css';
import './views/views.css';
import './day/day.css';
import './week/week.css';
import './month/month.css';
import './search/search.css';
import './settings/settings.css';
import './events/events.css';
import './events/editor.css';
import './quick-add/quickAdd.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createWebApi } from './app/api';
import { AppProviders } from './app/AppProviders';
import { browserEnv } from './app/env';
import { webPlatform } from './app/platform';
import { createQueryClient } from './app/queryClient';
import { handleUnauthorized } from './app/session';
import { routes } from './router';
import { applyTheme, readTheme } from './theme';

// Before the first render, so the saved theme is used from the first frame.
applyTheme(readTheme());

const queryClient = createQueryClient();
// The client needs the router for its 401 handler, and the router is created after it.
const app: { router?: ReturnType<typeof createBrowserRouter> } = {};
const api = createWebApi(() => {
  if (app.router) handleUnauthorized(queryClient, app.router);
});
app.router = createBrowserRouter(routes);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <AppProviders api={api} queryClient={queryClient} env={browserEnv()} platform={webPlatform}>
      <RouterProvider router={app.router} />
    </AppProviders>
  </StrictMode>,
);
