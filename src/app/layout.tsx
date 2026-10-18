import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'DukaanVoice PK — ڈیجیٹل دکان کھاتہ و پوائنٹ آف سیل',
  description: 'A fast digital shop register and point-of-sale for Pakistani retailers. Counter sales, inventory, Udhaar Khata, Roznamcha cash closing, and expenses in Urdu and Pakistani languages.',
  keywords: 'POS, Pakistan shop register, inventory, udhaar khata, roznamcha, dukaan, urdu',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
