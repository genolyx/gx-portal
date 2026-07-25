'use client';

import { I18nProvider, Toast } from '@heroui/react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="en-US">
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="gx-portal-theme"
      >
        {children}
        <Toast.Provider placement="bottom end" />
      </ThemeProvider>
    </I18nProvider>
  );
}
