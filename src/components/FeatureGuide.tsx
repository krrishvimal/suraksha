'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

export interface GuideStep {
  title: string;
  desc: string;
}

interface FeatureGuideProps {
  badge?: string;
  title: string;
  subtitle?: string;
  aboutText: string;
  steps: GuideStep[];
  proTip?: string;
  accentColor?: 'blue' | 'emerald' | 'red';
  defaultExpanded?: boolean;
}

export default function FeatureGuide({
  title,
  subtitle,
  aboutText,
  steps,
  proTip,
  accentColor = 'blue',
  defaultExpanded = false,
}: FeatureGuideProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const colorStyles = {
    blue: {
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      stepNum: 'bg-blue-600 text-white',
      accentText: 'text-blue-400',
      tipBorder: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      stepNum: 'bg-emerald-600 text-white',
      accentText: 'text-emerald-400',
      tipBorder: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    },
    red: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30',
      stepNum: 'bg-red-600 text-white',
      accentText: 'text-red-400',
      tipBorder: 'border-red-500/20 bg-red-500/10 text-red-300',
    },
  }[accentColor];

  return (
    <div
      className={`rounded-2xl border ${colorStyles.border} ${colorStyles.bg} overflow-hidden transition-all duration-200`}
    >
      {/* Header bar / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] focus:outline-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{title}</h2>
            <p className="text-[11px] text-white/50 truncate">
              {subtitle || (isExpanded ? 'Tap to hide / बंद करने के लिए टैप करें' : 'Tap to see instructions / उपयोग विधि देखने के लिए टैप करें')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-white/60 shrink-0 pl-2 font-medium">
          <span>{isExpanded ? 'Hide / बंद करें' : 'Open / खोलें'}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-white/80" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/80" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5 animate-in fade-in duration-200">
          {/* About section */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/90 mb-1">
              <Info className={`h-3.5 w-3.5 ${colorStyles.accentText}`} />
              <span>About this feature / यह सुविधा क्या है:</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed pl-5">{aboutText}</p>
          </div>

          {/* 3 Step How to Use */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/90 mb-2">
              <CheckCircle2 className={`h-3.5 w-3.5 ${colorStyles.accentText}`} />
              <span>How to use in 3 steps / 3 आसान चरणों में उपयोग करें:</span>
            </div>
            <div className="space-y-2 pl-1">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${colorStyles.stepNum}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="leading-tight pt-0.5">
                    <strong className="text-white font-medium">{step.title}: </strong>
                    <span className="text-white/60">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip */}
          {proTip && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs ${colorStyles.tipBorder}`}
            >
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="text-[11.5px] leading-relaxed text-white/80">{proTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
