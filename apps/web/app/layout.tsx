import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gx-Portal',
  description: 'Genolyx Analysis Portal',
};

const themeInitScript = `
try {
  var theme = localStorage.getItem('gx-portal-theme');
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  var fs = localStorage.getItem('gx-portal-font-size');
  document.documentElement.setAttribute('data-font-size', (fs === 'md' || fs === 'lg') ? fs : 'sm');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.setAttribute('data-font-size', 'sm');
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
