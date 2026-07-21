'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.css';

type NavItem =
  | { href: string; label: string; icon: string; group?: string; divider?: never }
  | { divider: true; href?: never; label?: never; icon?: never };

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/orders', label: 'Orders', icon: '⊞' },
  { href: '/review', label: 'Review', icon: '◈' },
  { href: '/panels', label: 'Panels', icon: '▤' },
  { href: '/literature', label: 'Literature', icon: '⊟' },
  { href: '/config', label: 'Config', icon: '⚙' },
  { divider: true },
  { href: '/admin/clients', label: 'Clients', icon: '⊡', group: 'Admin' },
  { href: '/admin/labs', label: 'Labs', icon: '⊜', group: 'Admin' },
  { href: '/admin/users', label: 'Users', icon: '⊛', group: 'Admin' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  let shownAdmin = false;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>Gx-Portal</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item, i) => {
            if ('divider' in item && item.divider) {
              return <div key={`div-${i}`} className={styles.divider} />;
            }
            const navItem = item as { href: string; label: string; icon: string; group?: string };
            const isActive = pathname?.startsWith(navItem.href) ?? false;
            const showGroup = navItem.group && !shownAdmin;
            if (navItem.group) shownAdmin = true;
            return (
              <div key={navItem.href}>
                {showGroup && (
                  <p className={styles.groupLabel}>{navItem.group}</p>
                )}
                <Link
                  href={navItem.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.navIcon}>{navItem.icon}</span>
                  <span className={styles.navLabel}>{navItem.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
