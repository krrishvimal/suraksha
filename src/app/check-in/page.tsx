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
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getItem, setItem, removeItem, StorageKeys } from '@/lib/storage';
import { getLocationLink } from '@/lib/geolocation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StatusBadge from '@/components/StatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  id: string;
  status: 'safe' | 'need_help' | 'active';
  message: string | null;
  location_link: string | null;
  last_checkin_at: string;
  created_at: string;
  expires_at: string;
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

function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 0) return '0s';

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

function formatTimeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
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
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create status page');
      }

      // Save to localStorage
      setItem(StorageKeys.CHECKIN_UUID, data.id);
      setItem(StorageKeys.CHECKIN_PASSCODE, passcode);

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

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {t('createCheckin', 'सुरक्षा चेक-इन बनाएं', 'Create Safety Check-In')}
          </h1>
          <p className="text-neutral-400 text-base max-w-sm">
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
  const queuedActionRef = useRef<QueuedAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live time updater
  useEffect(() => {
    const update = () => {
      if (statusData.last_checkin_at) {
        setTimeSinceCheckin(formatTimeSince(statusData.last_checkin_at));
      }
      if (statusData.expires_at) {
        setExpiresIn(formatTimeUntil(statusData.expires_at));
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [statusData.last_checkin_at, statusData.expires_at]);

  // Auto-refresh status data
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

      // If offline, queue the action
      if (!isOnline) {
        queuedActionRef.current = {
          type: 'checkin',
          status,
          message: msg || message,
          location_link: locationLink ?? null,
          timestamp: Date.now(),
        };
        setIsCheckingIn(false);
        setLastAction(
          t('queuedOffline', 'ऑफ़लाइन कतार में जोड़ा गया — ऑनलाइन होने पर भेजा जाएगा', 'Queued offline — will send when online')
        );
        return;
      }

      try {
        const body: Record<string, string | null> = {
          passcode,
          status,
        };

        const finalMessage = msg !== undefined ? msg : message;
        if (finalMessage) {
          body.message = finalMessage;
        }

        if (status === 'need_help') {
          // Try to get location for need_help
          try {
            const loc = locationLink ?? (await getLocationLink());
            if (loc) {
              body.location_link = loc;
            }
          } catch {
            // Location unavailable, continue without it
          }
        }

        if (locationLink !== undefined) {
          body.location_link = locationLink;
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

        setStatusData(data);
        setMessage('');
        setLastAction(
          status === 'safe'
            ? t('markedSafe', '✅ सुरक्षित चिह्नित किया गया', '✅ Marked as Safe')
            : t('markedNeedHelp', '🚨 मदद अनुरोध भेजा गया', '🚨 Help request sent')
        );

        // Clear last action message after 3 seconds
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

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/check-in/${uuid}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      triggerHaptic();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
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
      'whatsappMsg',
      `मेरी सुरक्षा स्थिति यहाँ देखें: ${shareUrl}`,
      `Check my safety status here: ${shareUrl}`
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

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {/* Status display */}
        <div className="text-center mb-6">
          <StatusBadge status={currentStatus} size="lg" pulse={currentStatus === 'need_help'} />
          <div className="mt-4 flex items-center justify-center gap-2 text-neutral-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {t('lastCheckin', 'पिछला चेक-इन', 'Last check-in')}: <span className="text-white font-mono">{timeSinceCheckin}</span> {t('ago', 'पहले', 'ago')}
            </span>
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            {t('expiresIn', 'समाप्त होगा', 'Expires in')}: <span className="font-mono">{expiresIn}</span>
          </div>
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
            className="w-full h-20 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xl rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
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
            className="w-full h-20 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-bold text-xl rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
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
            placeholder={t('messagePlaceholder', 'जैसे: घर पहुँच गई', 'e.g., Reached home safely')}
            className="w-full h-12 bg-neutral-900 border border-neutral-800 rounded-xl px-4 text-base text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <p className="text-xs text-neutral-600 mt-1 text-right">{message.length}/200</p>
        </div>

        {/* Share section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
            <Link2 className="w-4 h-4" />
            {t('shareLink', 'लिंक साझा करें', 'Share your link')}
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
