'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, Radio } from 'lucide-react';

export default function AppSplash() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [step, setStep] = useState<number>(0);

  const dismiss = useCallback(() => {
    setIsFadingOut(true);
    try {
      sessionStorage.setItem('suraksha_splash_viewed', 'true');
    } catch {
      // sessionStorage unavailable
    }
    setTimeout(() => {
      setIsVisible(false);
    }, 450);
  }, []);

  useEffect(() => {
    const startAnimation = () => {
      setIsFadingOut(false);
      setStep(0);
      setIsVisible(true);

      const t1 = setTimeout(() => {
        setStep(1);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(25); } catch {}
        }
      }, 350);

      const t2 = setTimeout(() => {
        setStep(2);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([20, 40, 20]); } catch {}
        }
      }, 850);

      const t3 = setTimeout(() => {
        setStep(3);
      }, 1400);

      const t4 = setTimeout(() => {
        dismiss();
      }, 2300);

      return [t1, t2, t3, t4];
    };

    let timers: NodeJS.Timeout[] = [];

    const handleReplay = () => {
      timers.forEach(clearTimeout);
      timers = startAnimation();
    };

    window.addEventListener('replay_splash', handleReplay);

    try {
      const alreadyViewed = sessionStorage.getItem('suraksha_splash_viewed');
      if (!alreadyViewed) {
        timers = startAnimation();
      }
    } catch {
      timers = startAnimation();
    }

    return () => {
      window.removeEventListener('replay_splash', handleReplay);
      timers.forEach(clearTimeout);
    };
  }, [dismiss]);

  if (!isVisible) return null;

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Suraksha Opening Animation"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070707] text-white select-none transition-all duration-400 cursor-pointer overflow-hidden ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Animated Radar Concentric Circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Radar Ring 1 */}
        <div className="absolute h-48 w-48 rounded-full border border-emerald-500/20 animate-ping opacity-40 duration-1000" />
        {/* Radar Ring 2 */}
        <div className="absolute h-80 w-80 rounded-full border border-emerald-500/10 animate-pulse duration-700" />
        {/* Deep ambient green glow */}
        <div className="absolute h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-sm">
        {/* Shield Icon with Rotating Beacon */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Beacon Halo */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-emerald-500/30 to-teal-400/10 blur-xl animate-spin duration-1000" />

          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-md shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <Shield className="h-14 w-14 text-emerald-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-in zoom-in-50 duration-500" />
            <div className="absolute inset-x-0 -bottom-1 flex justify-center">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          </div>
        </div>

        {/* English Brand: SURAKSHA */}
        <div
          className={`transition-all duration-500 transform ${
            step >= 1
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <h1 className="text-4xl sm:text-5xl font-black tracking-[0.22em] uppercase font-sans bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(52,211,153,0.5)]">
            SURAKSHA
          </h1>
        </div>

        {/* Laser Separator Line */}
        <div
          className={`my-2 flex items-center justify-center w-full transition-all duration-500 ${
            step >= 2 ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
          }`}
        >
          <div className="h-[2px] w-12 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
          <div className="mx-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <div className="h-[2px] w-12 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>

        {/* Hindi Brand: सुरक्षा */}
        <div
          className={`transition-all duration-500 transform ${
            step >= 2
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-3 scale-95'
          }`}
        >
          <p
            className="text-3xl sm:text-4xl font-extrabold text-emerald-300 tracking-wider drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]"
            style={{
              fontFamily:
                "'Rozha One', 'Yatra One', 'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Nirmala UI', sans-serif",
            }}
          >
            सुरक्षा
          </p>
        </div>

        {/* Tagline & Privacy Indicators */}
        <div
          className={`mt-6 transition-all duration-500 transform ${
            step >= 3
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/80 mb-3">
            Personal Safety • व्यक्तिगत सुरक्षा
          </p>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-[11px] font-medium text-emerald-300/90 shadow-inner">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>100% Private • No Tracking • Works Offline</span>
          </div>
        </div>
      </div>

      {/* Emergency Tap To Dismiss Prompt */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[11px] text-white/40 tracking-wide font-mono animate-pulse">
          Tap anywhere to continue / जारी रखने के लिए कहीं भी टैप करें
        </p>
      </div>
    </div>
  );
}
