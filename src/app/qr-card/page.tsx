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

export default function QRCardPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<EmergencyCardData>(EMPTY_CARD);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

  const generateQR = useCallback(async (data: EmergencyCardData) => {
    setIsGenerating(true);
    setError(null);
    try {
      const QRCode = (await import('qrcode')).default;

      // Build clean human-readable emergency text payload
      const filteredContacts = data.emergencyContacts.filter((c) => c.trim().length > 0);
      const contactsText = filteredContacts.length > 0 ? filteredContacts.join(', ') : 'None';

      const qrPayload = [
        '🚨 EMERGENCY ID | आपातकालीन पहचान',
        `👤 Name: ${data.name.trim()}`,
        `🩸 Blood Group: ${data.bloodGroup || 'Not specified'}`,
        `📞 Emergency Contact: ${contactsText}`,
        `⚠️ Allergies: ${data.allergies.trim() || 'None'}`,
        `🏥 Medical Conditions: ${data.medicalConditions.trim() || 'None'}`,
        '— Suraksha Safety App'
      ].join('\n');

      const url = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0A0A0A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });

      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation failed:', err);
      setError(
        t(
          'qr_gen_failed',
          'Failed to generate QR code. Please try again. / QR कोड बनाने में विफल। कृपया पुनः प्रयास करें।'
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }, [t]);

  const handleSave = useCallback(async () => {
    // Validate
    if (!formData.name.trim()) {
      setError(
        t('name_required', 'Name is required / नाम आवश्यक है')
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save to localStorage
      setItem(StorageKeys.EMERGENCY_CARD, formData);

      // Generate QR
      await generateQR(formData);

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
  }, [formData, generateQR, t]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    try {
      const link = document.createElement('a');
      link.download = `suraksha-emergency-qr-${formData.name.trim().replace(/\s+/g, '-').toLowerCase() || 'card'}.png`;
      link.href = qrDataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      setError(
        t(
          'download_failed',
          'Download failed. Try long-pressing the QR image to save. / डाउनलोड विफल। QR छवि को लंबे दबाकर सेव करें।'
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
            <QrCode className="h-6 w-6 text-emerald-400" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t('emergency_qr_card', 'Emergency QR Card / आपातकालीन QR कार्ड')}
              </h1>
              <p className="text-xs text-white/40">
                {t('qr_subtitle', 'Your medical info in a scannable code / आपकी चिकित्सा जानकारी एक स्कैन योग्य कोड में')}
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
            {t('saved_successfully', 'Saved & QR generated! / सेव हो गया और QR बन गया!')}
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
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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

          {/* Emergency Contacts */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
              <Phone className="h-4 w-4 text-blue-400" aria-hidden="true" />
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
              placeholder={t('allergies_placeholder', 'e.g., Penicillin, Peanuts / जैसे, पेनिसिलिन, मूंगफली')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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
              placeholder={t('medical_placeholder', 'e.g., Diabetes, Asthma / जैसे, मधुमेह, दमा')}
              className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              maxLength={100}
            />
          </div>
        </section>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isGenerating}
          className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('save_generate_qr', 'Save & Generate QR / सेव करें और QR बनाएं')}
        >
          {isSaving || isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {t('generating', 'Generating... / बन रहा है...')}
            </>
          ) : (
            <>
              <Save className="h-5 w-5" aria-hidden="true" />
              {t('save_generate_qr', 'Save & Generate QR / सेव करें और QR बनाएं')}
            </>
          )}
        </button>

        {/* QR Code Display */}
        {qrDataUrl && (
          <section
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03]"
            aria-label={t('qr_code_section', 'QR Code / QR कोड')}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <QrCode className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                {t('your_emergency_qr', 'Your Emergency QR / आपका आपातकालीन QR')}
              </h2>
              <p className="mt-0.5 text-xs text-white/40">
                {t('qr_scan_info', 'Anyone can scan this to see your emergency info / कोई भी इसे स्कैन करके आपकी आपातकालीन जानकारी देख सकता है')}
              </p>
            </div>

            <div className="flex flex-col items-center p-6">
              {/* QR Image with clean white card for maximum scanner compatibility */}
              <div className="rounded-2xl border-4 border-emerald-500/30 bg-white p-3 shadow-2xl shadow-emerald-500/10">
                <img
                  src={qrDataUrl}
                  alt={t('emergency_qr_code', 'Emergency QR Code / आपातकालीन QR कोड')}
                  className="h-[240px] w-[240px] rounded-lg"
                  width={240}
                  height={240}
                />
              </div>

              {/* Card info preview */}
              <div className="mt-4 w-full space-y-2 rounded-xl bg-white/5 p-3.5 border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">{t('name_label', 'Name / नाम')}</span>
                  <span className="font-semibold text-white/90">{formData.name}</span>
                </div>
                {formData.bloodGroup && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{t('blood_label', 'Blood / रक्त')}</span>
                    <span className="rounded bg-red-500/20 px-2 py-0.5 font-bold text-red-400">
                      {formData.bloodGroup}
                    </span>
                  </div>
                )}
                {formData.emergencyContacts.some((c) => c.trim()) && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{t('emergency_contacts', 'Contacts / संपर्क')}</span>
                    <span className="font-mono text-emerald-400">
                      {formData.emergencyContacts.filter((c) => c.trim()).join(', ')}
                    </span>
                  </div>
                )}
                {formData.allergies && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{t('allergies_label', 'Allergies / एलर्जी')}</span>
                    <span className="text-amber-400/90">{formData.allergies}</span>
                  </div>
                )}
                {formData.medicalConditions && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{t('medical_conditions', 'Conditions / स्थितियां')}</span>
                    <span className="text-purple-400/90">{formData.medicalConditions}</span>
                  </div>
                )}
              </div>

              {/* Download button */}
              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.98]"
                aria-label={t('download_qr', 'Download QR Code / QR कोड डाउनलोड करें')}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t('download_qr_png', 'Download QR as PNG / QR को PNG के रूप में डाउनलोड करें')}
              </button>
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
              1. {t('step_1', 'Fill in your emergency information above / ऊपर अपनी आपातकालीन जानकारी भरें')}
            </li>
            <li>
              2. {t('step_2', 'Tap "Save & Generate QR" to create your card / "सेव करें और QR बनाएं" दबाकर कार्ड बनाएं')}
            </li>
            <li>
              3. {t('step_3', 'Download and print the QR code / QR कोड डाउनलोड करें और प्रिंट करें')}
            </li>
            <li>
              4. {t('step_4', 'Keep it in your wallet or on your phone case / इसे अपने बटुए या फ़ोन केस पर रखें')}
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
