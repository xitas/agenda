import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { MiniMonth } from './MiniMonth.js';
import type { MiniMonthProps } from './MiniMonth.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

function setup(props: Partial<MiniMonthProps> = {}) {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  const user = userEvent.setup();
  render(
    <MiniMonth
      today="2026-10-27"
      selected="2026-10-27"
      locale={enGB}
      onSelect={onSelect}
      onMonthChange={onMonthChange}
      {...props}
    />,
  );
  const grid = () => screen.getByRole('grid');
  const day = (label: string) =>
    within(grid()).getByRole('gridcell', { name: new RegExp(`^${label}`) });
  const title = () => screen.getByRole('heading', { level: 2 }).textContent;
  const focused = () => (document.activeElement as HTMLElement).getAttribute('aria-label');
  return { user, onSelect, onMonthChange, grid, day, title, focused };
}

describe('MiniMonth rendering', () => {
  it('shows the month, Monday-first weekday headers and 6 weeks', () => {
    const { grid, title } = setup();
    expect(title()).toBe('October 2026');
    const headers = within(grid()).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(headers[0]?.getAttribute('abbr')).toBe('Monday');
    expect(within(grid()).getAllByRole('row')).toHaveLength(7); // header + 6 weeks
    expect(within(grid()).getAllByRole('gridcell')).toHaveLength(42);
  });

  it('marks today, the selected day, days outside the month and days with events', () => {
    const { day } = setup({
      selected: '2026-10-30',
      eventDays: new Set(['2026-10-30', '2026-11-02']),
    });
    const today = day('Tuesday, 27 October 2026');
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.className).toContain('ag-minimonth__day--today');

    const selected = day('Friday, 30 October 2026, has events');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.querySelector('.ag-minimonth__dot')).not.toBeNull();

    expect(day('Monday, 28 September 2026').className).toContain('ag-minimonth__day--outside');
    expect(day('Monday, 2 November 2026, has events').className).toContain(
      'ag-minimonth__day--outside',
    );
    expect(day('Tuesday, 27 October 2026').getAttribute('aria-selected')).toBe('false');
  });

  it('crosses the year boundary', async () => {
    const { user, title, day, onMonthChange } = setup({
      today: '2026-12-15',
      selected: '2026-12-15',
    });
    expect(title()).toBe('December 2026');
    expect(day('Monday, 30 November 2026')).toBeDefined();
    expect(day('Sunday, 10 January 2027')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(title()).toBe('January 2027');
    expect(onMonthChange).toHaveBeenCalledWith('2027-01-01');
    expect(day('Monday, 28 December 2026')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(title()).toBe('November 2026');
  });

  it('follows the locale for names', () => {
    setup({ locale: enUS });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('October 2026');
    expect(screen.getByRole('gridcell', { name: /^Tuesday, October 27, 2026/ })).toBeDefined();
  });

  it('opens on today without a selected day and follows a new selected day', () => {
    const { rerender } = render(
      <MiniMonth today="2026-10-27" locale={enGB} onSelect={() => undefined} />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('October 2026');
    expect(screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0)).toHaveLength(1);
    rerender(
      <MiniMonth
        today="2026-10-27"
        selected="2027-03-05"
        locale={enGB}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('March 2027');
  });
});

describe('MiniMonth keyboard (date grid pattern)', () => {
  it('has exactly one day in the tab order: the selected one', async () => {
    const { user, grid, focused } = setup();
    const tabbable = within(grid())
      .getAllByRole('gridcell')
      .filter((cell) => cell.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    await user.tab(); // Previous month
    await user.tab(); // Next month
    await user.tab(); // the grid
    expect(focused()).toBe('Tuesday, 27 October 2026');
  });

  it('moves by day and week with the arrow keys', async () => {
    const { user, day, focused } = setup();
    day('Tuesday, 27 October 2026').focus();
    await user.keyboard('{ArrowRight}');
    expect(focused()).toBe('Wednesday, 28 October 2026');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(focused()).toBe('Monday, 26 October 2026');
    await user.keyboard('{ArrowUp}');
    expect(focused()).toBe('Monday, 19 October 2026');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(focused()).toBe('Monday, 2 November 2026');
  });

  it('changes month when focus leaves it, and calls onMonthChange', async () => {
    const { user, day, title, focused, onMonthChange } = setup({ selected: '2026-10-31' });
    day('Saturday, 31 October 2026').focus();
    await user.keyboard('{ArrowRight}');
    expect(focused()).toBe('Sunday, 1 November 2026');
    expect(title()).toBe('November 2026');
    expect(onMonthChange).toHaveBeenCalledWith('2026-11-01');
  });

  it('jumps to the start and end of the week with Home and End', async () => {
    const { user, day, focused } = setup();
    day('Tuesday, 27 October 2026').focus();
    await user.keyboard('{End}');
    expect(focused()).toBe('Sunday, 1 November 2026');
    await user.keyboard('{Home}');
    expect(focused()).toBe('Monday, 26 October 2026');
  });

  it('changes month with PageUp and PageDown, clamping the day', async () => {
    const { user, day, title, focused } = setup({ selected: '2026-01-31', today: '2026-01-31' });
    day('Saturday, 31 January 2026').focus();
    await user.keyboard('{PageDown}');
    expect(title()).toBe('February 2026');
    expect(focused()).toBe('Saturday, 28 February 2026');
    await user.keyboard('{PageUp}{PageUp}');
    expect(title()).toBe('December 2025');
    expect(focused()).toBe('Sunday, 28 December 2025');
  });

  it('selects with Enter or Space, and by clicking', async () => {
    const { user, day, onSelect } = setup();
    day('Tuesday, 27 October 2026').focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('2026-10-28');
    await user.keyboard('{ArrowRight} ');
    expect(onSelect).toHaveBeenLastCalledWith('2026-10-29');
    await user.click(day('Monday, 2 November 2026'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-11-02');
  });

  it('ignores other keys', async () => {
    const { user, day, focused, onSelect } = setup();
    day('Tuesday, 27 October 2026').focus();
    await user.keyboard('a');
    expect(focused()).toBe('Tuesday, 27 October 2026');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('MiniMonth accessibility', () => {
  it('has no axe violations', async () => {
    render(
      <MiniMonth
        today="2026-10-27"
        selected="2026-10-29"
        eventDays={new Set(['2026-10-29'])}
        locale={enGB}
        onSelect={() => undefined}
      />,
    );
    await expectNoAxeViolations(document.body);
  });
});
