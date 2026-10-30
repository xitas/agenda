import { APP_NAME } from '@agenda/core';
import { Dialog, IconButton, Menu } from '@agenda/ui';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CircleUser,
  Keyboard,
  LogOut,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { PreferencesProvider } from '../app/PreferencesProvider';
import { useLogout } from '../auth/logout';
import { EventActionsProvider } from '../events/EventActionsProvider';
import { QuickAdd } from '../quick-add/QuickAdd';
import { CalendarPanel } from './CalendarPanel';
import { GlobalShortcuts } from './GlobalShortcuts';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: <Sun /> },
  { to: '/week', label: 'Week', icon: <CalendarRange /> },
  { to: '/month', label: 'Month', icon: <CalendarDays /> },
  { to: '/search', label: 'Search', icon: <Search /> },
  { to: '/settings', label: 'Settings', icon: <Settings /> },
];

/**
 * The frame around every signed-in screen (DESIGN.md §4). There is one nav; CSS places it
 * in the sidebar from 1024 px, in the top bar from 768 px, and at the bottom below that.
 * The calendar sits in the sidebar, or behind a top-bar button when there is no sidebar.
 */
export function AppShell() {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { pathname } = useLocation();
  const logout = useLogout();

  return (
    <PreferencesProvider>
      <EventActionsProvider>
        <div className="shell">
          <a className="shell__skip" href="#main">
            Skip to content
          </a>
          <nav className="shell__nav" aria-label="Views">
            <p className="shell__brand">{APP_NAME}</p>
            <ul>
              {NAV.map((item) => {
                // Any day page belongs to Today; dated pages belong to their view.
                const active =
                  pathname === item.to ||
                  pathname.startsWith(item.to === '/' ? '/day/' : `${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={active ? 'shell__link shell__link--active' : 'shell__link'}
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                    >
                      <span className="shell__link-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="shell__link-label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <aside className="shell__calendar" aria-label="Calendar">
            <CalendarPanel />
          </aside>

          <header className="shell__top">
            <div className="shell__quick-add">
              <QuickAdd />
            </div>
            <div className="shell__actions">
              <span className="shell__calendar-button">
                <Dialog
                  open={calendarOpen}
                  onOpenChange={setCalendarOpen}
                  title="Go to a day"
                  trigger={<IconButton label="Calendar" icon={<Calendar />} />}
                >
                  <CalendarPanel
                    onPicked={() => {
                      setCalendarOpen(false);
                    }}
                  />
                </Dialog>
              </span>
              <GlobalShortcuts helpOpen={helpOpen} onHelpOpenChange={setHelpOpen} />
              <Menu
                trigger={<IconButton label="Account" icon={<CircleUser />} />}
                items={[
                  {
                    label: 'Settings',
                    icon: <Settings />,
                    onSelect: () => {
                      void navigate('/settings');
                    },
                  },
                  {
                    label: 'Keyboard shortcuts',
                    icon: <Keyboard />,
                    onSelect: () => {
                      setHelpOpen(true);
                    },
                  },
                  {
                    label: 'Log out',
                    icon: <LogOut />,
                    onSelect: () => {
                      logout.mutate();
                    },
                  },
                ]}
              />
            </div>
          </header>

          <main id="main" className="shell__main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </EventActionsProvider>
    </PreferencesProvider>
  );
}
