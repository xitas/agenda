import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input, Textarea } from './Field.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

describe('Input', () => {
  it('is labelled and can be typed into', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="Title" onChange={onChange} />);
    const input = screen.getByLabelText('Title');
    await user.click(screen.getByText('Title'));
    expect(document.activeElement).toBe(input);
    await user.keyboard('Dentist');
    expect(input).toHaveProperty('value', 'Dentist');
    expect(onChange).toHaveBeenCalledTimes(7);
  });

  it('links the hint and marks nothing invalid without an error', () => {
    render(<Input label="Location" hint="Optional" />);
    const input = screen.getByRole('textbox', { name: 'Location' });
    expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-hint`);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('Optional').id).toBe(`${input.id}-hint`);
  });

  it('links the hint and the error, and marks the input invalid', () => {
    render(<Input id="title" label="Title" hint="Up to 200 characters" error="Add a title" />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('title-hint title-error');
    expect(screen.getByText('Add a title').closest('.ag-field')?.className).toContain(
      'ag-field--invalid',
    );
  });

  it('shows a required marker without adding it to the name', () => {
    render(<Input label="Title" required />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveProperty('required', true);
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true');
  });

  it('has no axe violations, with or without an error', async () => {
    const { container } = render(
      <div>
        <Input label="Title" hint="Required" />
        <Input label="Location" error="Too long" />
        <Input label="Disabled" disabled />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('Textarea', () => {
  it('is labelled, typed into and can show an error', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" error="Too long" className="tall" />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.className).toBe('ag-input ag-textarea tall');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    await user.type(textarea, 'Line 1{Enter}Line 2');
    expect(textarea).toHaveProperty('value', 'Line 1\nLine 2');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Textarea label="Notes" hint="Markdown-lite" />);
    await expectNoAxeViolations(container);
  });
});
