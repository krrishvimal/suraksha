'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const { t } = useLanguage();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return; // Already installed, don't show anything

    // Check if dismissed this session
    try {
      if (sessionStorage.getItem('suraksha_install_dismissed') === '1') {
        setDismissed(true);
        return;
      }
    } catch { /* ignore */ }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // On iOS (not standalone), show iOS-specific instructions
    if (isiOS) {
      setShowBanner(true);
      return;
    }

    // On Chromium browsers, listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setShowBanner(false);
      }
    } catch {
      // User cancelled or error — hide banner
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setDismissed(true);
    try {
      sessionStorage.setItem('suraksha_install_dismissed', '1');
    } catch { /* ignore */ }
  }, []);

  // Don't render anything if already installed, dismissed, or no banner to show
  if (isStandalone || dismissed || !showBanner) return null;

  return (
    <div className="mx-auto max-w-md px-4 mb-4">
      <div className="relative flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full text-muted hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>

        <div className="flex-shrink-0 rounded-lg bg-emerald-500/10 p-2">
          <Download size={20} className="text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t('Install Suraksha', 'सुरक्षा इंस्टॉल करें')}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {isIOS
              ? t(
                  'Tap Share ⬆ then "Add to Home Screen"',
                  'Share ⬆ पर टैप करें, फिर "Add to Home Screen"',
                )
              : t(
                  'Add to your home screen for quick access',
                  'त्वरित एक्सेस के लिए होम स्क्रीन पर जोड़ें',
                )}
          </p>
        </div>

        {!isIOS && deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="flex-shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-emerald-400 active:bg-emerald-600"
          >
            {t('Install', 'इंस्टॉल')}
          </button>
        )}
      </div>
    </div>
  );
}
