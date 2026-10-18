'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode,
  Save,
  Download,
  User,
  Droplets,
  Phone,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  HelpCircle,
  Smartphone,
  Lock,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getItem, setItem, StorageKeys } from '@/lib/storage';
import Link from 'next/link';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
type BloodGroup = (typeof BLOOD_GROUPS)[number] | '';

interface EmergencyCardData {
  name: string;
  bloodGroup: BloodGroup;
  emergencyContacts: string[];
  allergies: string;
  medicalConditions: string; // Used for Emergency Notes & Instructions
}

const EMPTY_CARD: EmergencyCardData = {
  name: '',
  bloodGroup: '',
  emergencyContacts: [''],
  allergies: '',
  medicalConditions: '',
};

const MAX_EMERGENCY_CONTACTS = 2;

type DisplayMode = 'privacy' | 'open';

// Safe cross-browser round rectangle helper
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function QRCardPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<EmergencyCardData>(EMPTY_CARD);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('privacy');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved data on mount
  useEffect(() => {
    try {
      const saved = getItem<EmergencyCardData>(StorageKeys.EMERGENCY_CARD);
      if (saved) {
        setFormData({
          ...EMPTY_CARD,
          ...saved,
          emergencyContacts:
            saved.emergencyContacts && saved.emergencyContacts.length > 0
              ? saved.emergencyContacts
              : [''],
        });
      }
    } catch (err) {
      console.error('Failed to load saved QR card data:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const updateField = useCallback(
    <K extends keyof EmergencyCardData>(key: K, value: EmergencyCardData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setError(null);
    },
    []
  );

  const updateContact = useCallback((index: number, value: string) => {
    setFormData((prev) => {
      const contacts = [...prev.emergencyContacts];
      contacts[index] = value;
      return { ...prev, emergencyContacts: contacts };
    });
    setError(null);
  }, []);

  const addContact = useCallback(() => {
    setFormData((prev) => {
      if (prev.emergencyContacts.length >= MAX_EMERGENCY_CONTACTS) return prev;
      return {
        ...prev,
        emergencyContacts: [...prev.emergencyContacts, ''],
      };
    });
  }, []);

  const removeContact = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.emergencyContacts.length <= 1) return prev;
      const contacts = prev.emergencyContacts.filter((_, i) => i !== index);
      return { ...prev, emergencyContacts: contacts };
    });
  }, []);

  // Renders complete high-visibility Tactical Blue Emergency ID Badge on HTML5 Canvas
  const generateQRBadge = useCallback(
    async (data: EmergencyCardData, mode: DisplayMode = displayMode) => {
      setIsGenerating(true);
      setError(null);
      try {
        const QRCode = (await import('qrcode')).default;

        // Build clean human-readable emergency text payload
        const filteredContacts = data.emergencyContacts.filter((c) => c.trim().length > 0);
        const contactsText = filteredContacts.length > 0 ? filteredContacts.join(', ') : 'None';

        // When scanned, phone cameras highlight numbers and make them 1-tap dialable
        const qrPayload = [
          '🚨 EMERGENCY SOS ID | आपातकालीन पहचान',
          '━━━━━━━━━━━━━━━━━━━━━━',
          `👤 Name: ${data.name.trim() || 'Not specified'}`,
          `📞 Emergency Contact: ${contactsText}`,
          `🩸 Blood Group: ${data.bloodGroup || 'Not specified'}`,
          `⚠️ Critical Notes: ${data.allergies.trim() || 'None'}`,
          `📝 Emergency Instructions: ${data.medicalConditions.trim() || 'None'}`,
          '━━━━━━━━━━━━━━━━━━━━━━',
          `⚡ In emergency, call ${contactsText} or dial 112 immediately.`,
          '— Suraksha Privacy-First Safety'
        ].join('\n');

        // Generate QR code with Error Correction Level 'H' (30% recovery tolerance)
        const qrBase64 = await QRCode.toDataURL(qrPayload, {
          width: 340,
          margin: 1,
          color: {
            dark: '#0A0A0A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });

        // Load QR image into element
        const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = qrBase64;
        });

        // Create Master Canvas: 540 x 860 (Official ID badge aspect ratio)
        const canvas = document.createElement('canvas');
        canvas.width = 540;
        canvas.height = 860;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not supported');

        // 1. Tactical Dark Canvas Background & Outer Border
        ctx.fillStyle = '#090D16';
        drawRoundRect(ctx, 2, 2, 536, 856, 28);
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1E293B';
        ctx.stroke();

        // 2. Tactical Blue Top Header Banner
        ctx.save();
        drawRoundRect(ctx, 4, 4, 532, 122, 24);
        ctx.clip();

        const bannerGrad = ctx.createLinearGradient(0, 0, 540, 120);
        bannerGrad.addColorStop(0, '#1D4ED8'); // Tactical Royal Blue
        bannerGrad.addColorStop(0.7, '#1E3A8A'); // Navy Tactical
        bannerGrad.addColorStop(1, '#0F172A'); // Midnight Slate
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, 0, 540, 126);

        // Subtle Tactical Blue Accent line at banner bottom
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(0, 120, 540, 2);

        // Header White Protective Shield Emblem Badge
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(52, 63, 25, 0, Math.PI * 2);
        ctx.fill();

        // Tactical Blue Shield Icon inside emblem
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.moveTo(52, 47);
        ctx.lineTo(67, 53);
        ctx.lineTo(67, 67);
        ctx.quadraticCurveTo(67, 80, 52, 86);
        ctx.quadraticCurveTo(37, 80, 37, 67);
        ctx.lineTo(37, 53);
        ctx.closePath();
        ctx.fill();

        // Inner white exclamation point
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 52, 72);
        ctx.textAlign = 'left';

        // Header Typography
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 23px system-ui, -apple-system, sans-serif';
        ctx.fillText('EMERGENCY ID CARD', 92, 50);

        ctx.fillStyle = '#BFDBFE';
        ctx.font = '500 13px system-ui, -apple-system, sans-serif';
        ctx.fillText('आपातकालीन पहचान पत्र', 92, 72);

        ctx.fillStyle = '#67E8F9';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('⚡ SCAN WITH CAMERA TO CALL CONTACTS • NO APP NEEDED', 92, 95);
        ctx.restore();

        // 3. Central QR Code Container
        const qrBoxX = 110;
        const qrBoxY = 142;
        const qrBoxSize = 320;

        // Container card with crisp rounded border
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38BDF8'; // Tactical Cyan/Blue Border
        ctx.stroke();

        // Draw the QR Code image (280x280 centered in the 320x320 box)
        ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, 280, 280);

        // 4. Center Universal SOS Tactical Emblem (Overlayed right on the QR center!)
        const centerEmblemX = 270;
        const centerEmblemY = qrBoxY + 160;
        const emblemW = 68;
        const emblemH = 46;

        // Tactical Royal Blue pill badge with bold white border
        ctx.fillStyle = '#1D4ED8';
        drawRoundRect(
          ctx,
          centerEmblemX - emblemW / 2,
          centerEmblemY - emblemH / 2,
          emblemW,
          emblemH,
          12
        );
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Bold SOS text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 21px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SOS', centerEmblemX, centerEmblemY + 7);

        // Subtext under QR
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(
          mode === 'privacy'
            ? '🔒 CONTACTS PROTECTED • POINT CAMERA AT QR TO CALL'
            : '🔒 100% OFFLINE SECURE • POINT CAMERA AT QR TO CALL',
          270,
          482
        );
        ctx.textAlign = 'left';

        // 5. Tactical Details Section
        const infoCardY = 502;
        ctx.fillStyle = '#0F172A'; // Tactical Dark Slate Card
        drawRoundRect(ctx, 24, infoCardY, 492, 252, 18);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#1E293B';
        ctx.stroke();

        // Row 1: Name & Blood Group Pill
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('NAME / पूरा नाम:', 44, infoCardY + 28);

        const displayName = data.name.trim() || 'NOT SPECIFIED';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        const truncatedName = displayName.length > 20 ? displayName.slice(0, 18) + '...' : displayName;
        ctx.fillText(truncatedName, 44, infoCardY + 54);

        // Blood Group Tactical Blue Pill (Top Right, if set)
        if (data.bloodGroup) {
          const pillX = 370;
          const pillY = infoCardY + 24;
          ctx.fillStyle = '#172554'; // Deep tactical blue
          drawRoundRect(ctx, pillX, pillY, 126, 36, 18);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#3B82F6'; // Electric blue
          ctx.stroke();

          ctx.fillStyle = '#93C5FD';
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🩸 ${data.bloodGroup}`, pillX + 63, pillY + 23);
          ctx.textAlign = 'left';
        }

        // Divider
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44, infoCardY + 74);
        ctx.lineTo(496, infoCardY + 74);
        ctx.stroke();

        if (mode === 'privacy') {
          // PRIVACY MODE: Numbers are kept safely inside the QR code so strangers on the metro can't peep at them!
          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillText('EMERGENCY CONTACTS / आपातकालीन संपर्क:', 44, infoCardY + 102);

          ctx.fillStyle = '#10B981';
          ctx.font = 'bold 14.5px system-ui, -apple-system, sans-serif';
          ctx.fillText('🔒 Encoded in QR (Scan to Call Family / संपर्क करें)', 44, infoCardY + 124);

          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillText('EMERGENCY INSTRUCTIONS / आपातकालीन निर्देश:', 44, infoCardY + 154);

          ctx.fillStyle = '#818CF8';
          ctx.font = '600 13px system-ui, -apple-system, sans-serif';
          ctx.fillText('🔒 Encoded in QR Code (Scan to View / देखने हेतु)', 44, infoCardY + 174);

          // Helpful instruction pill
          ctx.fillStyle = '#172554';
          drawRoundRect(ctx, 44, infoCardY + 196, 452, 40, 10);
          ctx.fill();
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#93C5FD';
          ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👉 Responders: Point any phone camera at QR code above to call', 270, infoCardY + 221);
          ctx.textAlign = 'left';
        } else {
          // OPEN MODE: Displays all numbers and notes directly on the card
          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillText('EMERGENCY CONTACTS / आपातकालीन संपर्क:', 44, infoCardY + 98);

          ctx.fillStyle = '#10B981';
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.fillText(`📞 ${contactsText}`, 44, infoCardY + 120);

          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillText('CRITICAL NOTES / महत्वपूर्ण जानकारी:', 44, infoCardY + 146);

          const allergiesVal = data.allergies.trim() || 'None reported / कोई नहीं';
          ctx.fillStyle = '#F59E0B';
          ctx.font = '600 13px system-ui, -apple-system, sans-serif';
          ctx.fillText(
            allergiesVal.length > 44 ? allergiesVal.slice(0, 42) + '...' : allergiesVal,
            44,
            infoCardY + 166
          );

          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillText('EMERGENCY INSTRUCTIONS / आपातकालीन निर्देश:', 44, infoCardY + 192);

          const conditionsVal = data.medicalConditions.trim() || 'None reported / कोई नहीं';
          ctx.fillStyle = '#A78BFA';
          ctx.font = '600 13px system-ui, -apple-system, sans-serif';
          ctx.fillText(
            conditionsVal.length > 44 ? conditionsVal.slice(0, 42) + '...' : conditionsVal,
            44,
            infoCardY + 212
          );

          ctx.fillStyle = '#64748B';
          ctx.font = '500 10px system-ui, -apple-system, sans-serif';
          ctx.fillText('In emergency, call contacts above or scan QR for 1-tap dial.', 44, infoCardY + 234);
        }

        // 6. National Helplines Bar
        const helplineY = 768;
        ctx.fillStyle = '#0F172A';
        drawRoundRect(ctx, 24, helplineY, 492, 42, 10);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1E3A8A';
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚨 HELPLINES: Police / All Emergency 112 • Ambulance 108 • Women 1091', 270, helplineY + 26);

        // 7. Watermark / Footer
        ctx.fillStyle = '#64748B';
        ctx.font = '500 10.5px system-ui, -apple-system, sans-serif';
        ctx.fillText('🛡️ Suraksha Safety • Free Open-Source Emergency Tool • Keep on Phone Lock Screen', 270, 834);
        ctx.textAlign = 'left';

        // Export as High-Resolution PNG
        const finalDataUrl = canvas.toDataURL('image/png');
        setQrDataUrl(finalDataUrl);
      } catch (err) {
        console.error('Emergency ID Badge generation failed:', err);
        setError(
          t(
            'qr_gen_failed',
            'Failed to generate QR code badge. Please try again. / QR कोड बनाने में विफल। कृपया पुनः प्रयास करें।'
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [displayMode, t]
  );

  const handleSave = useCallback(async () => {
    // Validate
    if (!formData.name.trim()) {
      setError(t('name_required', 'Name is required / नाम आवश्यक है'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save to localStorage
      setItem(StorageKeys.EMERGENCY_CARD, formData);

      // Generate Tactical Blue Badge
      await generateQRBadge(formData, displayMode);

      // Show success message
      setShowSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setError(
        t(
          'save_failed',
          'Failed to save. Please try again. / सेव करने में विफल। कृपया पुनः प्रयास करें।'
        )
      );
    } finally {
      setIsSaving(false);
    }
  }, [formData, displayMode, generateQRBadge, t]);

  const handleDisplayModeChange = useCallback(
    async (newMode: DisplayMode) => {
      setDisplayMode(newMode);
      if (formData.name.trim()) {
        await generateQRBadge(formData, newMode);
      }
    },
    [formData, generateQRBadge]
  );

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    try {
      const link = document.createElement('a');
      link.download = `suraksha-emergency-id-${formData.name.trim().replace(/\s+/g, '-').toLowerCase() || 'card'}.png`;
      link.href = qrDataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      setError(
        t(
          'download_failed',
          'Download failed. Try long-pressing the badge image to save. / डाउनलोड विफल। छवि को लंबे दबाकर सेव करें।'
        )
      );
    }
  }, [qrDataUrl, formData.name, t]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" aria-label="Loading" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0A0A0A]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('go_back', 'Go back / वापस जाएं')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-blue-500" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t('emergency_qr_card', 'Emergency ID Card / आपातकालीन पहचान पत्र')}
              </h1>
              <p className="text-xs text-white/40">
                {t('qr_subtitle', 'Universal scannable emergency ID card / सभी आपात स्थितियों के लिए पहचान पत्र')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* Privacy notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-emerald-300/80">
            {t(
              'qr_privacy',
              'All data stays on your device. Nothing is sent to any server. / सारी जानकारी आपके डिवाइस पर रहती है। कुछ भी किसी सर्वर पर नहीं भेजा जाता।'
            )}
          </p>
        </div>

        {/* Success toast */}
        {showSuccess && (
          <div
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400 animate-in fade-in duration-200"
            role="status"
            aria-live="polite"
          >
            <CheckCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {t('saved_successfully', 'Emergency ID Badge generated! / आपातकालीन ID बैज बन गया!')}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Form */}
        <section className="space-y-4">
          {/* Name */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-name"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <User className="h-4 w-4 text-blue-400" aria-hidden="true" />
              {t('full_name', 'Full Name / पूरा नाम')}
              <span className="text-red-400">*</span>
            </label>
            <input
              id="qr-name"
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('enter_name', 'Enter your full name / अपना पूरा नाम दर्ज करें')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              maxLength={60}
              required
              aria-required="true"
            />
          </div>

          {/* Emergency Contacts */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
              <Phone className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              {t('emergency_contacts', 'Emergency Contacts / आपातकालीन संपर्क')}
              <span className="ml-auto text-xs text-white/30">
                {formData.emergencyContacts.length}/{MAX_EMERGENCY_CONTACTS}
              </span>
            </label>
            <div className="space-y-2.5">
              {formData.emergencyContacts.map((contact, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={contact}
                    onChange={(e) => updateContact(index, e.target.value)}
                    placeholder="+91-9876543210"
                    className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    aria-label={`${t('emergency_contact', 'Emergency contact / आपातकालीन संपर्क')} ${index + 1}`}
                    maxLength={15}
                  />
                  {formData.emergencyContacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      aria-label={t('remove_contact', 'Remove contact / संपर्क हटाएं')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {formData.emergencyContacts.length < MAX_EMERGENCY_CONTACTS && (
                <button
                  type="button"
                  onClick={addContact}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 py-2.5 text-xs text-white/50 transition-colors hover:border-blue-500/40 hover:text-blue-400"
                  aria-label={t('add_contact_btn', 'Add emergency contact / आपातकालीन संपर्क जोड़ें')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('add_contact_short', 'Add Contact / संपर्क जोड़ें')}
                </button>
              )}
            </div>
          </div>

          {/* Blood Group (Optional) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-blood-group"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <Droplets className="h-4 w-4 text-blue-400" aria-hidden="true" />
              {t('blood_group', 'Blood Group (Optional) / रक्त समूह (ऐच्छिक)')}
            </label>
            <select
              id="qr-blood-group"
              value={formData.bloodGroup}
              onChange={(e) => updateField('bloodGroup', e.target.value as BloodGroup)}
              className="min-h-[48px] w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              aria-label={t('select_blood_group', 'Select blood group / रक्त समूह चुनें')}
            >
              <option value="" className="bg-[#1a1a1a] text-white/50">
                {t('select_blood_group', 'Select blood group / रक्त समूह चुनें')}
              </option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg} className="bg-[#1a1a1a] text-white">
                  {bg}
                </option>
              ))}
            </select>
          </div>

          {/* Critical Notes / Allergies */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-allergies"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
              {t('critical_info', 'Critical Notes / Allergies (महत्वपूर्ण जानकारी / एलर्जी)')}
            </label>
            <input
              id="qr-allergies"
              type="text"
              value={formData.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              placeholder={t('critical_placeholder', 'e.g., Penicillin allergy, Diabetic, Carry inhaler / जैसे, पेनिसिलिन एलर्जी')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              maxLength={100}
            />
          </div>

          {/* Emergency Instructions / Notes */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-medical"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <FileText className="h-4 w-4 text-purple-400" aria-hidden="true" />
              {t('emergency_instructions', 'Emergency Instructions / आपातकालीन निर्देश')}
            </label>
            <input
              id="qr-medical"
              type="text"
              value={formData.medicalConditions}
              onChange={(e) => updateField('medicalConditions', e.target.value)}
              placeholder={t('instructions_placeholder', 'e.g., If lost call parents / If detained notify lawyer / अगर खो जाए तो माता-पिता को कॉल करें')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              maxLength={100}
            />
          </div>

          {/* Card Display Mode Chooser: Privacy vs Open */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-400">
              <Lock className="h-4 w-4" aria-hidden="true" />
              {t('display_mode_title', 'Lock Screen Privacy Mode / गोपनीयता मोड')}
            </label>
            <p className="mb-3 text-xs leading-relaxed text-white/60">
              {t(
                'display_mode_desc',
                'Choose how much info is visible on the card image vs hidden inside the QR scan:'
              )}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDisplayModeChange('privacy')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  displayMode === 'privacy'
                    ? 'border-blue-500 bg-blue-500/20 text-white shadow-md'
                    : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                  <Lock className="h-3.5 w-3.5" />
                  {t('mode_privacy', 'Privacy Mode')}
                </div>
                <span className="text-[11px] leading-tight text-white/70">
                  Numbers hidden in QR. Strangers on metro can&apos;t steal phone numbers.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDisplayModeChange('open')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  displayMode === 'open'
                    ? 'border-blue-500 bg-blue-500/20 text-white shadow-md'
                    : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                  <Eye className="h-3.5 w-3.5" />
                  {t('mode_open', 'Open Badge')}
                </div>
                <span className="text-[11px] leading-tight text-white/70">
                  Numbers printed on card + QR for instant 1-tap call. Best for wallet printouts.
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isGenerating}
          className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('generate_emergency_badge', 'Save & Generate Emergency ID Badge / सेव करें और ID बैज बनाएं')}
        >
          {isSaving || isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {t('generating', 'Creating Badge... / बैज बन रहा है...')}
            </>
          ) : (
            <>
              <Save className="h-5 w-5" aria-hidden="true" />
              {t('generate_emergency_badge', 'Save & Generate Emergency ID Badge / सेव करें और ID बैज बनाएं')}
            </>
          )}
        </button>

        {/* Stylized ID Badge Display */}
        {qrDataUrl && (
          <section
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03]"
            aria-label={t('qr_code_section', 'Emergency ID Badge / आपातकालीन ID बैज')}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  {t('your_emergency_badge', 'Your Emergency ID Card / आपका आपातकालीन ID कार्ड')}
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  {displayMode === 'privacy'
                    ? '🔒 Privacy Protected: Numbers encoded inside QR code'
                    : '📋 Open Badge: Numbers printed directly on card'}
                </p>
              </div>
              <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                TACTICAL BLUE
              </span>
            </div>

            <div className="flex flex-col items-center p-4">
              {/* Badge Preview Container */}
              <div className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border-2 border-blue-500/30 shadow-2xl shadow-blue-950/50">
                <img
                  src={qrDataUrl}
                  alt={t('emergency_badge_alt', 'Emergency ID Badge / आपातकालीन ID बैज')}
                  className="h-auto w-full rounded-xl"
                  width={540}
                  height={860}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600/30 border border-blue-500/40 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600/50 active:scale-[0.98]"
                  aria-label={t('download_badge_png', 'Download ID Badge (PNG) / ID बैज डाउनलोड करें')}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t('download_badge_png', 'Download ID Badge (PNG) / ID बैज डाउनलोड करें')}
                </button>
              </div>

              {/* WHY SCAN & TRUST EXPLANATION */}
              <div className="mt-5 w-full space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <HelpCircle className="h-4 w-4" />
                  {t('why_scan_title', 'Why Bystanders & Responders Scan This / लोग इसे क्यों स्कैन और कॉल करेंगे')}
                </div>
                <ul className="space-y-2.5 text-xs leading-relaxed text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-400">📞</span>
                    <span>
                      <strong className="text-white">Instant 1-Tap Calling:</strong> In an accident or crisis, bystanders don&apos;t want to hand-type a 10-digit phone number. Scanning pops up an instant <strong>&quot;Call Family&quot;</strong> button on their phone.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-400">🔒</span>
                    <span>
                      <strong className="text-white">Protects Your Privacy on Lock Screen:</strong> In Privacy Mode, random strangers sitting next to you on a bus or metro cannot read your phone number or notes. Only someone scanning in an emergency sees them.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-300">🚨</span>
                    <span>
                      <strong className="text-white">Universal SOS Center Emblem:</strong> The prominent &quot;SOS&quot; emblem is universally recognized by police, paramedics, security guards, and civilians for any crisis (detention, accident, stalking, disaster).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400">📷</span>
                    <span>
                      <strong className="text-white">Scans on Any Phone:</strong> Uses QR Error Correction Level &apos;H&apos;. Works with standard iPhone Camera, Android Google Lens, Samsung Camera, and WhatsApp.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Lock screen Tip */}
              <div className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                <Smartphone className="h-5 w-5 flex-shrink-0 text-blue-400" />
                <p className="text-xs text-white/70">
                  <strong className="text-blue-400">Lock Screen Tip:</strong> Set this image as your{' '}
                  <span className="text-white font-medium">Phone Lock Screen Wallpaper</span>. If your phone is locked or snatched, any helper can point their camera to call your emergency contacts!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Instructions */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/70">
            {t('how_to_use', 'How to use / कैसे उपयोग करें')}
          </h3>
          <ol className="space-y-1.5 text-xs leading-relaxed text-white/50">
            <li>
              1. {t('step_1', 'Fill in your emergency details and contacts above / ऊपर अपनी आपातकालीन जानकारी भरें')}
            </li>
            <li>
              2. {t('step_2', 'Choose Privacy Mode (recommended for lockscreen) or Open Badge / मोड चुनें')}
            </li>
            <li>
              3. {t('step_3', 'Tap "Save & Generate Emergency ID Badge" / बैज बनाएं दबाएं')}
            </li>
            <li>
              4. {t('step_4', 'Download and set as Phone Lock Screen Wallpaper or print for wallet / डाउनलोड करके लॉक स्क्रीन पर लगाएं')}
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
