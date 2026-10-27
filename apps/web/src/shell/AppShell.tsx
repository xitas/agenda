import { APP_NAME } from '@agenda/core';
import { Dialog, IconButton, useToast } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, CalendarRange, LogOut, Search, Sun } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useApi } from '../app/api';
import { CalendarPanel } from './CalendarPanel';

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
];

export interface AppShellProps {
  /** The QuickAdd field, at the top of every screen. */
  quickAdd?: ReactNode;
}

/**
 * The frame around every signed-in screen (DESIGN.md §4). There is one nav; CSS places it
 * in the sidebar from 1024 px, in the top bar from 768 px, and at the bottom below that.
 * The calendar sits in the sidebar, or behind a top-bar button when there is no sidebar.
 */
export function AppShell({ quickAdd }: AppShellProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { pathname } = useLocation();

  const logout = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      // Everything cached belonged to this session.
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
    onError: () => {
      toast({ message: "Couldn't log out. Check your connection and try again." });
    },
  });

  return (
    <div className="shell">
      <a className="shell__skip" href="#main">
        Skip to content
      </a>
      <nav className="shell__nav" aria-label="Views">
        <p className="shell__brand">{APP_NAME}</p>
        <ul>
          {NAV.map((item) => {
            // Any day page belongs to Today.
            const active =
              pathname === item.to || (item.to === '/' && pathname.startsWith('/day/'));
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
        <div className="shell__quick-add">{quickAdd}</div>
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
          <IconButton
            label="Log out"
            icon={<LogOut />}
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate();
            }}
          />
        </div>
      </header>

      <main id="main" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
