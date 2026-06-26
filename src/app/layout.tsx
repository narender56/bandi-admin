import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Bandi Admin',
  description: 'Bandi operations console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
