import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enGB, enUS } from 'date-fns/locale';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField.js';
import type { DateFieldProps } from './DateField.js';
import { Dialog } from './Dialog.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

/** A DateField that keeps its value, like a form would. */
function Controlled(
  props: Partial<DateFieldProps> & { initial?: string; onValue?: (value: string) => void },
) {
  const { initial = '2026-10-28', onValue, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <DateField
      label="Start date"
      today="2026-10-27"
      locale={enGB}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      {...rest}
    />
  );
}

const field = () => screen.getByRole('textbox', { name: 'Start date' });

describe('DateField', () => {
  it('shows the date in the locale format, labelled', () => {
    const { rerender } = render(<Controlled />);
    expect(field()).toHaveProperty('value', '28 Oct 2026');
    rerender(<Controlled locale={enUS} />);
    expect(field()).toHaveProperty('value', 'Oct 28, 2026');
  });

  it('reads typed dates on blur and on Enter', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.clear(field());
    await user.type(field(), '5 nov');
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith('2026-11-05');
    expect(field()).toHaveProperty('value', '5 Nov 2026');

    await user.clear(field());
    await user.type(field(), 'tomorrow{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('2026-10-28');
  });

  it('passes unreadable text on, for the form to flag', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.clear(field());
    await user.type(field(), ' someday ');
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith('someday');
    expect(field()).toHaveProperty('value', 'someday');
  });

  it('does nothing on blur without typing', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.click(field());
    await user.tab();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('shows an error tied to the field', () => {
    render(<Controlled error="Enter a date, like 27 Oct 2026" hint="Or pick one" />);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    const described = field().getAttribute('aria-describedby') ?? '';
    expect(described.split(' ').map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Or pick one',
      'Enter a date, like 27 Oct 2026',
    ]);
  });

  it('opens a calendar on the chosen date; a pick closes it and returns focus', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    const toggle = screen.getByRole('button', { name: 'Choose start date, 28 Oct 2026' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const grid = screen.getByRole('grid');
    expect(toggle.getAttribute('aria-controls')).toBe(grid.closest('[id]')?.id);
    const selected = within(grid).getByRole('gridcell', { name: /^Wednesday, 28 October 2026/ });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    // Focus moves into the grid, on the chosen day.
    expect(document.activeElement).toBe(selected);

    await user.click(within(grid).getByRole('gridcell', { name: /^Friday, 30 October 2026/ }));
    expect(onValue).toHaveBeenLastCalledWith('2026-10-30');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(document.activeElement).toBe(field());
    expect(field()).toHaveProperty('value', '30 Oct 2026');
  });

  it('passes the week start to its calendar', async () => {
    const user = userEvent.setup();
    render(<Controlled weekStart="sunday" />);
    await user.click(screen.getByRole('button', { name: /^Choose start date/ }));
    expect(screen.getAllByRole('columnheader')[0]?.getAttribute('abbr')).toBe('Sunday');
  });

  it('opens on today when the text is unreadable', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="someday" />);
    await user.click(screen.getByRole('button', { name: 'Choose start date' }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeDefined();
  });

  it('closes the calendar on Esc without closing the dialog it is in', async () => {
    const user = userEvent.setup();
    function InDialog() {
      const focus = useRef<HTMLInputElement>(null);
      return (
        <Dialog open title="New event" variant="sheet" initialFocus={focus}>
          <input ref={focus} aria-label="Title" />
          <Controlled />
        </Dialog>
      );
    }
    render(<InDialog />);
    const dialog = screen.getByRole('dialog', { name: 'New event' });
    expect(dialog.className).toContain('ag-dialog--sheet');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
    });
    const toggle = within(dialog).getByRole('button', { name: /^Choose start date/ });
    await user.click(toggle);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(document.activeElement).toBe(toggle);
  });

  it('has no axe violations, open or closed', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlled error="Enter a date, like 27 Oct 2026" />);
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: /^Choose start date/ }));
    await expectNoAxeViolations(container);
  });
});

describe('Dialog escape', () => {
  it('still closes on Esc from elsewhere in the dialog', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Details">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog').className).toBe('ag-dialog');
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
