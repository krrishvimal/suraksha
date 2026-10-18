'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Suraksha SW registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('Suraksha SW registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
