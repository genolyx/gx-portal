'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Building2,
  ClipboardList,
  FlaskConical,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  ScanSearch,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button, Tooltip } from '@heroui/react';
import type { UserProfile } from '@gx-portal/types';
import { ThemeToggle, FontSizeToggle } from './ThemeToggle';
import { Sidebar } from './Sidebar';
import { authApi } from '../../lib/api/auth';
import { systemApi } from '../../lib/api/system';
import { WEB_VERSION } from '../../lib/app-version';
import { activeDaemonUrl, DAEMON_URL_KEY, resolveDaemonPreset } from '../../lib/daemon-presets';

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavLink[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/orders', label: 'Orders', icon: ClipboardList },
      { href: '/review', label: 'Review', icon: ScanSearch },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/variant-sets', label: 'Variant Sets', icon: Layers },
      { href: '/literature', label: 'Literature', icon: BookOpen },
      { href: '/panels', label: 'Panels', icon: LayoutGrid },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/clients', label: 'Clients', icon: Building2 },
      { href: '/admin/labs', label: 'Labs', icon: FlaskConical },
      { href: '/admin/users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/config', label: 'Config', icon: Settings },
      { href: '/admin/resources', label: 'Resource Monitor', icon: Activity, adminOnly: true },
    ],
  },
];

function userLabel(user: UserProfile | null): string {
  return user?.display_name || user?.username || user?.email || '…';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [daemonOk, setDaemonOk] = useState<boolean | null>(null);
  const [daemonLabel, setDaemonLabel] = useState<string>('gx-daemon');
  const [daemonUrl, setDaemonUrl] = useState<string>('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [apiVersion, setApiVersion] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const savedUrl = localStorage.getItem(DAEMON_URL_KEY);
    systemApi.getConfig().then((cfg) => {
      const url = activeDaemonUrl(savedUrl, cfg.daemonUrl);
      setDaemonUrl(url);
      const preset = resolveDaemonPreset(url);
      if (preset) setDaemonLabel(preset.label);
    }).catch(() => {
      const url = savedUrl ?? '';
      setDaemonUrl(url);
      const preset = resolveDaemonPreset(url);
      if (preset) setDaemonLabel(preset.label);
    });
  }, []);

  useEffect(() => {
    const check = () => {
      systemApi.health().then((health) => {
        setDaemonOk(health?.daemon?.status !== 'unreachable');
        if (health?.version) setApiVersion(health.version);
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
      // Still redirect
    }
    router.push('/login');
    router.refresh();
  };

  const daemonStatus =
    daemonOk === null ? 'pending' : daemonOk ? 'ok' : 'error';
  const daemonStateLabel =
    daemonOk === null ? 'checking…' : daemonOk ? 'connected' : 'disconnected';
  const daemonAriaLabel = `${daemonLabel}: ${daemonStateLabel}`;

  return (
    <Sidebar.Provider activeHref={pathname}>
      <Sidebar>
        <Sidebar.Header>
          <div className="sidebar__brand">
            <span className="sidebar__brand-mark" aria-hidden>⬡</span>
            <span className="sidebar__brand-title">Gx-Portal</span>
            <Tooltip delay={200}>
              <Tooltip.Trigger
                className="sidebar__status-dot"
                data-status={daemonStatus}
                aria-label={daemonAriaLabel}
                role="status"
              />
              <Tooltip.Content showArrow placement="bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{daemonLabel}</span>
                  {daemonUrl ? (
                    <span className="text-xs opacity-80 font-mono">{daemonUrl}</span>
                  ) : null}
                  <span className="text-xs opacity-80">{daemonStateLabel}</span>
                </div>
              </Tooltip.Content>
            </Tooltip>
          </div>
        </Sidebar.Header>

        <Sidebar.Content>
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !item.adminOnly || user?.role === 'admin',
            );
            if (items.length === 0) return null;
            return (
              <Sidebar.Group key={group.label ?? 'main'}>
                {group.label && (
                  <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
                )}
                <Sidebar.Menu>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Sidebar.MenuItem
                        key={item.href}
                        href={item.href}
                        icon={<Icon size={18} strokeWidth={1.85} aria-hidden />}
                      >
                        {item.label}
                      </Sidebar.MenuItem>
                    );
                  })}
                </Sidebar.Menu>
              </Sidebar.Group>
            );
          })}
        </Sidebar.Content>

        <Sidebar.Footer>
          <FontSizeToggle />
          <ThemeToggle />
          <Sidebar.Separator />
          <div className="sidebar__user">
            <p
              className="sidebar__user-name"
              title={user?.email ?? user?.username ?? undefined}
            >
              {userLabel(user)}
            </p>
            {user?.role && <p className="sidebar__user-role">{user.role}</p>}
            <p
              className="sidebar__user-versions"
              title={`API v${apiVersion ?? '…'} · Web v${WEB_VERSION}`}
            >
              API v{apiVersion ?? '…'} Web v{WEB_VERSION}
            </p>
          </div>
          <Button
            type="button"
            variant="danger-soft"
            size="sm"
            isDisabled={loggingOut}
            fullWidth
            onPress={handleLogout}
            className="justify-center gap-2"
          >
            <LogOut size={15} strokeWidth={2} aria-hidden />
            {loggingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </Sidebar.Footer>
      </Sidebar>

      <Sidebar.Main>{children}</Sidebar.Main>
    </Sidebar.Provider>
  );
}
