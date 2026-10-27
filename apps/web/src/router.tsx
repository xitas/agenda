import type { RouteObject } from 'react-router';
import { App } from './App';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { Playground } from './Playground';

/** The route table; main.tsx makes a browser router from it, tests a memory router. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/playground', element: <Playground /> },
  {
    element: <RequireAuth />,
    children: [{ index: true, element: <App /> }],
  },
];
