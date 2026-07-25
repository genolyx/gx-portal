import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gx-Portal',
  description: 'Genolyx Analysis Portal',
};

const wantedSans = localFont({
  src: [
    { path: './fonts/WantedSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/WantedSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/WantedSans-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/WantedSans-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/WantedSans-ExtraBold.woff2', weight: '800', style: 'normal' },
    { path: './fonts/WantedSans-Black.woff2', weight: '900', style: 'normal' },
    { path: './fonts/WantedSans-ExtraBlack.woff2', weight: '950', style: 'normal' },
  ],
  variable: '--font-wanted-sans',
  display: 'swap',
});

const themeInitScript = `
try {
  var theme = localStorage.getItem('gx-portal-theme');
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }
  var fs = localStorage.getItem('gx-portal-font-size');
  document.documentElement.setAttribute(
    'data-font-size',
    (fs === 'sm' || fs === 'lg') ? fs : 'md'
  );
} catch (e) {
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-font-size', 'md');
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={wantedSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={wantedSans.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
