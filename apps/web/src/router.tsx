import { createBrowserRouter } from 'react-router';
import { App } from './App';
import { Playground } from './Playground';

export const routes = [
  { path: '/', element: <App /> },
  { path: '/playground', element: <Playground /> },
];

export const router = createBrowserRouter(routes);
