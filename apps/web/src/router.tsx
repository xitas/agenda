import type { RouteObject } from 'react-router';
import { App } from './App';
import { Playground } from './Playground';

/** The route table; main.tsx makes a browser router from it, tests a memory router. */
export const routes: RouteObject[] = [
  { path: '/', element: <App /> },
  { path: '/playground', element: <Playground /> },
];
