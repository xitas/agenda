import { Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { QUICK_ADD_PATH } from './app/session';
import { DayPage } from './day/DayPage';
import { QuickAddWindow } from './desktop/QuickAddWindow';
import { MonthPage } from './month/MonthPage';
import { Playground } from './Playground';
import { SearchPage } from './search/SearchPage';
import { SettingsPage } from './settings/SettingsPage';
import { AppShell } from './shell/AppShell';
import { WeekPage } from './week/WeekPage';

/** The route table; main.tsx makes a browser router from it, tests a memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/playground', element: <Playground /> },
  // The desktop app's quick-add window; it handles a missing session itself.
  { path: QUICK_ADD_PATH, element: <QuickAddWindow /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DayPage /> },
          { path: 'day/:date', element: <DayPage /> },
          { path: 'week', element: <WeekPage /> },
          { path: 'week/:date', element: <WeekPage /> },
          { path: 'month', element: <MonthPage /> },
          { path: 'month/:month', element: <MonthPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
