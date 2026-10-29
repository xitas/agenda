import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface MenuProps {
  /** The button that opens the menu; it gets aria-haspopup and aria-expanded. */
  trigger: ReactNode;
  items: MenuItem[];
}

/**
 * A dropdown menu (WAI-ARIA menu button). Radix provides the keyboard behaviour: Enter,
 * Space or ↓ open it, arrows move between items, typing jumps to an item, Esc closes it
 * and focus returns to the button.
 */
export function Menu({ trigger, items }: MenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content className="ag-menu" align="end" sideOffset={4}>
          {items.map((item) => (
            <RadixMenu.Item key={item.label} className="ag-menu__item" onSelect={item.onSelect}>
              {item.icon !== undefined && (
                <span className="ag-menu__icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
