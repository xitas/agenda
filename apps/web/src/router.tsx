import { Navigate } from 'react-router';
import type { RouteObject } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { DayPage } from './day/DayPage';
import { Playground } from './Playground';
import { AppShell } from './shell/AppShell';
import { ComingSoon } from './shell/ComingSoon';
import { WeekPage } from './week/WeekPage';

/** The route table; main.tsx makes a browser router from it, tests a memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/playground', element: <Playground /> },
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
          { path: 'month', element: <ComingSoon title="Month" /> },
          { path: 'search', element: <ComingSoon title="Search" /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
