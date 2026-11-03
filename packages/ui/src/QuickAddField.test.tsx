import type { QuickAddPreview } from '@agenda/core';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuickAddField } from './QuickAddField.js';
import type { QuickAddFieldProps } from './QuickAddField.js';
import { UnreachableCard } from './UnreachableCard.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

const dentist: QuickAddPreview = {
  title: 'Dentist',
  when: 'Tue 27 Oct · 16:00',
  color: 'red',
  colorName: 'Red',
  warnings: [],
};

function Field(props: Partial<QuickAddFieldProps>) {
  const [value, setValue] = useState('');
  return (
    <QuickAddField
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      onEscape={() => undefined}
      preview={value === '' ? null : dentist}
      {...props}
    />
  );
}

const field = () => screen.getByRole('textbox', { name: 'Quick add' });

describe('QuickAddField', () => {
  it('shows the preview while there is text, tied to the field', async () => {
    const user = userEvent.setup();
    const { container } = render(<Field />);
    expect(field().getAttribute('aria-describedby')).toBeNull();
    await user.type(field(), 'Dentist 4pm #red');
    const preview = document.getElementById(field().getAttribute('aria-describedby') ?? '');
    expect(preview?.textContent).toBe('DentistTue 27 Oct · 16:00RedEnter to add · Esc to clear');
    expect(preview?.querySelector('[data-event-color="red"]')).not.toBeNull();
    expect(container.firstElementChild?.className).toBe('ag-quickadd ag-quickadd--floating');
    await expectNoAxeViolations(container);
  });

  it('lists warnings and takes its own hint, layout and class', () => {
    render(
      <QuickAddField
        value="Lunch"
        onChange={() => undefined}
        onSubmit={() => undefined}
        onEscape={() => undefined}
        preview={{
          ...dentist,
          title: 'Lunch',
          warnings: ['No date found, so this was added for today'],
        }}
        hint="Enter to add · Esc to close"
        layout="inline"
        className="popup"
        autoFocus
      />,
    );
    expect(screen.getByRole('listitem').textContent).toBe(
      'No date found, so this was added for today',
    );
    expect(screen.getByText('Enter to add · Esc to close')).toBeDefined();
    expect(field().closest('.ag-quickadd')?.className).toBe(
      'ag-quickadd ag-quickadd--inline popup',
    );
    expect(document.activeElement).toBe(field());
  });

  it('submits on Enter and hands the field over on Esc', async () => {
    const onSubmit = vi.fn();
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<Field onSubmit={onSubmit} onEscape={onEscape} />);
    await user.type(field(), 'Dentist{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledWith(field());
  });
});

describe('UnreachableCard', () => {
  it('names the server and retries', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<UnreachableCard url="http://localhost:4001" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(
      screen.getByRole('heading', { name: "Can't reach Agenda at http://localhost:4001" }),
    ).toBeDefined();
    expect(alert.textContent).toContain('Is the API running? (pnpm dev)');
    expect(screen.queryByRole('button', { name: 'Change server URL' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);
  });

  it('offers to change the server where the app has a setting for it', async () => {
    const onChangeServer = vi.fn();
    const user = userEvent.setup();
    render(
      <UnreachableCard
        url="x"
        onRetry={() => undefined}
        retrying
        onChangeServer={onChangeServer}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Change server URL' }));
    expect(onChangeServer).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Retry/ }).getAttribute('aria-busy')).toBe('true');
  });
});
