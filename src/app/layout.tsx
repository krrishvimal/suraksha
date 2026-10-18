import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { LanguageProvider } from '@/lib/i18n';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// ---------------------------------------------------------------------------
// Metadata & Viewport (Next.js 15+ export-based API)
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Suraksha — Personal Safety',
  description:
    'Privacy-first personal safety tool. Emergency ID, safety check-ins, and SOS messages. No signup required.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Suraksha',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0A',
};

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LanguageProvider>
          <Suspense fallback={<div className="h-14 w-full border-b border-card-border bg-background" />}>
            <Header />
          </Suspense>

          <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>

          <Footer />
          <ServiceWorkerRegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
