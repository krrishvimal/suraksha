'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode,
  Save,
  Download,
  Heart,
  Droplets,
  Phone,
  AlertTriangle,
  Stethoscope,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Smartphone,
  Eye,
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
  medicalConditions: string;
}

const EMPTY_CARD: EmergencyCardData = {
  name: '',
  bloodGroup: '',
  emergencyContacts: [''],
  allergies: '',
  medicalConditions: '',
};

const MAX_EMERGENCY_CONTACTS = 2;

type CardTheme = 'medical' | 'dark';

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
  const [cardTheme, setCardTheme] = useState<CardTheme>('medical');
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

  // Renders complete high-visibility Emergency Medical ID Badge on HTML5 Canvas
  const generateQRBadge = useCallback(
    async (data: EmergencyCardData, theme: CardTheme = cardTheme) => {
      setIsGenerating(true);
      setError(null);
      try {
        const QRCode = (await import('qrcode')).default;

        // Build clean human-readable emergency text payload
        const filteredContacts = data.emergencyContacts.filter((c) => c.trim().length > 0);
        const contactsText = filteredContacts.length > 0 ? filteredContacts.join(', ') : 'None';

        const qrPayload = [
          '🚨 EMERGENCY MEDICAL ID | आपातकालीन चिकित्सा पहचान',
          `👤 Name: ${data.name.trim() || 'Not specified'}`,
          `🩸 Blood Group: ${data.bloodGroup || 'Not specified'}`,
          `📞 Emergency Contact: ${contactsText}`,
          `⚠️ Allergies: ${data.allergies.trim() || 'None'}`,
          `🏥 Medical Conditions: ${data.medicalConditions.trim() || 'None'}`,
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

        const isDark = theme === 'dark';

        // 1. Badge Background & Outer Border
        ctx.fillStyle = isDark ? '#0F172A' : '#F8FAFC';
        drawRoundRect(ctx, 2, 2, 536, 856, 28);
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
        ctx.stroke();

        // 2. Top Emergency Header Banner
        ctx.save();
        drawRoundRect(ctx, 4, 4, 532, 122, 24);
        ctx.clip();

        const bannerGrad = ctx.createLinearGradient(0, 0, 540, 120);
        if (isDark) {
          bannerGrad.addColorStop(0, '#991B1B');
          bannerGrad.addColorStop(1, '#7F1D1D');
        } else {
          bannerGrad.addColorStop(0, '#DC2626');
          bannerGrad.addColorStop(1, '#B91C1C');
        }
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, 0, 540, 126);

        // Header White Medical Cross Emblem Badge
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(52, 63, 24, 0, Math.PI * 2);
        ctx.fill();

        // Red cross inside header emblem
        ctx.fillStyle = '#DC2626';
        // Vertical bar
        ctx.fillRect(48, 48, 8, 30);
        // Horizontal bar
        ctx.fillRect(37, 59, 30, 8);

        // Header Typography
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.fillText('EMERGENCY MEDICAL ID', 92, 50);

        ctx.fillStyle = '#FEE2E2';
        ctx.font = '500 13px system-ui, -apple-system, sans-serif';
        ctx.fillText('आपातकालीन चिकित्सा पहचान कार्ड', 92, 72);

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('⚡ SCAN WITH ANY CAMERA • NO APP NEEDED', 92, 95);
        ctx.restore();

        // 3. Central QR Code Container
        const qrBoxX = 110;
        const qrBoxY = 142;
        const qrBoxSize = 320;

        // Container card with crisp rounded border & shadow
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = isDark ? '#475569' : '#CBD5E1';
        ctx.stroke();

        // Draw the QR Code image (280x280 centered in the 320x320 box)
        ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, 280, 280);

        // 4. Center Medical Cross Emblem (Overlayed right on the QR center!)
        const centerEmblemX = 270;
        const centerEmblemY = qrBoxY + 160;
        const emblemSize = 60;

        // White badge with crimson border
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(
          ctx,
          centerEmblemX - emblemSize / 2,
          centerEmblemY - emblemSize / 2,
          emblemSize,
          emblemSize,
          14
        );
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#DC2626';
        ctx.stroke();

        // Red Cross inside emblem
        ctx.fillStyle = '#DC2626';
        // Vertical bar
        ctx.fillRect(centerEmblemX - 5, centerEmblemY - 20, 10, 40);
        // Horizontal bar
        ctx.fillRect(centerEmblemX - 20, centerEmblemY - 5, 40, 10);

        // Subtext under QR
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 100% OFFLINE SECURE • NO INTERNET NEEDED TO SCAN', 270, 482);
        ctx.textAlign = 'left';

        // 5. Patient Vital Details Card
        const infoCardY = 502;
        ctx.fillStyle = isDark ? '#1E293B' : '#FFFFFF';
        drawRoundRect(ctx, 24, infoCardY, 492, 252, 18);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
        ctx.stroke();

        // Row 1: Name & Blood Group Pill
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('NAME / पूरा नाम:', 44, infoCardY + 28);

        const displayName = data.name.trim() || 'NOT SPECIFIED';
        ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        const truncatedName = displayName.length > 20 ? displayName.slice(0, 18) + '...' : displayName;
        ctx.fillText(truncatedName, 44, infoCardY + 54);

        // Blood Group Pill (Top Right)
        if (data.bloodGroup) {
          const pillX = 370;
          const pillY = infoCardY + 24;
          ctx.fillStyle = isDark ? '#450A0A' : '#FEF2F2';
          drawRoundRect(ctx, pillX, pillY, 126, 36, 18);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#EF4444';
          ctx.stroke();

          ctx.fillStyle = '#DC2626';
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🩸 ${data.bloodGroup}`, pillX + 63, pillY + 23);
          ctx.textAlign = 'left';
        }

        // Divider
        ctx.strokeStyle = isDark ? '#334155' : '#F1F5F9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44, infoCardY + 74);
        ctx.lineTo(496, infoCardY + 74);
        ctx.stroke();

        // Row 2: Emergency Contacts
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('EMERGENCY CONTACTS / आपातकालीन संपर्क:', 44, infoCardY + 98);

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        ctx.fillText(`📞 ${contactsText}`, 44, infoCardY + 120);

        // Row 3: Allergies
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('ALLERGIES / एलर्जी:', 44, infoCardY + 146);

        const allergiesVal = data.allergies.trim() || 'None reported / कोई नहीं';
        ctx.fillStyle = '#D97706';
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillText(
          allergiesVal.length > 44 ? allergiesVal.slice(0, 42) + '...' : allergiesVal,
          44,
          infoCardY + 166
        );

        // Row 4: Medical Conditions
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText('MEDICAL CONDITIONS / चिकित्सा स्थितियां:', 44, infoCardY + 192);

        const conditionsVal = data.medicalConditions.trim() || 'None reported / कोई नहीं';
        ctx.fillStyle = '#7C3AED';
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillText(
          conditionsVal.length > 44 ? conditionsVal.slice(0, 42) + '...' : conditionsVal,
          44,
          infoCardY + 212
        );

        // Row 5: Action instruction
        ctx.fillStyle = isDark ? '#64748B' : '#94A3B8';
        ctx.font = '500 10px system-ui, -apple-system, sans-serif';
        ctx.fillText('In case of accident or emergency, call contacts above immediately.', 44, infoCardY + 234);

        // 6. National Helplines Bar
        const helplineY = 768;
        ctx.fillStyle = isDark ? '#1C1917' : '#FEF2F2';
        drawRoundRect(ctx, 24, helplineY, 492, 42, 10);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = isDark ? '#7F1D1D' : '#FCA5A5';
        ctx.stroke();

        ctx.fillStyle = '#DC2626';
        ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚨 NATIONAL HELPLINES: Police 112 • Ambulance 108 • Women 1091', 270, helplineY + 26);

        // 7. Watermark / Footer
        ctx.fillStyle = isDark ? '#64748B' : '#94A3B8';
        ctx.font = '500 10.5px system-ui, -apple-system, sans-serif';
        ctx.fillText('🛡️ Suraksha Safety • Free Open-Source Emergency Tool • Keep on Phone Lock Screen', 270, 834);
        ctx.textAlign = 'left';

        // Export as High-Resolution PNG
        const finalDataUrl = canvas.toDataURL('image/png');
        setQrDataUrl(finalDataUrl);
      } catch (err) {
        console.error('QR ID Badge generation failed:', err);
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
    [cardTheme, t]
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

      // Generate Stylized Badge
      await generateQRBadge(formData, cardTheme);

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
  }, [formData, cardTheme, generateQRBadge, t]);

  const handleThemeChange = useCallback(
    async (newTheme: CardTheme) => {
      setCardTheme(newTheme);
      if (formData.name.trim()) {
        await generateQRBadge(formData, newTheme);
      }
    },
    [formData, generateQRBadge]
  );

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    try {
      const link = document.createElement('a');
      link.download = `suraksha-medical-id-${formData.name.trim().replace(/\s+/g, '-').toLowerCase() || 'card'}.png`;
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
            <QrCode className="h-6 w-6 text-red-500" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t('emergency_qr_card', 'Emergency Medical ID Badge / आपातकालीन मेडिकल ID बैज')}
              </h1>
              <p className="text-xs text-white/40">
                {t('qr_subtitle', 'Hospital-grade scannable emergency ID card / अस्पताल-ग्रेड आपातकालीन ID कार्ड')}
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
            {t('saved_successfully', 'Medical ID Badge generated! / मेडिकल ID बैज बन गया!')}
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
              <Heart className="h-4 w-4 text-pink-400" aria-hidden="true" />
              {t('full_name', 'Full Name / पूरा नाम')}
              <span className="text-red-400">*</span>
            </label>
            <input
              id="qr-name"
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('enter_name', 'Enter your full name / अपना पूरा नाम दर्ज करें')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
              maxLength={60}
              required
              aria-required="true"
            />
          </div>

          {/* Blood Group */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-blood-group"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <Droplets className="h-4 w-4 text-red-400" aria-hidden="true" />
              {t('blood_group', 'Blood Group / रक्त समूह')}
            </label>
            <select
              id="qr-blood-group"
              value={formData.bloodGroup}
              onChange={(e) => updateField('bloodGroup', e.target.value as BloodGroup)}
              className="min-h-[48px] w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
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
                    className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
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
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 py-2.5 text-xs text-white/50 transition-colors hover:border-red-500/40 hover:text-red-400"
                  aria-label={t('add_contact_btn', 'Add emergency contact / आपातकालीन संपर्क जोड़ें')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('add_contact_short', 'Add Contact / संपर्क जोड़ें')}
                </button>
              )}
            </div>
          </div>

          {/* Allergies */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-allergies"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
              {t('allergies', 'Allergies / एलर्जी')}
            </label>
            <input
              id="qr-allergies"
              type="text"
              value={formData.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              placeholder={t('allergies_placeholder', 'e.g., Penicillin, Peanuts, Pollen / जैसे, पेनिसिलिन, मूंगफली')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
              maxLength={100}
            />
          </div>

          {/* Medical Conditions */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label
              htmlFor="qr-medical"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <Stethoscope className="h-4 w-4 text-purple-400" aria-hidden="true" />
              {t('medical_conditions', 'Medical Conditions / चिकित्सा स्थितियां')}
            </label>
            <input
              id="qr-medical"
              type="text"
              value={formData.medicalConditions}
              onChange={(e) => updateField('medicalConditions', e.target.value)}
              placeholder={t('medical_placeholder', 'e.g., Asthma, Diabetes, Heart condition / जैसे, दमा, मधुमेह')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
              maxLength={100}
            />
          </div>

          {/* Badge Theme Chooser */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="mb-2.5 flex items-center gap-2 text-sm font-medium text-white/70">
              <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
              {t('badge_theme', 'Badge Style / बैज का डिज़ाइन')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleThemeChange('medical')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-all ${
                  cardTheme === 'medical'
                    ? 'border-red-500 bg-red-500/20 text-white shadow-sm'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                🏥 {t('theme_medical', 'Medical Red / आपातकालीन लाल')}
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-all ${
                  cardTheme === 'dark'
                    ? 'border-slate-400 bg-slate-800 text-white shadow-sm'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                🛡️ {t('theme_dark', 'Dark Tactical / डार्क शील्ड')}
              </button>
            </div>
          </div>
        </section>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isGenerating}
          className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-red-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('generate_medical_badge', 'Save & Generate Medical Badge / सेव करें और मेडिकल बैज बनाएं')}
        >
          {isSaving || isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {t('generating', 'Creating Badge... / बैज बन रहा है...')}
            </>
          ) : (
            <>
              <Save className="h-5 w-5" aria-hidden="true" />
              {t('generate_medical_badge', 'Save & Generate Medical ID Badge / सेव करें और मेडिकल ID बनाएं')}
            </>
          )}
        </button>

        {/* Stylized ID Badge Display */}
        {qrDataUrl && (
          <section
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03]"
            aria-label={t('qr_code_section', 'Medical ID Badge / मेडिकल ID बैज')}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-red-500" aria-hidden="true" />
                  {t('your_emergency_badge', 'Your Emergency Medical Badge / आपका मेडिकल ID बैज')}
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  {t('badge_subtitle', 'Print for wallet or save as lock screen wallpaper / बटुए में रखें या लॉक स्क्रीन पर लगाएं')}
                </p>
              </div>
              <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-400">
                100% OFFLINE
              </span>
            </div>

            <div className="flex flex-col items-center p-4">
              {/* Badge Preview Container */}
              <div className="relative w-full max-w-[340px] overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl shadow-red-950/40">
                <img
                  src={qrDataUrl}
                  alt={t('emergency_badge_alt', 'Emergency Medical ID Badge / आपातकालीन मेडिकल ID बैज')}
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
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-[0.98]"
                  aria-label={t('download_badge_png', 'Download Badge Image (PNG) / बैज डाउनलोड करें')}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t('download_badge_png', 'Download ID Badge (PNG) / ID बैज डाउनलोड करें')}
                </button>
              </div>

              {/* Trust & Recognition Explanation */}
              <div className="mt-5 w-full space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
                  <HelpCircle className="h-4 w-4" />
                  {t('why_trust_title', 'Why First Responders Trust This Badge / लोग इसे क्यों पहचानेंगे और विश्वास करेंगे')}
                </div>
                <ul className="space-y-2 text-xs leading-relaxed text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-400">✚</span>
                    <span>
                      <strong className="text-white">Universal Red Cross Emblem:</strong> The embedded medical cross tells paramedics, police, and bystanders immediately that this is an emergency medical card, not an ad or payment code.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-400">👁️</span>
                    <span>
                      <strong className="text-white">Instant Visual Triage:</strong> Name, Blood Group (🩸), and Emergency Contacts are legible directly on the card even if nobody scans it.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-400">📷</span>
                    <span>
                      <strong className="text-white">Scannable by Any Camera:</strong> Built with QR Error Correction &apos;H&apos; (30% tolerance). Scans instantly in iOS Camera, Google Lens, Samsung Camera, and WhatsApp.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-purple-400">🔒</span>
                    <span>
                      <strong className="text-white">100% Offline Plain Text:</strong> Contains no shady web links. Scanning reveals pure emergency contact information right on the scanner screen.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Lock screen Tip */}
              <div className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                <Smartphone className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                <p className="text-xs text-white/70">
                  <strong className="text-emerald-400">Lifesaver Tip:</strong> Set this badge as your{' '}
                  <span className="text-white font-medium">Phone Lock Screen Wallpaper</span> so emergency personnel can see your blood group and call your family even if your phone is locked!
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
              1. {t('step_1', 'Fill in your emergency medical information above / ऊपर अपनी आपातकालीन जानकारी भरें')}
            </li>
            <li>
              2. {t('step_2', 'Tap "Save & Generate Medical ID Badge" to render your card / बैज बनाएं दबाएं')}
            </li>
            <li>
              3. {t('step_3', 'Download and set as your phone lock screen or print for wallet / डाउनलोड करके लॉक स्क्रीन पर लगाएं')}
            </li>
            <li>
              4. {t('step_4', 'Keep a copy in your purse, wallet, or backpack / अपने पर्स या बैग में एक कॉपी रखें')}
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
