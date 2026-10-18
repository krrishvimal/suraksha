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
      </div>
    </footer>
  );
}
