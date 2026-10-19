'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X, Smartphone, Share, MoreVertical, Monitor } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const { t } = useLanguage();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if already installed as standalone
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return; // Already running as installed app

    // Check if dismissed this session
    try {
      if (sessionStorage.getItem('suraksha_install_dismissed') === '1') {
        setDismissed(true);
      }
    } catch { /* ignore */ }

    // Listen for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDismissed(true);
        }
      } catch {
        // Fall back to showing manual guide
        setShowGuide(true);
      }
      setDeferredPrompt(null);
    } else {
      // Browser didn't fire automatic prompt yet or doesn't support it — show clear manual steps
      setShowGuide(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowGuide(false);
    try {
      sessionStorage.setItem('suraksha_install_dismissed', '1');
    } catch { /* ignore */ }
  }, []);

  // Don't render until mounted (SSR safe) or if already running as standalone app or dismissed
  if (!mounted || isStandalone || dismissed) return null;

  return (
    <div className="mx-auto max-w-md px-4 mb-4">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-card-bg to-card-bg p-3.5 shadow-lg shadow-black/40">
        {/* Dismiss X */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-full text-muted hover:text-foreground transition-colors"
          aria-label={t('Dismiss', 'खारिज करें')}
        >
          <X size={15} />
        </button>

        {/* Main Banner Bar */}
        <div className="flex items-center gap-3 pr-6">
          <div className="flex-shrink-0 rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400 border border-emerald-500/30">
            <Download size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground tracking-tight">
              {t('Install Suraksha', 'सुरक्षा इंस्टॉल करें')}
            </h4>
            <p className="text-xs text-muted mt-0.5 truncate">
              {t('One-tap emergency access from Home Screen', 'होम स्क्रीन से तुरंत इमरजेंसी एक्सेस')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black transition-all hover:bg-emerald-400 active:scale-95 shadow-md shadow-emerald-500/20"
          >
            {t('Install', 'इंस्टॉल')}
          </button>
        </div>

        {/* Expandable Manual Guide (if native prompt isn't supported / iOS / manual) */}
        {showGuide && (
          <div className="mt-3.5 pt-3.5 border-t border-card-border/80 text-xs text-muted space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between text-foreground font-medium">
              <span>{t('How to install on your device:', 'अपने डिवाइस पर कैसे इंस्टॉल करें:')}</span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                {t('Close', 'बंद करें')}
              </button>
            </div>

            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="flex items-start gap-2 bg-black/40 rounded-lg p-2 border border-card-border/50">
                <Smartphone size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">Android (Chrome):</strong>{' '}
                  {t(
                    'Tap the menu icon (⋮) in the top-right → tap "Install app" or "Add to Home screen".',
                    'ऊपर दाईं ओर मेनू (⋮) पर टैप करें → "Install app" या "Add to Home screen" चुनें।'
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 bg-black/40 rounded-lg p-2 border border-card-border/50">
                <Share size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">iPhone / iPad (Safari):</strong>{' '}
                  {t(
                    'Tap the Share button (⬆) at the bottom → scroll down and tap "Add to Home Screen".',
                    'नीचे Share (⬆) पर टैप करें → नीचे स्क्रॉल करके "Add to Home Screen" चुनें।'
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 bg-black/40 rounded-lg p-2 border border-card-border/50">
                <Monitor size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">Computer (Chrome/Edge):</strong>{' '}
                  {t(
                    'Click the Install icon (⊕) in the browser address bar at the top-right.',
                    'ऊपर एड्रेस बार में दाईं ओर Install (⊕) आइकन पर क्लिक करें।'
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
