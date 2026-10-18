'use client';

import { Shield } from 'lucide-react';

interface SurakshaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'inline' | 'stacked';
  showShield?: boolean;
  className?: string;
  glow?: boolean;
}

export default function SurakshaLogo({
  size = 'md',
  variant = 'inline',
  showShield = true,
  className = '',
  glow = true,
}: SurakshaLogoProps) {
  // Size configurations
  const config = {
    sm: {
      shield: 'h-6 w-6',
      enText: 'text-base font-black tracking-wider',
      hiText: 'text-xs font-bold tracking-normal',
      gap: 'gap-1.5',
      divider: 'text-emerald-500/50 text-xs font-mono',
      subtext: 'text-[9px]',
    },
    md: {
      shield: 'h-8 w-8',
      enText: 'text-xl font-black tracking-wider',
      hiText: 'text-sm font-bold tracking-normal',
      gap: 'gap-2',
      divider: 'text-emerald-500/50 text-sm font-mono',
      subtext: 'text-[10px]',
    },
    lg: {
      shield: 'h-14 w-14',
      enText: 'text-3xl sm:text-4xl font-black tracking-wider',
      hiText: 'text-2xl sm:text-3xl font-extrabold tracking-wide',
      gap: 'gap-3',
      divider: 'text-emerald-400/60 text-2xl font-mono',
      subtext: 'text-xs sm:text-sm',
    },
    xl: {
      shield: 'h-20 w-20',
      enText: 'text-4xl sm:text-6xl font-black tracking-widest',
      hiText: 'text-3xl sm:text-5xl font-extrabold tracking-wider',
      gap: 'gap-4',
      divider: 'text-emerald-400/70 text-3xl font-mono',
      subtext: 'text-sm sm:text-base',
    },
  }[size];

  const shieldGlow = glow
    ? 'drop-shadow-[0_0_16px_rgba(34,197,94,0.45)]'
    : '';

  const textGlow = glow
    ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]'
    : '';

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {showShield && (
          <div className="relative mb-3 flex items-center justify-center">
            {glow && (
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/25 blur-xl animate-pulse"
                aria-hidden="true"
              />
            )}
            <Shield
              className={`${config.shield} text-emerald-400 relative z-10 ${shieldGlow}`}
              aria-hidden="true"
            />
          </div>
        )}

        {/* English First */}
        <div className="flex items-center gap-2">
          <span
            className={`${config.enText} bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent uppercase font-sans ${textGlow}`}
          >
            Suraksha
          </span>
        </div>

        {/* Hindi Second */}
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="h-px w-6 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          <span
            className={`${config.hiText} text-emerald-400/90 font-sans tracking-wide`}
            style={{
              fontFamily:
                "'Rozha One', 'Yatra One', 'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Nirmala UI', sans-serif",
            }}
          >
            सुरक्षा
          </span>
          <span className="h-px w-6 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        </div>
      </div>
    );
  }

  // Inline Variant (Header & standard headers)
  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {showShield && (
        <Shield
          className={`${config.shield} text-emerald-400 shrink-0 ${shieldGlow}`}
          aria-hidden="true"
        />
      )}

      <div className="flex items-baseline gap-1.5 sm:gap-2">
        {/* English First */}
        <span
          className={`${config.enText} bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 bg-clip-text text-transparent uppercase font-sans ${textGlow}`}
        >
          Suraksha
        </span>

        {/* Subtle separator */}
        <span className={config.divider} aria-hidden="true">
          •
        </span>

        {/* Hindi Second */}
        <span
          className={`${config.hiText} text-emerald-300/90 tracking-wide`}
          style={{
            fontFamily:
              "'Rozha One', 'Yatra One', 'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Nirmala UI', sans-serif",
          }}
        >
          सुरक्षा
        </span>
      </div>
    </div>
  );
}
