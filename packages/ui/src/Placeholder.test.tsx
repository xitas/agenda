import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Placeholder } from './Placeholder.js';

describe('Placeholder', () => {
  it('renders its label', () => {
    render(<Placeholder label="Hello" />);

    expect(screen.getByText('Hello')).toBeDefined();
  });
});
