import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'COVENANT — Proof-conditioned credit',
  description: 'Cross-chain credit lines whose next tranche unlocks only after Attestcoin verifies the obligation.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
