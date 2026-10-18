'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  Copy,
  Share2,
  Trash2,
  Clock,
  Loader2,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Link2,
  RefreshCw,
  Delete,
  MapPin,
  Radio,
  Timer,
  Navigation,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getItem, setItem, removeItem, StorageKeys } from '@/lib/storage';
import { getLocationLink } from '@/lib/geolocation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StatusBadge from '@/components/StatusBadge';
import FeatureGuide from '@/components/FeatureGuide';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  id: string;
  status: 'safe' | 'need_help' | 'active';
  message: string | null;
  location_link: string | null;
  last_checkin_at: string;
  created_at: string;
  expires_at: string;
  server_time?: string;
}

type CheckInStatus = 'safe' | 'need_help';

interface QueuedAction {
  type: 'checkin';
  status: CheckInStatus;
  message: string;
  location_link: string | null;
  timestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(isoDate: string, serverOffsetMs = 0): string {
  const adjustedNow = Date.now() - serverOffsetMs;
  const diff = adjustedNow - new Date(isoDate).getTime();
  if (diff < 1000) return '0s';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function formatTimeUntil(isoDate: string, serverOffsetMs = 0): string {
  const adjustedNow = Date.now() - serverOffsetMs;
  const diff = new Date(isoDate).getTime() - adjustedNow;
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(50);
  }
}

// ─── PIN Pad Component ───────────────────────────────────────────────────────

function PinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const handleKey = (key: string) => {
    if (disabled) return;
    triggerHaptic();

    if (key === 'del') {
      onChange(value.slice(0, -1));
    } else if (key !== '' && value.length < 4) {
      onChange(value + key);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* PIN display dots */}
      <div className="flex justify-center gap-4 mb-8" aria-label={t('passcodeDisplay', 'पासकोड प्रदर्शन', 'Passcode display')}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < value.length
                ? 'bg-emerald-500 border-emerald-500 scale-110'
                : 'bg-transparent border-neutral-600'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key, idx) => {
          if (key === '') {
            return <div key={idx} aria-hidden="true" />;
          }

          const isDelete = key === 'del';

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleKey(key)}
              disabled={disabled || (!isDelete && value.length >= 4) || (isDelete && value.length === 0)}
              className={`h-16 rounded-2xl text-2xl font-semibold transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isDelete
                  ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-600'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={isDelete ? t('delete', 'मिटाएं', 'Delete') : key}
            >
              {isDelete ? <Delete className="w-6 h-6 mx-auto" /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Session View ──────────────────────────────────────────────────────

function CreateSession({ onCreated }: { onCreated: (data: StatusData) => void }) {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  const [passcode, setPasscode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (passcode.length !== 4) return;

    if (!isOnline) {
      setError(t('offlineError', 'आप ऑफ़लाइन हैं। कृपया इंटरनेट कनेक्शन जांचें।', 'You are offline. Please check your internet connection.'));
      return;
    }

    setIsCreating(true);
    setError(null);
    triggerHaptic();

    try {
      // Fast start: race GPS with 1.2s timeout so session creation is instantaneous!
      let initialLocation: string | null = null;
      let pendingGpsPromise: Promise<string> | null = null;
      try {
        pendingGpsPromise = getLocationLink();
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
        initialLocation = await Promise.race([pendingGpsPromise, timeoutPromise]);
      } catch (locErr) {
        console.warn('Initial GPS capture skipped or pending:', locErr);
      }

      const response = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, location_link: initialLocation }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create status page');
      }

      // Save to localStorage
      setItem(StorageKeys.CHECKIN_UUID, data.id);
      setItem(StorageKeys.CHECKIN_PASSCODE, passcode);

      // Fix 2: If user took longer to tap "Allow" on popup, auto-attach location as soon as it resolves
      if (!initialLocation && pendingGpsPromise) {
        pendingGpsPromise
          .then(async (resolvedLink) => {
            if (resolvedLink) {
              await fetch(`/api/status/${data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  passcode,
                  location_link: resolvedLink,
                  update_checkin: false,
                }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      onCreated(data as StatusData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-600/90 text-white px-4 py-3 flex items-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>{t('offlineBanner', 'आप ऑफ़लाइन हैं', 'You are offline')}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full space-y-6">
        {/* About & How to Use Guide at the Top */}
        <div className="w-full">
          <FeatureGuide
            title={t('guide_checkin_title', 'About & How to Use / जानकारी और उपयोग विधि')}
            aboutText={t(
              'guide_checkin_about',
              'Safety Check-In is an automated "Dead Man\'s Switch" guard designed for high-risk situations (late-night cabs, walking alone, commuting, or protests). You share a live monitoring link with your loved ones. As long as you tap "I\'m Safe" periodically, your family sees that you are fine. If you are ever attacked, phone snatched, or incapacitated and miss the timer, the link automatically sounds an emergency alarm and reveals your last recorded GPS coordinates!'
            )}
            steps={[
              {
                title: t('guide_checkin_step1_title', 'Set 4-Digit PIN / 4-अंकों का पिन सेट करें'),
                desc: t(
                  'guide_checkin_step1_desc',
                  'Enter a simple 4-digit PIN below and tap "Create Check-In" to start your safety session.'
                ),
              },
              {
                title: t('guide_checkin_step2_title', 'Share Link with Family / परिवार को लिंक भेजें'),
                desc: t(
                  'guide_checkin_step2_desc',
                  'Share your live link via WhatsApp. Your family can watch your live status and GPS route on any phone without installing any app.'
                ),
              },
              {
                title: t('guide_checkin_step3_title', 'Tap "I\'m Safe" on Time / समय पर "मैं सुरक्षित हूँ" दबाएं'),
                desc: t(
                  'guide_checkin_step3_desc',
                  'Tap the green "I\'m Safe" button before the countdown ends. If you miss the deadline, your family is alerted immediately with your location!'
                ),
              },
            ]}
            proTip={t(
              'guide_checkin_tip',
              'Lifesaver Tip: Keep "Auto GPS Breadcrumbs" turned ON so your family can see your vehicle travel route updated in the background without you having to open the app.'
            )}
            accentColor="emerald"
            defaultExpanded={false}
          />
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-1.5">
            {t('createCheckin', 'सुरक्षा चेक-इन बनाएं', 'Create Safety Check-In')}
          </h1>
          <p className="text-neutral-400 text-sm max-w-sm mx-auto">
            {t(
              'createCheckinDesc',
              'एक 4-अंकों का पासकोड सेट करें। आप इसे अपने प्रियजनों के साथ साझा कर सकते हैं।',
              'Set a 4-digit passcode. Share the link with your loved ones so they can see you\'re safe.'
            )}
          </p>
        </div>

        {/* PIN Pad */}
        <PinPad value={passcode} onChange={setPasscode} disabled={isCreating} />

        {/* Error */}
        {error && (
          <div
            className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3 max-w-xs w-full"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={passcode.length !== 4 || isCreating || !isOnline}
          className="mt-8 w-full max-w-xs h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold text-lg rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          aria-label={t('createCheckin', 'चेक-इन बनाएं', 'Create Check-In')}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('creating', 'बना रहे हैं...', 'Creating...')}
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              {t('createCheckinBtn', 'चेक-इन बनाएं', 'Create Check-In')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Active Session View ──────────────────────────────────────────────────────

function ActiveSession({
  initialData,
  uuid,
  passcode,
  onSessionEnded,
}: {
  initialData: StatusData;
  uuid: string;
  passcode: string;
  onSessionEnded: () => void;
}) {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  const [statusData, setStatusData] = useState<StatusData>(initialData);
  const [message, setMessage] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeSinceCheckin, setTimeSinceCheckin] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Dead Man's Switch: Safety Interval (in minutes)
  const [intervalMinutes, setIntervalMinutes] = useState<number>(() => {
    const saved = getItem<number>(StorageKeys.CHECKIN_INTERVAL);
    return saved && [10, 15, 30, 60].includes(saved) ? saved : 10;
  });

  // Countdown to next check-in
  const [countdownState, setCountdownState] = useState<{
    text: string;
    isOverdue: boolean;
    isUrgent: boolean;
  }>({
    text: '',
    isOverdue: false,
    isUrgent: false,
  });

  // Live Journey Mode: Background GPS Breadcrumbs
  const [isJourneyTracking, setIsJourneyTracking] = useState(true);
  const [lastGpsPingTime, setLastGpsPingTime] = useState<string | null>(null);
  const [isPingingGps, setIsPingingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hasAttemptedFirstGps, setHasAttemptedFirstGps] = useState(Boolean(initialData.location_link));
  const hasOverduePingedRef = useRef(false);

  // Server-time offset synchronization to eliminate device clock skew
  const serverOffsetRef = useRef<number>(
    initialData.server_time
      ? Date.now() - new Date(initialData.server_time).getTime()
      : 0
  );

  const syncServerOffset = useCallback((serverTimeStr?: string) => {
    if (serverTimeStr) {
      const serverMs = new Date(serverTimeStr).getTime();
      if (!isNaN(serverMs)) {
        serverOffsetRef.current = Date.now() - serverMs;
      }
    }
  }, []);

  const queuedActionRef = useRef<QueuedAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleIntervalChange = (mins: number) => {
    setIntervalMinutes(mins);
    setItem(StorageKeys.CHECKIN_INTERVAL, mins);
    triggerHaptic();
  };

  const pingLocation = useCallback(async () => {
    if (!isJourneyTracking || !isOnline) return;
    try {
      setIsPingingGps(true);
      setGpsError(null);
      const link = await getLocationLink();
      if (link) {
        const res = await fetch(`/api/status/${uuid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passcode,
            location_link: link,
            update_checkin: false, // Does NOT reset Dead Man's Switch timer
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.server_time) {
            syncServerOffset(data.server_time);
          }
          setStatusData((prev) => ({ ...prev, location_link: link }));
          setLastGpsPingTime(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Location access unavailable';
      console.warn('GPS ping failed:', msg);
      setGpsError(msg);
    } finally {
      setIsPingingGps(false);
      setHasAttemptedFirstGps(true);
    }
  }, [isJourneyTracking, isOnline, uuid, passcode, syncServerOffset]);

  // Live time and countdown updater
  useEffect(() => {
    const update = () => {
      if (statusData.last_checkin_at) {
        setTimeSinceCheckin(formatTimeSince(statusData.last_checkin_at, serverOffsetRef.current));

        // Dead Man's Switch countdown synchronized with server time
        const adjustedNow = Date.now() - serverOffsetRef.current;
        const checkinDueAt =
          new Date(statusData.last_checkin_at).getTime() + intervalMinutes * 60 * 1000;
        const diff = checkinDueAt - adjustedNow;

        if (diff <= 0) {
          const overdueSec = Math.floor(Math.abs(diff) / 1000);
          const overdueMin = Math.floor(overdueSec / 60);
          setCountdownState({
            text:
              overdueMin > 0
                ? `${overdueMin}m ${overdueSec % 60}s overdue`
                : `${overdueSec}s overdue`,
            isOverdue: true,
            isUrgent: true,
          });

          // Automatically broadcast emergency GPS location when timer expires
          if (!hasOverduePingedRef.current) {
            hasOverduePingedRef.current = true;
            pingLocation();
          }
        } else {
          hasOverduePingedRef.current = false;
          const sec = Math.floor(diff / 1000);
          const min = Math.floor(sec / 60);
          const remSec = sec % 60;
          const isUrgent = diff <= Math.min(3 * 60 * 1000, intervalMinutes * 60 * 1000 * 0.35);
          setCountdownState({
            text: `${min}m ${remSec < 10 ? '0' : ''}${remSec}s`,
            isOverdue: false,
            isUrgent,
          });
        }
      }
      if (statusData.expires_at) {
        setExpiresIn(formatTimeUntil(statusData.expires_at, serverOffsetRef.current));
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [statusData.last_checkin_at, statusData.expires_at, intervalMinutes, pingLocation]);

  // Live Journey Mode: Auto GPS Breadcrumb Heartbeat (every 15s for 1m test, 45s normally)
  useEffect(() => {
    if (!isJourneyTracking || !isOnline) return;

    // Ping immediately
    pingLocation();

    const pingIntervalMs = intervalMinutes === 1 ? 15000 : 45000;
    const beaconInterval = setInterval(pingLocation, pingIntervalMs);

    return () => clearInterval(beaconInterval);
  }, [isJourneyTracking, isOnline, intervalMinutes, pingLocation]);

  // Auto-refresh status data from server
  useEffect(() => {
    if (!isOnline) return;

    const refreshInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${uuid}`);
        if (res.ok) {
          const data = await res.json();
          setStatusData(data);
        }
      } catch {
        // Silent fail on auto-refresh
      }
    }, 15000);

    return () => clearInterval(refreshInterval);
  }, [uuid, isOnline]);

  // Process queued action when coming back online
  useEffect(() => {
    if (isOnline && queuedActionRef.current) {
      const queued = queuedActionRef.current;
      queuedActionRef.current = null;
      handleCheckIn(queued.status, queued.message, queued.location_link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleCheckIn = useCallback(
    async (status: CheckInStatus, msg?: string, locationLink?: string | null) => {
      setIsCheckingIn(true);
      setActionError(null);
      triggerHaptic();

      // Optimistic instant feedback when tapping "I'm Safe"
      if (status === 'safe') {
        const nowIso = new Date(Date.now() - serverOffsetRef.current).toISOString();
        setStatusData((prev) => ({
          ...prev,
          status: 'safe',
          last_checkin_at: nowIso,
        }));
        setTimeSinceCheckin('0s');
        setCountdownState({
          text: `${intervalMinutes}m 00s`,
          isOverdue: false,
          isUrgent: false,
        });
      }

      // Automatically attach fresh GPS location on check-in
      let freshLoc: string | null = locationLink ?? null;
      if (!freshLoc) {
        try {
          freshLoc = await getLocationLink();
        } catch {
          // Continue if location unavailable
        }
      }

      // If offline, queue the action
      if (!isOnline) {
        queuedActionRef.current = {
          type: 'checkin',
          status,
          message: msg || message,
          location_link: freshLoc,
          timestamp: Date.now(),
        };
        setIsCheckingIn(false);
        setLastAction(
          t('queuedOffline', 'ऑफ़लाइन कतार में जोड़ा गया — ऑनलाइन होने पर भेजा जाएगा', 'Queued offline — will send when online')
        );
        return;
      }

      try {
        const body: Record<string, unknown> = {
          passcode,
          status,
          update_checkin: true,
        };

        const finalMessage = msg !== undefined ? msg : message;
        if (finalMessage) {
          body.message = finalMessage;
        }

        if (freshLoc) {
          body.location_link = freshLoc;
        }

        const res = await fetch(`/api/status/${uuid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Check-in failed');
        }

        if (data.server_time) {
          syncServerOffset(data.server_time);
        }

        setStatusData(data);
        setMessage('');
        setLastAction(
          status === 'safe'
            ? t('markedSafe', '✅ सुरक्षित चिह्नित किया गया — लाइव GPS अपडेट हुआ', '✅ Marked as Safe — Live GPS updated')
            : t('markedNeedHelp', '🚨 मदद अनुरोध भेजा गया', '🚨 Help request sent')
        );

        setTimeout(() => setLastAction(null), 3000);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Check-in failed';
        setActionError(errMsg);
      } finally {
        setIsCheckingIn(false);
      }
    },
    [isOnline, message, passcode, uuid, t]
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/status/${uuid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      removeItem(StorageKeys.CHECKIN_UUID);
      removeItem(StorageKeys.CHECKIN_PASSCODE);
      triggerHaptic();
      onSessionEnded();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Delete failed';
      setActionError(errMsg);
      setIsDeleting(false);
    }
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/check-in/${uuid}?interval=${intervalMinutes}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      triggerHaptic();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const text = t(
      'whatsappMsgWithInterval',
      `मेरी सुरक्षा स्थिति लाइव ट्रैक करें: ${shareUrl}\n(सफ़र सुरक्षा: अगर मैं हर ${intervalMinutes} मिनट में चेक-इन नहीं करती हूँ, तो इस लिंक पर इमरजेंसी अलार्म और मेरा आखिरी GPS स्थान सक्रिय हो जाएगा)`,
      `Track my safety status live: ${shareUrl}\n(Safety Timer: If I don't check in every ${intervalMinutes} minutes, an emergency alert will trigger with my last recorded GPS coordinates)`
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const currentStatus = statusData.status as 'safe' | 'need_help' | 'active';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-600/90 text-white px-4 py-3 flex items-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>{t('offlineBanner', 'आप ऑफ़लाइन हैं — चेक-इन ऑनलाइन होने पर भेजा जाएगा', 'You are offline — check-in will send when online')}</span>
        </div>
      )}

      {/* Queued offline indicator */}
      {queuedActionRef.current && (
        <div className="bg-blue-600/90 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{t('pendingSync', 'चेक-इन सिंक होने की प्रतीक्षा में', 'Check-in pending sync')}</span>
        </div>
      )}

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        {/* Feature Guide (collapsed by default during active session to keep controls prominent) */}
        <FeatureGuide
          title={t('guide_checkin_title', 'About & How to Use / जानकारी और उपयोग विधि')}
          aboutText={t(
            'guide_checkin_active_about',
            'Your safety session is currently ACTIVE. As long as you tap "I\'m Safe" before the countdown expires, your family knows you are fine. If you miss a check-in (e.g. phone taken, injured, or unreachable), an emergency alert is triggered automatically on your contacts\' status page with your last GPS breadcrumb.'
          )}
          steps={[
            {
              title: t('guide_checkin_step1_title', 'Keep Timer in Mind / टाइमर पर ध्यान दें'),
              desc: t(
                'guide_checkin_active_step1_desc',
                'Watch the countdown timer. Whenever prompted, tap the large green "I\'m Safe" button to reset the timer.'
              ),
            },
            {
              title: t('guide_checkin_step2_title', 'Tap "Need Help" for Emergency / आपातकाल में सहायता मांगें'),
              desc: t(
                'guide_checkin_active_step2_desc',
                'If you face an immediate crisis, tap "Need Help" to immediately broadcast a red alert with your exact coordinates.'
              ),
            },
            {
              title: t('guide_checkin_step3_title', 'End Session When Safe / सुरक्षित पहुँचने पर समाप्त करें'),
              desc: t(
                'guide_checkin_active_step3_desc',
                'When you arrive safely at your destination, scroll down and tap "End Session" with your PIN to close the page.'
              ),
            },
          ]}
          proTip={t(
            'guide_checkin_tip',
            'Lifesaver Tip: Keep "Auto GPS Breadcrumbs" turned ON so your family can see your vehicle travel route updated in the background without you having to open the app.'
          )}
          accentColor="emerald"
          defaultExpanded={false}
        />

        {/* Prominent GPS Banner if location is genuinely missing after initial attempt */}
        {!statusData.location_link && !isPingingGps && hasAttemptedFirstGps && (
          <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 p-3.5 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Navigation className={`w-4 h-4 ${isPingingGps ? 'animate-spin' : ''}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  {t('locationNotLinked', 'GPS लोकेशन अभी नहीं जुड़ी है', 'GPS Location Not Linked Yet')}
                </p>
                <p className="text-[11px] text-sky-300/70 truncate">
                  {t('shareWithFamilyPrompt', 'परिवार को मैप दिखाने के लिए जोड़ें', 'Add your GPS to the family map')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => pingLocation()}
              disabled={isPingingGps}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              aria-label={t('shareNow', 'अभी जोड़ें', 'Share GPS')}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {isPingingGps
                  ? t('gettingGps', 'खोज रहे हैं...', 'Locating...')
                  : t('shareNow', 'अभी जोड़ें', 'Share GPS')}
              </span>
            </button>
          </div>
        )}

        {/* Dead Man's Switch Urgency / Overdue Banner */}
        {countdownState.isOverdue && (
          <div className="mb-6 bg-red-600/20 border-2 border-red-500 rounded-2xl p-4 text-center animate-pulse">
            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-base mb-1">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>{t('overdueTitle', '⚠️ चेक-इन समय समाप्त! इमरजेंसी अलार्म चालू है', '⚠️ Check-in Overdue! Emergency Alert Active')}</span>
            </div>
            <p className="text-sm text-neutral-300">
              {t(
                'overdueDesc',
                'आपके संपर्कों को अब लाल इमरजेंसी अलार्म और आपका अंतिम GPS स्थान दिख रहा है। अलार्म बंद करने के लिए नीचे "मैं सुरक्षित हूँ" दबाएं।',
                'Your contacts now see a red danger alert with your last GPS location. Tap "I\'m Safe" below to disarm.'
              )}
            </p>
          </div>
        )}

        {countdownState.isUrgent && !countdownState.isOverdue && (
          <div className="mb-6 bg-amber-500/20 border border-amber-500/50 rounded-2xl p-3.5 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-semibold text-sm">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>
                {t('urgentPrompt', 'समय समाप्त होने वाला है! "मैं सुरक्षित हूँ" दबाएं:', 'Time running out! Tap "I\'m Safe" within:')}{' '}
                <span className="font-mono font-bold text-white">{countdownState.text}</span>
              </span>
            </div>
          </div>
        )}

        {/* Status display */}
        <div className="text-center mb-6">
          <StatusBadge status={currentStatus} size="lg" pulse={currentStatus === 'need_help' || countdownState.isOverdue} />
          
        {/* Dead Man's Switch Countdown */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 text-sm shadow-sm">
            <Timer className={`w-4 h-4 ${countdownState.isOverdue ? 'text-red-400 animate-spin' : countdownState.isUrgent ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-neutral-300">
              {countdownState.isOverdue
                ? t('overdueDue', '⚠️ समय समाप्त! तुरंत दबाएं:', '⚠️ Overdue! Tap now:')
                : t('timeLeftToTapSafe', '⏳ "मैं सुरक्षित हूँ" दबाने में बचा समय:', '⏳ Time left to tap "I\'m Safe":')}
            </span>
            <span className={`font-mono font-bold text-base ${countdownState.isOverdue ? 'text-red-400 animate-pulse' : countdownState.isUrgent ? 'text-amber-300' : 'text-emerald-400'}`}>
              {countdownState.text}
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-2 text-neutral-400">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs">
              {t('lastConfirmedSafe', 'पिछली बार सुरक्षित बताया', 'Last confirmed safe')}:{' '}
              <span className="text-white font-mono font-semibold">{timeSinceCheckin}</span>{' '}
              {t('ago', 'पहले', 'ago')}
            </span>
          </div>
        </div>

        {/* Safety Timer Selector (Dead Man's Switch Interval) */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-emerald-400" />
              {t('safetyTimer', 'सुरक्षा टाइमर (अलार्म अंतराल)', 'Safety Check-In Timer')}
            </span>
            <span className="text-xs text-neutral-500 font-mono">{intervalMinutes}m</span>
          </div>
          <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
            {t(
              'timerExplainer',
              'यदि आप इस समय सीमा के भीतर चेक-इन नहीं करती हैं, तो यह सिस्टम स्वतः ही आपके संपर्कों को लाल खतरे का अलार्म और अंतिम GPS स्थान दिखा देगा।',
              'If you fail to check in within this time, the system automatically triggers a red emergency alarm with your last GPS location.'
            )}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { val: 10, label: t('timer10', '10 मिनट\n(हाई रिस्क)', '10 mins\n(High Risk)') },
              { val: 15, label: t('timer15', '15 मिनट\n(कैब)', '15 mins\n(Cab)') },
              { val: 30, label: t('timer30', '30 मिनट\n(सफ़र)', '30 mins\n(Commute)') },
              { val: 60, label: t('timer60', '60 मिनट\n(सामान्य)', '60 mins\n(Standard)') },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => handleIntervalChange(val)}
                className={`py-2 px-1 text-xs rounded-xl font-medium transition-all whitespace-pre-line text-center border ${
                  intervalMinutes === val
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Journey Tracking (Auto GPS Breadcrumbs) */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isJourneyTracking ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {t('liveGpsBeacon', 'ऑटो GPS ट्रैकिंग (सफ़र मोड)', 'Auto GPS Breadcrumbs')}
                </h2>
                <p className="text-xs text-neutral-400">
                  {isJourneyTracking
                    ? isPingingGps
                      ? t('gpsPinging', '🔄 GPS सिंक हो रहा है...', '🔄 Syncing GPS location...')
                      : lastGpsPingTime
                      ? `${t('lastGpsPing', 'अंतिम GPS:', 'Last GPS:')} ${lastGpsPingTime}`
                      : t('gpsActive', '🟢 ऑटो-अपडेट सक्रिय', '🟢 Auto-sync active')
                    : t('gpsOff', 'बंद है', 'Disabled')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsJourneyTracking((prev) => !prev);
                triggerHaptic();
              }}
              className={`w-12 h-7 rounded-full transition-colors relative focus:outline-none ${
                isJourneyTracking ? 'bg-emerald-600' : 'bg-neutral-700'
              }`}
              aria-label={t('toggleGps', 'GPS ट्रैकिंग टॉगल करें', 'Toggle GPS Tracking')}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  isJourneyTracking ? 'translate-x-6' : 'translate-x-1'
                } top-1 absolute`}
              />
            </button>
          </div>

          {/* Quick manual ping button & status */}
          <div className="flex items-center justify-between pt-2.5 border-t border-neutral-800/80 text-xs">
            {statusData.location_link ? (
              <a
                href={statusData.location_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{t('gpsLinked', 'GPS जुड़ा हुआ है (Maps देखें)', 'GPS linked (View Map)')}</span>
              </a>
            ) : (
              <span className="text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{t('noGpsYet', 'GPS पिंग प्रतीक्षारत', 'GPS pending')}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => pingLocation()}
              disabled={isPingingGps}
              className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPingingGps ? 'animate-spin' : ''}`} />
              <span>{t('pingNow', 'GPS अभी भेजें', 'Ping GPS Now')}</span>
            </button>
          </div>

          {/* Error if GPS permission blocked */}
          {gpsError && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{gpsError}</p>
                <p className="text-neutral-400 text-[11px] mt-0.5">
                  {t('allowLocationHint', 'ब्राउज़र एड्रेस बार में 🔒 आइकन पर क्लिक करके लोकेशन की अनुमति दें।', 'Click the 🔒 icon in your browser URL bar to allow location access.')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Success/Error notifications */}
        {lastAction && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center text-emerald-400 text-sm font-medium animate-in fade-in">
            {lastAction}
          </div>
        )}

        {actionError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{actionError}</p>
          </div>
        )}

        {/* Check-in buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleCheckIn('safe')}
            disabled={isCheckingIn}
            className="w-full h-20 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xl rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] shadow-lg shadow-emerald-950/40"
            aria-label={t('imSafe', 'मैं सुरक्षित हूँ', 'I\'m Safe')}
          >
            {isCheckingIn ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-7 h-7" />
                {t('imSafe', '✅ मैं सुरक्षित हूँ', '✅ I\'m Safe')}
              </>
            )}
          </button>

          <button
            onClick={() => handleCheckIn('need_help')}
            disabled={isCheckingIn}
            className="w-full h-20 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-bold text-xl rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] shadow-lg shadow-red-950/40"
            aria-label={t('needHelp', 'मदद चाहिए', 'Need Help')}
          >
            {isCheckingIn ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <>
                <ShieldAlert className="w-7 h-7" />
                {t('needHelp', '🚨 मदद चाहिए', '🚨 Need Help')}
              </>
            )}
          </button>
        </div>

        {/* Message input */}
        <div className="mb-6">
          <label htmlFor="checkin-message" className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
            <MessageSquare className="w-4 h-4" />
            {t('optionalMessage', 'वैकल्पिक संदेश', 'Optional message')}
          </label>
          <input
            id="checkin-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            placeholder={t('messagePlaceholder', 'जैसे: कैब में बैठी हूँ, घर जा रही हूँ', 'e.g., In cab DL-1Y-1234, heading home')}
            className="w-full h-12 bg-neutral-900 border border-neutral-800 rounded-xl px-4 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <p className="text-xs text-neutral-600 mt-1 text-right">{message.length}/200</p>
        </div>

        {/* Share section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between text-sm text-neutral-400 mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span>{t('shareLink', 'लाइव मॉनिटर लिंक', 'Live Monitor Link')}</span>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {intervalMinutes}m timer
            </span>
          </div>

          <div className="bg-neutral-800 rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 overflow-hidden">
            <code className="text-sm text-emerald-400 truncate flex-1">{shareUrl}</code>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 h-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={t('copyLink', 'लिंक कॉपी करें', 'Copy link')}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {t('copied', 'कॉपी हो गया!', 'Copied!')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {t('copy', 'कॉपी करें', 'Copy')}
                </>
              )}
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex-1 h-12 bg-green-700 hover:bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              aria-label={t('shareWhatsApp', 'WhatsApp पर भेजें', 'Share on WhatsApp')}
            >
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* Delete session */}
        <div className="border-t border-neutral-800 pt-6">
          {showDeleteConfirm ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
              <p className="text-red-400 text-sm mb-4 text-center">
                {t(
                  'deleteConfirmMsg',
                  'क्या आप वाकई इस सत्र को समाप्त करना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।',
                  'Are you sure you want to end this session? This cannot be undone.'
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 h-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                >
                  {t('cancel', 'रद्द करें', 'Cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 h-12 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {isDeleting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('confirmDelete', 'हाँ, समाप्त करें', 'Yes, End Session')}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full h-12 bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label={t('endSession', 'सत्र समाप्त करें', 'End Session')}
            >
              <Trash2 className="w-4 h-4" />
              {t('endSession', 'सत्र समाप्त करें', 'End Session')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CheckInPage() {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  const [sessionState, setSessionState] = useState<'loading' | 'no_session' | 'active'>('loading');
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [storedUuid, setStoredUuid] = useState<string | null>(null);
  const [storedPasscode, setStoredPasscode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const uuid = getItem<string>(StorageKeys.CHECKIN_UUID);
      const passcode = getItem<string>(StorageKeys.CHECKIN_PASSCODE);

      if (!uuid || !passcode) {
        setSessionState('no_session');
        return;
      }

      setStoredUuid(uuid);
      setStoredPasscode(passcode);

      try {
        const res = await fetch(`/api/status/${uuid}`);

        if (res.ok) {
          const data = await res.json();
          setStatusData(data);
          setSessionState('active');
        } else if (res.status === 404) {
          // Session expired or deleted
          removeItem(StorageKeys.CHECKIN_UUID);
          removeItem(StorageKeys.CHECKIN_PASSCODE);
          setSessionState('no_session');
        } else {
          throw new Error('Failed to fetch session');
        }
      } catch {
        if (!isOnline) {
          // If offline but have stored data, show session with limited functionality
          setStatusData({
            id: uuid,
            status: 'active',
            message: null,
            location_link: null,
            last_checkin_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
          setSessionState('active');
        } else {
          setLoadError(
            t('loadError', 'सत्र लोड करने में विफल। कृपया पुनः प्रयास करें।', 'Failed to load session. Please try again.')
          );
          setSessionState('no_session');
        }
      }
    };

    checkExistingSession();
  }, [isOnline, t]);

  // Loading state
  if (sessionState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">
            {t('loading', 'लोड हो रहा है...', 'Loading...')}
          </p>
        </div>
      </div>
    );
  }

  // Error display
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="h-12 px-6 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors"
          >
            {t('retry', 'पुनः प्रयास करें', 'Try Again')}
          </button>
        </div>
      </div>
    );
  }

  // No session → show create form
  if (sessionState === 'no_session') {
    return (
      <CreateSession
        onCreated={(data) => {
          setStatusData(data);
          setStoredUuid(data.id);
          const passcode = getItem<string>(StorageKeys.CHECKIN_PASSCODE);
          setStoredPasscode(passcode);
          setSessionState('active');
        }}
      />
    );
  }

  // Active session → show control panel
  if (sessionState === 'active' && statusData && storedUuid && storedPasscode) {
    return (
      <ActiveSession
        initialData={statusData}
        uuid={storedUuid}
        passcode={storedPasscode}
        onSessionEnded={() => {
          setStatusData(null);
          setStoredUuid(null);
          setStoredPasscode(null);
          setSessionState('no_session');
        }}
      />
    );
  }

  return null;
}
