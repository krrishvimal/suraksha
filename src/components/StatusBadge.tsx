'use client';

import { STATUS_COLORS } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n';

type StatusType = 'safe' | 'need_help' | 'active' | 'unknown';
type BadgeSize = 'sm' | 'md' | 'lg';

interface StatusBadgeProps {
  status: StatusType;
  size?: BadgeSize;
  pulse?: boolean;
  className?: string;
}

const SIZE_MAP: Record<BadgeSize, { dot: string; text: string; container: string }> = {
  sm: {
    dot: 'w-3 h-3',
    text: 'text-sm',
    container: 'gap-1.5 px-2.5 py-1',
  },
  md: {
    dot: 'w-4 h-4',
    text: 'text-base',
    container: 'gap-2 px-3.5 py-1.5',
  },
  lg: {
    dot: 'w-6 h-6',
    text: 'text-lg font-semibold',
    container: 'gap-3 px-5 py-2.5',
  },
};

function getStatusColor(status: StatusType): string {
  switch (status) {
    case 'safe':
      return STATUS_COLORS.safe;
    case 'need_help':
      return STATUS_COLORS.danger;
    case 'active':
      return STATUS_COLORS.warning;
    case 'unknown':
    default:
      return STATUS_COLORS.inactive;
  }
}

function getStatusBgClass(status: StatusType): string {
  switch (status) {
    case 'safe':
      return 'bg-emerald-500';
    case 'need_help':
      return 'bg-red-500';
    case 'active':
      return 'bg-yellow-500';
    case 'unknown':
    default:
      return 'bg-neutral-500';
  }
}

function getStatusRingClass(status: StatusType): string {
  switch (status) {
    case 'safe':
      return 'ring-emerald-500/30';
    case 'need_help':
      return 'ring-red-500/30';
    case 'active':
      return 'ring-yellow-500/30';
    case 'unknown':
    default:
      return 'ring-neutral-500/30';
  }
}

function getStatusContainerBg(status: StatusType): string {
  switch (status) {
    case 'safe':
      return 'bg-emerald-500/10 border-emerald-500/20';
    case 'need_help':
      return 'bg-red-500/10 border-red-500/20';
    case 'active':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'unknown':
    default:
      return 'bg-neutral-500/10 border-neutral-500/20';
  }
}

export default function StatusBadge({
  status,
  size = 'md',
  pulse = false,
  className = '',
}: StatusBadgeProps) {
  const { t } = useLanguage();

  const sizeConfig = SIZE_MAP[size];
  const shouldPulse = pulse || status === 'need_help';
  const color = getStatusColor(status);

  const statusLabels: Record<StatusType, string> = {
    safe: t('safe', 'सुरक्षित', 'Safe'),
    need_help: t('needHelp', 'मदद चाहिए', 'Needs Help'),
    active: t('active', 'सक्रिय', 'Active'),
    unknown: t('unknown', 'अज्ञात', 'Unknown'),
  };

  const label = statusLabels[status];

  return (
    <div
      className={`inline-flex items-center rounded-full border ${sizeConfig.container} ${getStatusContainerBg(status)} ${className}`}
      role="status"
      aria-label={label}
    >
      <span className="relative flex">
        {/* Pulsing ring */}
        {shouldPulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${getStatusBgClass(status)}`}
            aria-hidden="true"
          />
        )}
        {/* Solid dot */}
        <span
          className={`relative inline-flex rounded-full ${sizeConfig.dot} ${getStatusBgClass(status)} ring-4 ${getStatusRingClass(status)}`}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      </span>
      <span className={`${sizeConfig.text} font-medium`} style={{ color }}>
        {label}
      </span>
    </div>
  );
}
