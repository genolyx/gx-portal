'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@gx-portal/types';
import { cn } from '../../lib/utils';
import { ThemeToggle, FontSizeToggle } from './ThemeToggle';
import { authApi } from '../../lib/api/auth';
import { systemApi } from '../../lib/api/system';
import { Button } from '../ui/Button';

type NavItem =
  | { href: string; label: string; icon: string; group?: string; divider?: never }
  | { divider: true; href?: never; label?: never; icon?: never };

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',    icon: '▦' },
  { href: '/orders',       label: 'Orders',       icon: '⊞' },
  { href: '/review',       label: 'Review',       icon: '◈' },
  { divider: true },
  { href: '/variant-sets', label: 'Variant Sets', icon: '⊕' },
  { href: '/literature',   label: 'Literature',   icon: '📚' },
  { href: '/panels',       label: 'Panels',       icon: '⊟' },
  { divider: true },
  { href: '/admin/clients', label: 'Clients', icon: '⊡', group: 'Admin' },
  { href: '/admin/labs',    label: 'Labs',    icon: '⊜', group: 'Admin' },
  { href: '/admin/users',   label: 'Users',   icon: '⊛', group: 'Admin' },
  { divider: true },
  { href: '/config', label: 'Config', icon: '⚙' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [daemonOk, setDaemonOk] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  let shownAdmin = false;

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const check = () => {
      systemApi.health().then((h: unknown) => {
        const health = h as { daemon?: { status?: string } };
        setDaemonOk(health?.daemon?.status !== 'unreachable');
      }).catch(() => setDaemonOk(false));
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Still redirect — cookie may already be cleared or network failed.
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gx-bg">
      {/* Sidebar */}
      <aside className="w-[220px] flex-none bg-gx-surface border-r border-gx-border flex flex-col overflow-y-auto">
        {/* Logo + daemon status */}
        <div className="px-4 pt-5 pb-3 border-b border-gx-border">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[22px] text-gx-accent">⬡</span>
            <span className="font-bold text-base text-gx-text">Gx-Portal</span>
          </div>
          {/* Daemon status pill */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
              daemonOk === null  && 'bg-gx-elevated text-gx-muted',
              daemonOk === true  && 'bg-gx-success/10 text-gx-success',
              daemonOk === false && 'bg-gx-danger/10  text-gx-danger',
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full flex-none',
                daemonOk === null  && 'bg-gx-muted',
                daemonOk === true  && 'bg-gx-success',
                daemonOk === false && 'bg-gx-danger',
              )}
            />
            {daemonOk === null
              ? 'checking…'
              : daemonOk
              ? 'gx-daemon connected'
              : 'gx-daemon unreachable'}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col p-3 gap-0.5 flex-1">
          {NAV_ITEMS.map((item, i) => {
            if ('divider' in item && item.divider) {
              return <div key={`d-${i}`} className="h-px bg-gx-border my-2" />;
            }
            const nav = item as { href: string; label: string; icon: string; group?: string };
            const active = pathname?.startsWith(nav.href) ?? false;
            const showGroup = nav.group && !shownAdmin;
            if (nav.group) shownAdmin = true;
            return (
              <div key={nav.href}>
                {showGroup && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gx-muted px-3 pt-2 pb-1">
                    {nav.group}
                  </p>
                )}
                <Link
                  href={nav.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-gx text-sm font-medium transition-colors',
                    active
                      ? 'bg-gx-accent-dim text-gx-accent'
                      : 'text-gx-text-2 hover:bg-gx-elevated hover:text-gx-text',
                  )}
                >
                  <span className="w-5 text-center text-base">{nav.icon}</span>
                  <span>{nav.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Footer — font size, theme, account */}
        <div className="p-3 border-t border-gx-border flex flex-col gap-3">
          <FontSizeToggle />
          <div className="h-px bg-gx-border" />
          <ThemeToggle />
          <div className="h-px bg-gx-border" />
          <div className="flex flex-col gap-2 px-1">
            <p
              className="text-xs text-gx-text-2 truncate"
              title={user?.email ?? user?.username ?? undefined}
            >
              {user?.email ?? user?.username ?? '…'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={loggingOut}
              className="w-full justify-start px-2 text-gx-text-2 hover:text-gx-text"
              onClick={handleLogout}
            >
              Log-out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 py-7">{children}</main>
    </div>
  );
}
