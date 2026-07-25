import type { Metadata } from 'next';
import localFont from 'next/font/local';
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
    <html lang="ko" className={wantedSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={wantedSans.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
