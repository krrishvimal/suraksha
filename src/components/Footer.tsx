'use client';

import { useLanguage } from '@/lib/i18n';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer
      className="w-full border-t border-card-border py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      role="contentinfo"
    >
      <div className="mx-auto max-w-md space-y-2 px-4 text-center text-sm text-muted">
        <p className="text-base" aria-label={t('Suraksha', 'सुरक्षा')}>
          🛡️ {t('Suraksha', 'सुरक्षा')}
        </p>
        <p>
          {t(
            'No data collected. No tracking. 100% private.',
            'कोई डेटा एकत्र नहीं। कोई ट्रैकिंग नहीं। 100% निजी।',
          )}
        </p>
        <p className="text-xs text-muted/70">
          {t('Built with ❤️ for safety', 'सुरक्षा के लिए ❤️ से बनाया गया')}
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.removeItem('suraksha_splash_viewed'); } catch {}
              window.dispatchEvent(new Event('replay_splash'));
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-card-border bg-card-bg/60 text-[11px] text-muted hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
          >
            <span>✨</span>
            <span>{t('Replay Intro Animation', 'इंट्रो एनिमेशन दोबारा देखें')}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
