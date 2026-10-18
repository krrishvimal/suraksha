'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Shield,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  MapPin,
  MessageCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  PhoneCall,
  Navigation,
  Timer,
  AlertOctagon,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import StatusBadge from '@/components/StatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusPageData {
  id: string;
  status: 'safe' | 'need_help' | 'active';
  message: string | null;
  location_link: string | null;
  last_checkin_at: string;
  created_at: string;
  expires_at: string;
  server_time?: string;
}

type DisplayStatus = 'safe' | 'need_help' | 'stale' | 'unknown';
type PageState = 'loading' | 'loaded' | 'not_found' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(isoDate: string, serverOffsetMs = 0): string {
  const adjustedNow = Date.now() - serverOffsetMs;
  const diff = adjustedNow - new Date(isoDate).getTime();
  if (diff < 1000) return '0s';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
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

function getTimeSinceMs(isoDate: string, serverOffsetMs = 0): number {
  const adjustedNow = Date.now() - serverOffsetMs;
  return Math.max(0, adjustedNow - new Date(isoDate).getTime());
}

function computeDisplayStatus(
  data: StatusPageData,
  intervalMinutes: number = 30,
  serverOffsetMs = 0
): DisplayStatus {
  // If explicitly need_help, always trigger red emergency
  if (data.status === 'need_help') return 'need_help';

  const timeSinceMs = getTimeSinceMs(data.last_checkin_at, serverOffsetMs);
  const dangerMs = intervalMinutes * 60 * 1000;
  const warningMs = dangerMs * 0.7; // Warning in final 30% of interval

  // Dead Man's Switch: if check-in deadline missed, turn RED immediately
  if (timeSinceMs > dangerMs) return 'need_help';
  if (timeSinceMs > warningMs) return 'stale';

  return 'safe';
}

function getStatusIcon(status: DisplayStatus): React.ReactNode {
  switch (status) {
    case 'safe':
      return <Shield className="w-16 h-16 text-emerald-500" />;
    case 'need_help':
      return <ShieldAlert className="w-16 h-16 text-red-500" />;
    case 'stale':
      return <ShieldQuestion className="w-16 h-16 text-yellow-500" />;
    case 'unknown':
    default:
      return <ShieldQuestion className="w-16 h-16 text-neutral-500" />;
  }
}

function getStatusGradient(status: DisplayStatus): string {
  switch (status) {
    case 'safe':
      return 'from-emerald-500/20 via-transparent to-transparent';
    case 'need_help':
      return 'from-red-500/20 via-transparent to-transparent';
    case 'stale':
      return 'from-yellow-500/20 via-transparent to-transparent';
    default:
      return 'from-neutral-500/20 via-transparent to-transparent';
  }
}

function getStatusRingColor(status: DisplayStatus): string {
  switch (status) {
    case 'safe':
      return 'border-emerald-500/30 shadow-emerald-500/10';
    case 'need_help':
      return 'border-red-500/30 shadow-red-500/10';
    case 'stale':
      return 'border-yellow-500/30 shadow-yellow-500/10';
    default:
      return 'border-neutral-500/30';
  }
}

// ─── Status Circle Component ──────────────────────────────────────────────────

function StatusCircle({ status }: { status: DisplayStatus }) {
  const shouldPulse = status === 'need_help';

  return (
    <div className={`relative w-36 h-36 rounded-full border-4 flex items-center justify-center shadow-2xl ${getStatusRingColor(status)}`}>
      {/* Pulse ring for need_help */}
      {shouldPulse && (
        <div className="absolute inset-0 rounded-full border-4 border-red-500/50 animate-ping" aria-hidden="true" />
      )}
      <div className="relative z-10">
        {getStatusIcon(status)}
      </div>
    </div>
  );
}

// ─── Not Found View ───────────────────────────────────────────────────────────

function NotFoundView() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldQuestion className="w-10 h-10 text-neutral-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          {t('notFound', 'पेज नहीं मिला', 'Page Not Found')}
        </h1>
        <p className="text-neutral-400 text-base leading-relaxed mb-6">
          {t(
            'notFoundDesc',
            'यह सुरक्षा चेक-इन पेज मौजूद नहीं है, समाप्त हो गया है, या हटा दिया गया है।',
            'This safety check-in page doesn\'t exist, has expired, or has been removed.'
          )}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 h-12 px-6 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors"
        >
          {t('goHome', 'होम पर जाएं', 'Go Home')}
        </a>
      </div>
    </div>
  );
}

// ─── Error View ───────────────────────────────────────────────────────────────

function ErrorView({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-3">
          {t('errorTitle', 'कुछ गलत हो गया', 'Something Went Wrong')}
        </h1>
        <p className="text-neutral-400 text-base mb-6">
          {t('errorDesc', 'स्थिति लोड करने में विफल। कृपया पुनः प्रयास करें।', 'Failed to load status. Please try again.')}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 h-12 px-6 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <RefreshCw className="w-4 h-4" />
          {t('retry', 'पुनः प्रयास करें', 'Try Again')}
        </button>
      </div>
    </div>
  );
}

// ─── Main Public Status Page ──────────────────────────────────────────────────

function PublicStatusContent() {
  const { t } = useLanguage();
  const params = useParams();
  const searchParams = useSearchParams();
  const uuid = typeof params?.uuid === 'string' ? params.uuid : '';

  const intervalParam = searchParams.get('interval') || searchParams.get('t');
  const intervalMinutes = intervalParam ? parseInt(intervalParam, 10) || 10 : 10;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [data, setData] = useState<StatusPageData | null>(null);
  const [timeSinceCheckin, setTimeSinceCheckin] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('unknown');

  // Server-time offset synchronization to eliminate device clock skew
  const serverOffsetRef = useRef<number>(0);

  const fetchStatus = useCallback(async () => {
    if (!uuid) {
      setPageState('not_found');
      return;
    }

    try {
      const res = await fetch(`/api/status/${uuid}`);

      if (res.status === 404) {
        setPageState('not_found');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch');
      }

      const result = await res.json();
      if (result.server_time) {
        const serverMs = new Date(result.server_time).getTime();
        if (!isNaN(serverMs)) {
          serverOffsetRef.current = Date.now() - serverMs;
        }
      }
      setData(result);
      setDisplayStatus(computeDisplayStatus(result, intervalMinutes, serverOffsetRef.current));
      setPageState('loaded');
    } catch {
      if (pageState === 'loading') {
        setPageState('error');
      }
    }
  }, [uuid, pageState, intervalMinutes]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling every 5 seconds for rapid status updates
  useEffect(() => {
    if (pageState !== 'loaded') return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [pageState, fetchStatus]);

  // Live time counter (updates every second)
  useEffect(() => {
    if (!data) return;

    const update = () => {
      setTimeSinceCheckin(formatTimeSince(data.last_checkin_at, serverOffsetRef.current));
      setExpiresIn(formatTimeUntil(data.expires_at, serverOffsetRef.current));
      setDisplayStatus(computeDisplayStatus(data, intervalMinutes, serverOffsetRef.current));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [data, intervalMinutes]);

  // ─── Render states ─────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-lg">
            {t('loadingStatus', 'स्थिति लोड हो रही है...', 'Loading status...')}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'not_found') {
    return <NotFoundView />;
  }

  if (pageState === 'error') {
    return <ErrorView onRetry={fetchStatus} />;
  }

  if (!data) return null;

  const isExplicitNeedHelp = data.status === 'need_help';
  const isMissedCheckin = displayStatus === 'need_help' && !isExplicitNeedHelp;

  const statusTextMap: Record<DisplayStatus, string> = {
    safe: t('statusSafe', 'सुरक्षित (Safe)', 'Safe'),
    need_help: isExplicitNeedHelp
      ? t('statusNeedHelp', '🚨 मदद का अनुरोध (SOS)', '🚨 Help Requested (SOS)')
      : t('statusMissedCheckin', '⚠️ मिस्ड चेक-इन / खतरा अलार्म', '⚠️ Missed Check-In Alert'),
    stale: t('statusCheckinDueSoon', 'चेक-इन का समय होने वाला है', 'Check-In Due Soon'),
    unknown: t('statusUnknown', 'अज्ञात', 'Unknown'),
  };

  const statusDescMap: Record<DisplayStatus, string> = {
    safe: t(
      'descSafe',
      `इस व्यक्ति ने हाल ही में चेक-इन किया है और सुरक्षित है। (सुरक्षा टाइमर: हर ${intervalMinutes} मिनट)`,
      `This person checked in recently and is safe. (Safety interval: every ${intervalMinutes} mins)`
    ),
    need_help: isExplicitNeedHelp
      ? t(
          'descNeedHelp',
          'इस व्यक्ति ने मदद का बटन दबाया है! कृपया तुरंत संपर्क करें या आपातकालीन सेवा को सूचित करें।',
          'This person pressed the SOS Help button! Please contact them or alert emergency services.'
        )
      : t(
          'descMissedCheckin',
          `उपयोगकर्ता को हर ${intervalMinutes} मिनट में चेक-इन करना था और समय समाप्त हो चुका है। उनका फोन बंद, छीना हुआ या वे खतरे में हो सकते हैं।`,
          `User was scheduled to check in every ${intervalMinutes} mins and has missed the deadline. Their phone may be off, snatched, or they may be in danger.`
        ),
    stale: t(
      'descStale',
      `अगले चेक-इन का समय होने वाला है। यदि समय पर चेक-इन नहीं हुआ, तो यह अलार्म लाल हो जाएगा।`,
      `Next check-in is due soon. If not checked in on time, this alert will turn red automatically.`
    ),
    unknown: t('descUnknown', 'स्थिति अज्ञात है।', 'Status is unknown.'),
  };

  const badgeStatus = displayStatus === 'stale' ? 'active' : displayStatus === 'unknown' ? 'unknown' : displayStatus;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Top gradient based on status */}
      <div className={`absolute inset-x-0 top-0 h-80 bg-gradient-to-b ${getStatusGradient(displayStatus)} pointer-events-none`} aria-hidden="true" />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-8">
        {/* CRITICAL MISSED CHECK-IN / SOS DANGER BANNER */}
        {displayStatus === 'need_help' && (
          <div className="mb-6 bg-red-600/25 border-2 border-red-500 rounded-2xl p-4 text-center animate-pulse shadow-xl shadow-red-950/50">
            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-lg mb-1.5">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <span>
                {isExplicitNeedHelp
                  ? t('bannerSos', '🚨 आपातकालीन SOS सक्रिय!', '🚨 EMERGENCY SOS ACTIVE!')
                  : t('bannerDeadMan', '⚠️ मिस्ड चेक-इन: संभावित खतरा!', '⚠️ MISSED CHECK-IN: POTENTIAL DANGER!')}
              </span>
            </div>
            <p className="text-sm text-neutral-200 leading-relaxed mb-4">
              {isExplicitNeedHelp
                ? t(
                    'bannerSosDesc',
                    'उपयोगकर्ता ने आपातकालीन सहायता का अनुरोध किया है। कृपया तुरंत संपर्क करें या पुलिस (112) को कॉल करें।',
                    'User triggered an emergency SOS. Please call them or contact police (112) immediately.'
                  )
                : t(
                    'bannerDeadManDesc',
                    `उपयोगकर्ता ने ${intervalMinutes} मिनट के भीतर सुरक्षित चेक-इन नहीं किया। यदि वे कॉल नहीं उठा रहे हैं, तो नीचे दिए गए अंतिम GPS स्थान पर सहायता भेजें।`,
                    `User failed to check in within the ${intervalMinutes}-min safety window. If unreachable, send help to their last recorded GPS position below.`
                  )}
            </p>

            {/* Quick emergency call triggers */}
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="tel:112"
                className="h-12 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                {t('call112', 'कॉल 112 (पुलिस)', 'Call 112 (Police)')}
              </a>
              <a
                href="tel:1091"
                className="h-12 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                {t('call1091', 'कॉल 1091 (महिला)', 'Call 1091 (Women)')}
              </a>
            </div>
          </div>
        )}

        {/* Status circle */}
        <div className="flex justify-center mb-6">
          <StatusCircle status={displayStatus} />
        </div>

        {/* Status text */}
        <div className="text-center mb-6">
          <StatusBadge
            status={badgeStatus}
            size="lg"
            pulse={displayStatus === 'need_help'}
            className="mb-3"
          />

          <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
            {statusTextMap[displayStatus]}
          </h1>

          <p className="text-neutral-400 text-base leading-relaxed max-w-sm mx-auto">
            {statusDescMap[displayStatus]}
          </p>
        </div>

        {/* Safety Interval Info Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
            <Timer className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {t('timerActive', 'सुरक्षा अंतराल:', 'Safety interval:')}{' '}
              <strong className="text-white font-mono">{intervalMinutes} min</strong> —{' '}
              {t('timerMustConfirm', 'हर ' + intervalMinutes + ' मिनट में "मैं सुरक्षित हूँ" दबाना आवश्यक है', 'Must tap "I\'m Safe" every ' + intervalMinutes + ' mins')}
            </span>
          </div>
        </div>

        {/* Time since last check-in */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-neutral-400 mb-0.5">
                {t('lastConfirmedSafe', 'पिछली बार सुरक्षित होने की पुष्टि', 'Last confirmed safe')}
              </p>
              <p className="text-xl font-bold font-mono tracking-wide">
                {timeSinceCheckin} <span className="text-sm font-normal text-neutral-500">{t('ago', 'पहले', 'ago')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        {data.message && (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-neutral-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-neutral-500 mb-1">
                  {t('message', 'संदेश (Message)', 'Message')}
                </p>
                <p className="text-base text-white leading-relaxed">
                  {data.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LAST RECORDED GPS LOCATION BREADCRUMB */}
        {data.location_link ? (
          <div className={`rounded-2xl p-5 mb-4 border transition-colors ${
            displayStatus === 'need_help'
              ? 'bg-red-950/30 border-red-500/50 shadow-lg shadow-red-950/30'
              : 'bg-neutral-900/80 border-neutral-800'
          }`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                displayStatus === 'need_help' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                  displayStatus === 'need_help' ? 'text-red-400' : 'text-neutral-400'
                }`}>
                  {displayStatus === 'need_help'
                    ? t('lastKnownGpsTitle', '📍 अंतिम ज्ञात GPS स्थान (Last Known GPS)', '📍 Last Known GPS Position')
                    : t('sharedLocation', 'साझा GPS स्थान (Live Location)', 'Live GPS Location')}
                </p>
                <p className="text-xs text-neutral-400">
                  {t('recordedAgo', 'रिकॉर्ड किया गया:', 'Recorded:')} {timeSinceCheckin} {t('ago', 'पहले', 'ago')}
                </p>
              </div>
            </div>

            <a
              href={data.location_link}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                displayStatus === 'need_help'
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-md'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              aria-label={t('viewLocation', 'मानचित्र पर देखें', 'View location on Google Maps')}
            >
              <Navigation className="w-4 h-4" />
              <span>{t('openMapsNav', 'Google Maps पर देखें और नेविगेट करें', 'Open Google Maps & Navigate')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {displayStatus === 'need_help' && (
              <p className="text-xs text-neutral-400 text-center mt-2.5">
                {t(
                  'gpsPoliceAdvice',
                  'आपातकाल में यह लिंक पुलिस (112) या परिजनों को भेजें।',
                  'In emergency, forward this map link to police (112) or family.'
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs text-neutral-500">
              {t('noLocation', 'इस चेक-इन के दौरान कोई GPS स्थान रिकॉर्ड नहीं हुआ।', 'No GPS location recorded for this check-in.')}
            </p>
          </div>
        )}

        {/* Emergency contact helper */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 mb-6">
          <p className="text-xs text-neutral-400 text-center leading-relaxed">
            {t(
              'publicViewAdvice',
              'यह पेज एक स्वचालित सुरक्षा मॉनिटर है। यदि स्थिति लाल हो जाती है और व्यक्ति फोन नहीं उठा रहा, तो तुरंत 112 पर कॉल करें।',
              'This page is an automated safety monitor. If status turns red and the person does not answer calls, dial 112 immediately.'
            )}
          </p>
        </div>

        {/* Expires notice */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-neutral-600">
            {t('expiresIn', 'सत्र समाप्त होगा', 'Session expires in')}: <span className="font-mono text-neutral-500">{expiresIn}</span>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-600">
            <RefreshCw className="w-3 h-3" />
            {t('autoRefresh', 'यह पेज हर 10 सेकंड में स्वतः रिफ्रेश होता है', 'This page auto-refreshes every 10 seconds')}
          </div>
        </div>

        {/* Suraksha branding */}
        <div className="text-center mt-10 pb-8">
          <div className="flex items-center justify-center gap-2 text-neutral-700">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wider uppercase">
              {t('poweredBy', 'सुरक्षा द्वारा संचालित', 'Powered by Suraksha')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <PublicStatusContent />
    </Suspense>
  );
}
