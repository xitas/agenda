import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TimeField } from './TimeField.js';
import type { TimeFieldProps } from './TimeField.js';
import { expectNoAxeViolations } from './test-utils/axe.js';

function Controlled(
  props: Partial<TimeFieldProps> & { initial?: string; onValue?: (value: string) => void },
) {
  const { initial = '16:30', onValue, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <TimeField
      label="Start time"
      hour12={false}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      {...rest}
    />
  );
}

const field = () => screen.getByRole('textbox', { name: 'Start time' });

describe('TimeField', () => {
  it('shows the time on the chosen clock', () => {
    const { rerender } = render(<Controlled />);
    expect(field()).toHaveProperty('value', '16:30');
    rerender(<Controlled hour12 />);
    expect(field()).toHaveProperty('value', '4:30 PM');
  });

  it('reads what is typed, on blur and on Enter', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} hour12 />);
    await user.clear(field());
    await user.type(field(), '9am');
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith('09:00');
    expect(field()).toHaveProperty('value', '9:00 AM');
    await user.clear(field());
    await user.type(field(), '1730{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('17:30');
    expect(field()).toHaveProperty('value', '5:30 PM');
  });

  it('passes unreadable text on for the form to flag, and leaves an untouched field alone', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.click(field());
    await user.tab();
    expect(onValue).not.toHaveBeenCalled();
    await user.clear(field());
    await user.type(field(), ' later ');
    await user.tab();
    expect(onValue).toHaveBeenLastCalledWith('later');
  });

  it('steps by 15 minutes with the arrows, from typed text too', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} initial="23:50" />);
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(onValue).toHaveBeenLastCalledWith('00:05');
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(onValue).toHaveBeenLastCalledWith('23:50');
    await user.clear(field());
    await user.type(field(), '9:00');
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(onValue).toHaveBeenLastCalledWith('08:45');
    // Nothing readable to step from: the key does nothing.
    onValue.mockClear();
    await user.clear(field());
    await user.type(field(), 'x');
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    fireEvent.keyDown(field(), { key: 'a' });
    expect(onValue).not.toHaveBeenCalled();
  });

  it('describes its format and its error, with no axe violations', async () => {
    const { container } = render(<Controlled hour12 error="Enter a time, like 14:30" />);
    const described = (field().getAttribute('aria-describedby') ?? '').split(' ');
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'For example 4:30 PM. Up and down arrows change it by 15 minutes.',
      'Enter a time, like 14:30',
    ]);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    await expectNoAxeViolations(container);
  });
});
