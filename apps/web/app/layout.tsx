import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gx-Portal',
  description: 'Genolyx Analysis Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
