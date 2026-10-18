'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Home,
  QrCode,
  HeartPulse,
  MessageCircleWarning,
  Languages,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { APP_NAME, NAV_LINKS } from '@/lib/constants';
import SurakshaLogo from '@/components/SurakshaLogo';

// ---------------------------------------------------------------------------
// Nav icon mapping
// ---------------------------------------------------------------------------

const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  qr: QrCode,
  checkin: HeartPulse,
  sos: MessageCircleWarning,
};

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export default function Header() {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-card-border bg-background/90 backdrop-blur-md"
      role="banner"
    >
      {/* Top bar — branding + language toggle */}
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-85"
          aria-label={t('Go to Suraksha home', 'सुरक्षा होम पर जाएं')}
        >
          <SurakshaLogo size="sm" />
        </Link>

        <button
          type="button"
          onClick={toggleLanguage}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-card-border bg-card-bg text-sm font-semibold text-foreground transition-colors hover:border-muted focus-visible:outline-safe"
          aria-label={t('Switch to Hindi', 'Switch to English')}
        >
          {language === 'en' ? 'हि' : 'EN'}
        </button>
      </div>

      {/* Navigation bar */}
      <nav
        className="mx-auto max-w-md overflow-x-auto px-4 pb-2"
        role="navigation"
        aria-label={t('Main navigation', 'मुख्य नेविगेशन')}
      >
        <ul className="flex gap-1" role="list">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            const Icon = NAV_ICON_MAP[link.icon];
            const label = language === 'hi' ? link.labelHi : link.labelEn;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-safe/15 text-safe'
                      : 'text-muted hover:bg-card-bg hover:text-foreground'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {Icon && <Icon size={18} aria-hidden="true" />}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
