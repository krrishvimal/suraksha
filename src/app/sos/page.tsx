'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Siren,
  ArrowLeft,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Smartphone,
  Loader2,
  AlertTriangle,
  Heart,
  Lock,
  Hospital,
  CheckCircle,
  Send,
  X,
  Share2,
  PhoneCall,
  Copy,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getItem, setItem, StorageKeys } from '@/lib/storage';
import { getLocationLink } from '@/lib/geolocation';
import { MAX_CONTACTS } from '@/lib/constants';
import ContactManager, {
  type Contact,
  isValidContact,
  getFormattedPhone,
} from '@/components/ContactManager';
import FeatureGuide from '@/components/FeatureGuide';
import Link from 'next/link';

// ------- Types -------

type SOSType = 'safe' | 'help' | 'detained' | 'medical' | 'location';

interface SOSTemplate {
  type: SOSType;
  emoji: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

interface EmergencyCardData {
  name: string;
  bloodGroup: string;
  emergencyContacts: string[];
  allergies: string;
  medicalConditions: string;
}

interface SendModalState {
  isOpen: boolean;
  sosType: SOSType | null;
  message: string;
  locationFailed: boolean;
  isGettingLocation: boolean;
}

// ------- Constants -------

const SOS_TEMPLATES: SOSTemplate[] = [
  {
    type: 'safe',
    emoji: '✅',
    label: "I'm Safe / मैं सुरक्षित हूं",
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
    borderColor: 'border-emerald-500/30',
    icon: <CheckCircle className="h-6 w-6" aria-hidden="true" />,
  },
  {
    type: 'help',
    emoji: '🚨',
    label: 'Need Help / मदद चाहिए',
    color: 'text-red-400',
    bgColor: 'bg-red-600 hover:bg-red-500 active:bg-red-700',
    borderColor: 'border-red-500/30',
    icon: <Siren className="h-6 w-6" aria-hidden="true" />,
  },
  {
    type: 'detained',
    emoji: '🔒',
    label: 'Detained / हिरासत में',
    color: 'text-rose-400',
    bgColor: 'bg-rose-800 hover:bg-rose-700 active:bg-rose-900',
    borderColor: 'border-rose-500/30',
    icon: <Lock className="h-6 w-6" aria-hidden="true" />,
  },
  {
    type: 'medical',
    emoji: '🏥',
    label: 'Medical / चिकित्सा',
    color: 'text-orange-400',
    bgColor: 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700',
    borderColor: 'border-orange-500/30',
    icon: <Hospital className="h-6 w-6" aria-hidden="true" />,
  },
  {
    type: 'location',
    emoji: '📍',
    label: 'Share Location / स्थान साझा करें',
    color: 'text-blue-400',
    bgColor: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
    borderColor: 'border-blue-500/30',
    icon: <MapPin className="h-6 w-6" aria-hidden="true" />,
  },
];

// ------- Helpers -------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function triggerHaptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  } catch {
    // Haptic not available — silently ignore
  }
}

function buildMessage(
  type: SOSType,
  locationLink: string | null,
  cardData: EmergencyCardData | null
): string {
  const locStr = locationLink
    ? `\n📍 My location / मेरा स्थान: ${locationLink}`
    : '\n⚠️ Location unavailable / स्थान उपलब्ध नहीं';

  switch (type) {
    case 'safe':
      return `✅ I am SAFE. Don't worry.\nमैं सुरक्षित हूं। चिंता मत करो।${locStr}\n\n— Sent via Suraksha`;

    case 'help':
      return `🚨 EMERGENCY! I NEED HELP IMMEDIATELY!\n🚨 आपातकाल! मुझे तुरंत मदद चाहिए!\n\nPlease try to reach me or call emergency services.\nकृपया मुझसे संपर्क करें या आपातकालीन सेवाओं को कॉल करें।${locStr}\n\n— Sent via Suraksha`;

    case 'detained':
      return `🔒 URGENT: I have been DETAINED/STOPPED by authorities.\n🔒 ज़रूरी: मुझे अधिकारियों ने रोक लिया/हिरासत में लिया है।\n\nPlease note the time and my location. Contact a lawyer if I don't respond within 2 hours.\nकृपया समय और मेरा स्थान नोट करें। अगर मैं 2 घंटे में जवाब न दूं तो वकील से संपर्क करें।${locStr}\n\n— Sent via Suraksha`;

    case 'medical': {
      let medInfo = '';
      if (cardData) {
        const parts: string[] = [];
        if (cardData.bloodGroup) parts.push(`Blood Group / रक्त समूह: ${cardData.bloodGroup}`);
        if (cardData.allergies) parts.push(`Allergies / एलर्जी: ${cardData.allergies}`);
        if (cardData.medicalConditions)
          parts.push(`Conditions / स्थितियां: ${cardData.medicalConditions}`);
        if (parts.length > 0) medInfo = `\n\n🏥 Medical Info / चिकित्सा जानकारी:\n${parts.join('\n')}`;
      }
      return `🏥 MEDICAL EMERGENCY! I need medical help!\n🏥 चिकित्सा आपातकाल! मुझे चिकित्सा सहायता चाहिए!${medInfo}${locStr}\n\nPlease call an ambulance or rush to my location.\nकृपया एम्बुलेंस बुलाएं या मेरे स्थान पर आएं।\n\n— Sent via Suraksha`;
    }

    case 'location':
      return `📍 Here is my current location / यह मेरा वर्तमान स्थान है:${locStr}\n\n— Sent via Suraksha`;

    default:
      return `⚠️ SOS Alert${locStr}\n\n— Sent via Suraksha`;
  }
}

// ------- Component -------

export default function SOSPage() {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cardData, setCardData] = useState<EmergencyCardData | null>(null);
  const [modal, setModal] = useState<SendModalState>({
    isOpen: false,
    sosType: null,
    message: '',
    locationFailed: false,
    isGettingLocation: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Load contacts and card data on mount
  useEffect(() => {
    try {
      const savedContacts = getItem<Contact[]>(StorageKeys.SOS_CONTACTS);
      if (savedContacts && Array.isArray(savedContacts)) {
        setContacts(savedContacts);
      }
    } catch (err) {
      console.error('Failed to load SOS contacts:', err);
    }

    try {
      const saved = getItem<EmergencyCardData>(StorageKeys.EMERGENCY_CARD);
      if (saved) setCardData(saved);
    } catch (err) {
      console.error('Failed to load emergency card data:', err);
    }

    setIsLoaded(true);
  }, []);

  // Persist contacts on change
  useEffect(() => {
    if (isLoaded) {
      try {
        setItem(StorageKeys.SOS_CONTACTS, contacts);
      } catch (err) {
        console.error('Failed to save contacts:', err);
      }
    }
  }, [contacts, isLoaded]);

  // --- Contact handlers ---
  const handleAddContact = useCallback(() => {
    setContacts((prev) => {
      if (prev.length >= (MAX_CONTACTS ?? 5)) return prev;
      return [...prev, { id: generateId(), name: '', phone: '' }];
    });
  }, []);

  const handleRemoveContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleUpdateContact = useCallback(
    (id: string, field: 'name' | 'phone', value: string) => {
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  // --- SOS handlers ---
  const validContacts = contacts.filter(isValidContact);

  const handleSOSTap = useCallback(
    async (type: SOSType) => {
      triggerHaptic();

      setModal({
        isOpen: true,
        sosType: type,
        message: '',
        locationFailed: false,
        isGettingLocation: true,
      });

      let locationLink: string | null = null;
      let locFailed = false;

      try {
        locationLink = await getLocationLink();
      } catch (err) {
        console.warn('Location retrieval failed:', err);
        locFailed = true;
      }

      const message = buildMessage(type, locationLink, cardData);

      setModal((prev) => ({
        ...prev,
        message,
        locationFailed: locFailed,
        isGettingLocation: false,
      }));
    },
    [cardData]
  );

  const [hasCopied, setHasCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const closeModal = useCallback(() => {
    setModal({
      isOpen: false,
      sosType: null,
      message: '',
      locationFailed: false,
      isGettingLocation: false,
    });
    setHasCopied(false);
  }, []);

  const handleShareAll = useCallback(async () => {
    if (!modal.message) return;
    triggerHaptic();

    // Use Web Share API if available (bypasses browser popup blocker entirely)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '🚨 SURAKSHA SOS EMERGENCY / आपातकालीन',
          text: modal.message,
        });
        closeModal();
        return;
      } catch {
        // User dismissed share dialog or unsupported, fall through to direct WhatsApp
      }
    }

    // Direct WhatsApp fallback for contact #1
    if (validContacts.length > 0) {
      const phone = getFormattedPhone(validContacts[0]).replace('+', '');
      const encoded = encodeURIComponent(modal.message);
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
    }
  }, [modal.message, validContacts, closeModal]);

  const sendSingleWhatsApp = useCallback((contact: Contact) => {
    if (!modal.message) return;
    triggerHaptic();
    const phone = getFormattedPhone(contact).replace('+', '');
    const encoded = encodeURIComponent(modal.message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  }, [modal.message]);

  const callContact = useCallback((contact: Contact) => {
    triggerHaptic();
    window.location.href = `tel:${getFormattedPhone(contact)}`;
  }, []);

  const copyMessageText = useCallback(async () => {
    if (!modal.message) return;
    triggerHaptic();
    try {
      await navigator.clipboard.writeText(modal.message);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [modal.message]);

  const sendViaSMS = useCallback(() => {
    if (!modal.message) return;
    triggerHaptic();
    const phones = validContacts.map((c) => getFormattedPhone(c)).join(',');
    const encoded = encodeURIComponent(modal.message);
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const delimiter = isIOS ? '&' : '?';
    window.location.href = `sms:${phones}${delimiter}body=${encoded}`;
    closeModal();
  }, [modal.message, validContacts, closeModal]);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && modal.isOpen) closeModal();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal.isOpen, closeModal]);

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
            <Siren className="h-6 w-6 text-red-400" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t('sos_messages', 'SOS Messages / SOS संदेश')}
              </h1>
              <p className="text-xs text-white/40">
                {t('sos_subtitle', 'One-tap emergency alerts / एक टैप आपातकालीन अलर्ट')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-4">
        {/* Privacy notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-emerald-300/80">
            {t(
              'sos_privacy',
              'Messages are sent directly from your phone via WhatsApp/SMS. No data passes through our servers. / संदेश सीधे आपके फ़ोन से WhatsApp/SMS के ज़रिए भेजे जाते हैं। कोई डेटा हमारे सर्वर से नहीं गुज़रता।'
            )}
          </p>
        </div>

        {/* About & How to Use Guide at the Top */}
        <FeatureGuide
          title={t('guide_sos_title', 'About & How to Use / जानकारी और उपयोग विधि')}
          aboutText={t(
            'guide_sos_about',
            'One-Tap SOS lets you instantly broadcast emergency alert messages with your live GPS location to your trusted contacts via WhatsApp or SMS. It requires zero server setup, works directly through your phone\'s native messaging apps, and automatically attaches your medical/blood group info in medical emergencies.'
          )}
          steps={[
            {
              title: t('guide_sos_step1_title', 'Save Trusted Contacts / विश्वसनीय संपर्क जोड़ें'),
              desc: t(
                'guide_sos_step1_desc',
                'Add up to 5 emergency contacts (family, close friends, or local authorities) with their WhatsApp/phone numbers.'
              ),
            },
            {
              title: t('guide_sos_step2_title', 'Select Situation Alert / स्थिति चुनें'),
              desc: t(
                'guide_sos_step2_desc',
                'In an emergency, tap the relevant situation button (Need Help, Detained, Medical Emergency, Share Location, or I\'m Safe).'
              ),
            },
            {
              title: t('guide_sos_step3_title', 'Dispatch via WhatsApp or SMS / 1-टैप में भेजें'),
              desc: t(
                'guide_sos_step3_desc',
                'Your real-time GPS Google Maps pin is fetched and inserted into pre-formatted text. Tap WhatsApp or SMS to send instantly!'
              ),
            },
          ]}
          proTip={t(
            'guide_sos_tip',
            'Lifesaver Tip: Add emergency helpline numbers (e.g. 112, 1091 Women Helpline, or a local lawyer) as contacts if attending protests or travelling alone late at night.'
          )}
          accentColor="red"
          defaultExpanded={false}
        />

        {/* ===== CONTACTS SECTION ===== */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Heart className="h-4 w-4 text-pink-400" aria-hidden="true" />
            {t('emergency_contacts_title', 'Emergency Contacts / आपातकालीन संपर्क')}
            {validContacts.length > 0 && (
              <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                {validContacts.length} {t('ready', 'ready / तैयार')}
              </span>
            )}
          </h2>
          <ContactManager
            contacts={contacts}
            onAdd={handleAddContact}
            onRemove={handleRemoveContact}
            onUpdate={handleUpdateContact}
            maxContacts={MAX_CONTACTS ?? 5}
          />
        </section>

        {/* ===== SOS BUTTONS SECTION ===== */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Send className="h-4 w-4 text-red-400" aria-hidden="true" />
            {t('sos_buttons_title', 'Send SOS / SOS भेजें')}
          </h2>

          {validContacts.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400/60" aria-hidden="true" />
              <p className="text-sm font-medium text-amber-300/80">
                {t('add_contacts_first', 'Add contacts first to send SOS / SOS भेजने के लिए पहले संपर्क जोड़ें')}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {t('need_valid_contact', 'You need at least one contact with a valid name & phone number / आपको कम से कम एक संपर्क चाहिए जिसका नाम और फ़ोन नंबर सही हो')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {SOS_TEMPLATES.map((template) => (
                <button
                  key={template.type}
                  type="button"
                  onClick={() => handleSOSTap(template.type)}
                  className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-5 py-4 text-left font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${template.bgColor} ${template.borderColor}`}
                  aria-label={template.label}
                >
                  {template.icon}
                  <span className="flex-1 text-base">
                    {template.emoji}{' '}
                    {t(`sos_${template.type}`, template.label)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Medical info hint */}
        {!cardData && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <Hospital className="mx-auto mb-2 h-6 w-6 text-orange-400/50" aria-hidden="true" />
            <p className="text-xs text-white/40">
              {t(
                'setup_qr_hint',
                'Set up your QR Card to include medical info in SOS messages / अपना QR कार्ड सेट करें ताकि SOS संदेशों में चिकित्सा जानकारी शामिल हो'
              )}
            </p>
            <Link
              href="/qr-card"
              className="mt-2 inline-block rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-white/10"
            >
              {t('setup_qr_card', 'Set up QR Card / QR कार्ड सेट करें →')}
            </Link>
          </div>
        )}
      </div>

      {/* ===== SEND MODAL ===== */}
      {modal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('send_sos', 'Send SOS / SOS भेजें')}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg animate-in slide-in-from-bottom duration-300 rounded-t-2xl border-t border-white/10 bg-[#121212] p-5 pb-8 shadow-2xl"
          >
            {/* Modal header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {modal.sosType && (
                  <>
                    {SOS_TEMPLATES.find((s) => s.type === modal.sosType)?.emoji}{' '}
                    {t(
                      `sos_${modal.sosType}`,
                      SOS_TEMPLATES.find((s) => s.type === modal.sosType)?.label ?? 'SOS'
                    )}
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/40 hover:bg-white/10 hover:text-white"
                aria-label={t('close', 'Close / बंद करें')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Loading state */}
            {modal.isGettingLocation ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden="true" />
                <p className="mt-3 text-sm text-white/60">
                  {t('getting_location', 'Getting your location... / आपका स्थान प्राप्त हो रहा है...')}
                </p>
              </div>
            ) : (
              <>
                {/* Location warning */}
                {modal.locationFailed && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {t(
                      'location_failed',
                      'Could not get location. Message will be sent without it. / स्थान प्राप्त नहीं हो सका। संदेश बिना स्थान के भेजा जाएगा।'
                    )}
                  </div>
                )}

                {/* Message preview */}
                <div className="mb-4 max-h-[200px] overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-medium text-white/40 mb-1.5">
                    {t('message_preview', 'Message Preview / संदेश पूर्वावलोकन')}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {modal.message}
                  </p>
                </div>

                {/* Sending to info */}
                <p className="mb-3 text-xs text-white/40">
                  {t('sending_to', 'Sending to / भेजा जाएगा')}{' '}
                  <span className="font-medium text-white/60">
                    {validContacts.map((c) => c.name || c.phone).join(', ')}
                  </span>
                </p>

                {/* Primary Multi-Action Buttons */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleShareAll}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-[#25D366]/20 transition-all hover:bg-[#20bd5a] active:scale-[0.98]"
                    aria-label={t('send_whatsapp_share', 'Send via WhatsApp & Apps / WhatsApp व अन्य ऐप्स से भेजें')}
                  >
                    {canShare ? (
                      <Share2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    )}
                    {canShare
                      ? t('send_whatsapp_share', 'Share via WhatsApp & Apps / WhatsApp व ऐप्स से भेजें')
                      : t('send_via_whatsapp', 'Send via WhatsApp / WhatsApp से भेजें')}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={sendViaSMS}
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
                      aria-label={t('send_sms', 'Send via SMS / SMS से भेजें')}
                    >
                      <Smartphone className="h-4 w-4 text-blue-400" aria-hidden="true" />
                      {t('send_via_sms', 'Send via SMS / SMS')}
                    </button>

                    <button
                      type="button"
                      onClick={copyMessageText}
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
                    >
                      {hasCopied ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span className="text-emerald-400">{t('copied', 'Copied! / कॉपी हुआ')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 text-neutral-400" />
                          <span>{t('copy_text', 'Copy Text / कॉपी करें')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Per-Contact Instant Triggers (Bypasses all popup blockers) */}
                {validContacts.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
                      {t('direct_contact_triggers', 'Direct Emergency Actions / सीधे संपर्क करें')}:
                    </p>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {validContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 p-2 px-3"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-white truncate">
                              {contact.name || contact.phone}
                            </p>
                            <p className="text-[10px] text-white/40 font-mono">
                              {getFormattedPhone(contact)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => sendSingleWhatsApp(contact)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-[11px] font-bold hover:bg-[#25D366]/30 active:scale-95"
                              title="Send WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>WA</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => callContact(contact)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[11px] font-bold hover:bg-blue-500/30 active:scale-95"
                              title="Direct Phone Call"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                              <span>{t('call', 'Call / कॉल')}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
