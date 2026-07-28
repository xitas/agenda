import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
    text: () => Promise.resolve('[]'),
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders the Agenda heading and loads events from the API', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /agenda/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText(/loading agenda/i)).not.toBeInTheDocument());
  expect(fetch).toHaveBeenCalledWith('/api/events', expect.anything());
});
