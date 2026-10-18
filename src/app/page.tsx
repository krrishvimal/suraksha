'use client';

import Link from 'next/link';
import {
  Shield,
  CreditCard,
  HeartPulse,
  MessageCircleWarning,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { APP_NAME } from '@/lib/constants';
import SurakshaLogo from '@/components/SurakshaLogo';

// ---------------------------------------------------------------------------
// Feature card data
// ---------------------------------------------------------------------------

interface Feature {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  emoji: string;
  glowColor: string;
}

const FEATURES: Feature[] = [
  {
    href: '/qr-card',
    icon: CreditCard,
    emoji: '🪪',
    titleEn: 'Emergency ID Card',
    titleHi: 'आपातकालीन ID कार्ड',
    descEn: 'Carry your emergency info as a QR code',
    descHi: 'अपनी आपातकालीन जानकारी QR कोड के रूप में रखें',
    glowColor: 'rgba(59, 130, 246, 0.15)',
  },
  {
    href: '/check-in',
    icon: HeartPulse,
    emoji: '✅',
    titleEn: "I'm Safe Check-In",
    titleHi: 'मैं सुरक्षित हूँ चेक-इन',
    descEn: "Let loved ones know you're okay",
    descHi: 'अपनों को बताएं कि आप सुरक्षित हैं',
    glowColor: 'rgba(34, 197, 94, 0.15)',
  },
  {
    href: '/sos',
    icon: MessageCircleWarning,
    emoji: '💬',
    titleEn: 'SOS Messages',
    titleHi: 'SOS संदेश',
    descEn: 'One-tap emergency messages with location',
    descHi: 'एक टैप में लोकेशन के साथ आपातकालीन संदेश',
    glowColor: 'rgba(239, 68, 68, 0.15)',
  },
];

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center gap-10 py-6">
      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-5 text-center">
        {/* Shield with glow */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring */}
          <div
            className="absolute h-28 w-28 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, #22C55E 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          {/* Inner glow ring */}
          <div
            className="absolute h-20 w-20 rounded-full opacity-60 blur-xl"
            style={{ background: 'radial-gradient(circle, #22C55E 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          <Shield
            size={72}
            className="relative z-10 text-safe drop-shadow-[0_0_24px_rgba(34,197,94,0.4)]"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col items-center">
          <SurakshaLogo size="lg" variant="inline" showShield={false} />
        </div>

        <p className="text-base sm:text-lg text-neutral-300 font-medium">
          {t('Your Personal Safety Tool • 100% Private', 'आपका व्यक्तिगत सुरक्षा कवच • 100% निजी')}
        </p>

        {/* Privacy badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-safe/30 bg-safe/10 px-4 py-2 text-sm font-medium text-safe">
          <Lock size={14} aria-hidden="true" />
          {t(
            '100% Private. No Signup. Works Offline.',
            '100% निजी। कोई साइनअप नहीं। ऑफ़लाइन काम करता है।',
          )}
        </span>
      </section>

      {/* ── Feature Cards ────────────────────────────────────────────── */}
      <section
        className="flex w-full flex-col gap-4"
        aria-label={t('Features', 'विशेषताएं')}
      >
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group card flex items-center gap-4 transition-all duration-200 hover:scale-[1.02] hover:border-safe/40 active:scale-[0.98]"
              style={{
                boxShadow: 'none',
                transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  `0 0 30px ${feature.glowColor}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {/* Icon area */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card-border/50">
                <Icon
                  size={28}
                  className="text-safe transition-transform duration-200 group-hover:scale-110"
                  aria-hidden="true"
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  <span aria-hidden="true">{feature.emoji} </span>
                  {t(feature.titleEn, feature.titleHi)}
                </h2>
                <p className="mt-0.5 text-sm text-muted leading-snug">
                  {t(feature.descEn, feature.descHi)}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight
                size={20}
                className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-safe"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </section>

      {/* ── Privacy Notice ───────────────────────────────────────────── */}
      <section className="w-full rounded-2xl border border-card-border bg-card-bg/50 p-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <Lock size={20} className="text-muted" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "Your data never leaves your device. We don't collect, store, or track anything.",
              'आपका डेटा आपके डिवाइस से कभी बाहर नहीं जाता। हम कुछ भी एकत्र, संग्रहित या ट्रैक नहीं करते।',
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
