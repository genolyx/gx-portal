'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { ScrollShadow, Separator } from '@heroui/react';
import { cn } from '../../lib/utils';

type SidebarContextValue = {
  activeHref?: string | null;
};

const SidebarContext = createContext<SidebarContextValue>({});

function useSidebar() {
  return useContext(SidebarContext);
}

function Provider({
  children,
  activeHref,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & { activeHref?: string | null }) {
  return (
    <SidebarContext.Provider value={{ activeHref }}>
      <div className={cn('sidebar__provider', className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Root({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'aside'>) {
  return (
    <aside className={cn('sidebar', className)} data-state="expanded" {...props}>
      {children}
    </aside>
  );
}

function Header({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('sidebar__header', className)} {...props}>
      {children}
    </div>
  );
}

function Content({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <ScrollShadow
      hideScrollBar
      orientation="vertical"
      className={cn('sidebar__content', className)}
      {...props}
    >
      {children}
    </ScrollShadow>
  );
}

function Footer({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('sidebar__footer', className)} {...props}>
      {children}
    </div>
  );
}

function Group({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('sidebar__group', className)} {...props}>
      {children}
    </div>
  );
}

function GroupLabel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'p'>) {
  return (
    <p className={cn('sidebar__group-label', className)} {...props}>
      {children}
    </p>
  );
}

function Menu({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'nav'>) {
  return (
    <nav className={cn('sidebar__menu', className)} {...props}>
      {children}
    </nav>
  );
}

function MenuItem({
  href,
  icon,
  children,
  className,
  exact,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
  icon?: ReactNode;
  exact?: boolean;
}) {
  const { activeHref } = useSidebar();
  const current = exact
    ? activeHref === href
    : Boolean(activeHref?.startsWith(href));

  return (
    <Link
      href={href}
      data-current={current ? 'true' : undefined}
      className={cn('sidebar__menu-item', className)}
      {...props}
    >
      <span className="sidebar__menu-item-content">
        {icon != null && <span className="sidebar__menu-icon">{icon}</span>}
        <span className="sidebar__menu-label">
          <span className="sidebar__menu-label-text">{children}</span>
        </span>
      </span>
    </Link>
  );
}

function SidebarSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Separator>) {
  return <Separator className={cn('sidebar__separator', className)} {...props} />;
}

function Main({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'main'>) {
  return (
    <main className={cn('sidebar__main', className)} {...props}>
      {children}
    </main>
  );
}

export const Sidebar = Object.assign(Root, {
  Provider,
  Header,
  Content,
  Footer,
  Group,
  GroupLabel,
  Menu,
  MenuItem,
  Separator: SidebarSeparator,
  Main,
});
