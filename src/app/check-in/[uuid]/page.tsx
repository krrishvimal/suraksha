'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { STATUS_THRESHOLDS } from '@/lib/constants';
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
}

type DisplayStatus = 'safe' | 'need_help' | 'stale' | 'unknown';
type PageState = 'loading' | 'loaded' | 'not_found' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 0) return '0s';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
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

function getTimeSinceMs(isoDate: string): number {
  return Date.now() - new Date(isoDate).getTime();
}

function computeDisplayStatus(data: StatusPageData): DisplayStatus {
  // If explicitly need_help, always show that
  if (data.status === 'need_help') return 'need_help';

  const timeSinceMs = getTimeSinceMs(data.last_checkin_at);
  const warningMs = STATUS_THRESHOLDS.warning * 60 * 60 * 1000; // 1 hour
  const dangerMs = STATUS_THRESHOLDS.danger * 60 * 60 * 1000;   // 2 hours

  // No recent check-in → stale
  if (timeSinceMs > dangerMs) return 'need_help'; // Red after 2 hours
  if (timeSinceMs > warningMs) return 'stale';    // Yellow after 1 hour

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
  const uuid = typeof params?.uuid === 'string' ? params.uuid : '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [data, setData] = useState<StatusPageData | null>(null);
  const [timeSinceCheckin, setTimeSinceCheckin] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('unknown');
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

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
      setData(result);
      setDisplayStatus(computeDisplayStatus(result));
      setPageState('loaded');
      setLastRefresh(Date.now());
    } catch {
      if (pageState === 'loading') {
        setPageState('error');
      }
      // If already loaded, silently fail (stale data better than no data)
    }
  }, [uuid, pageState]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling every 10 seconds
  useEffect(() => {
    if (pageState !== 'loaded') return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [pageState, fetchStatus]);

  // Live time counter (updates every second)
  useEffect(() => {
    if (!data) return;

    const update = () => {
      setTimeSinceCheckin(formatTimeSince(data.last_checkin_at));
      setExpiresIn(formatTimeUntil(data.expires_at));
      // Also re-compute display status based on time thresholds
      setDisplayStatus(computeDisplayStatus(data));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [data]);

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

  const statusTextMap: Record<DisplayStatus, string> = {
    safe: t('statusSafe', 'सुरक्षित', 'Safe'),
    need_help: data.status === 'need_help'
      ? t('statusNeedHelp', 'मदद चाहिए', 'Needs Help')
      : t('statusNoRecentUpdate', 'कोई हाल का अपडेट नहीं', 'No Recent Update'),
    stale: t('statusNoRecentUpdate', 'कोई हाल का अपडेट नहीं', 'No Recent Update'),
    unknown: t('statusUnknown', 'अज्ञात', 'Unknown'),
  };

  const statusDescMap: Record<DisplayStatus, string> = {
    safe: t(
      'descSafe',
      'इस व्यक्ति ने हाल ही में चेक-इन किया है और सुरक्षित है।',
      'This person has checked in recently and is safe.'
    ),
    need_help: data.status === 'need_help'
      ? t(
          'descNeedHelp',
          'इस व्यक्ति ने मदद का अनुरोध किया है। कृपया तुरंत संपर्क करें।',
          'This person has requested help. Please contact them immediately.'
        )
      : t(
          'descStaleRed',
          'कोई हाल का चेक-इन नहीं। कृपया उनसे संपर्क करें।',
          'No recent check-in. Please reach out to them.'
        ),
    stale: t(
      'descStale',
      'एक घंटे से अधिक समय से कोई चेक-इन नहीं। कृपया पुष्टि करें कि वे ठीक हैं।',
      'No check-in for over an hour. Please verify they are okay.'
    ),
    unknown: t('descUnknown', 'स्थिति अज्ञात है।', 'Status is unknown.'),
  };

  const badgeStatus = displayStatus === 'stale' ? 'active' : displayStatus === 'unknown' ? 'unknown' : displayStatus;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Top gradient based on status */}
      <div className={`absolute inset-x-0 top-0 h-80 bg-gradient-to-b ${getStatusGradient(displayStatus)} pointer-events-none`} aria-hidden="true" />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        {/* Status circle */}
        <div className="flex justify-center mb-8">
          <StatusCircle status={displayStatus} />
        </div>

        {/* Status text */}
        <div className="text-center mb-8">
          <StatusBadge
            status={badgeStatus}
            size="lg"
            pulse={displayStatus === 'need_help'}
            className="mb-4"
          />

          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            {statusTextMap[displayStatus]}
          </h1>

          <p className="text-neutral-400 text-lg leading-relaxed max-w-sm mx-auto">
            {statusDescMap[displayStatus]}
          </p>
        </div>

        {/* Time since last check-in */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-500">
                {t('lastCheckin', 'पिछला चेक-इन', 'Last check-in')}
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
                <p className="text-sm text-neutral-500 mb-1">
                  {t('message', 'संदेश', 'Message')}
                </p>
                <p className="text-base text-white leading-relaxed">
                  {data.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Location */}
        {data.location_link && (
          <a
            href={data.location_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-neutral-900/80 border border-neutral-800 hover:border-blue-500/30 rounded-2xl p-5 mb-4 transition-colors group"
            aria-label={t('viewLocation', 'स्थान देखें', 'View location on map')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-neutral-500 mb-0.5">
                  {t('sharedLocation', 'साझा स्थान', 'Shared Location')}
                </p>
                <p className="text-blue-400 text-sm flex items-center gap-1 group-hover:underline">
                  {t('openMaps', 'मानचित्र पर देखें', 'Open in Maps')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </p>
              </div>
            </div>
          </a>
        )}

        {/* Expires notice */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-neutral-600">
            {t('expiresIn', 'समाप्त होगा', 'Expires in')}: <span className="font-mono text-neutral-500">{expiresIn}</span>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-600">
            <RefreshCw className="w-3 h-3" />
            {t('autoRefresh', 'यह पेज हर 10 सेकंड में स्वतः रिफ्रेश होता है', 'This page auto-refreshes every 10 seconds')}
          </div>
        </div>

        {/* Suraksha branding */}
        <div className="text-center mt-12 pb-8">
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
