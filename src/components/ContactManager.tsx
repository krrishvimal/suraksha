'use client';

import { useState, useCallback } from 'react';
import { UserPlus, Trash2, AlertCircle, Phone, User } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface ContactManagerProps {
  contacts: Contact[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'name' | 'phone', value: string) => void;
  maxContacts: number;
}

function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Accept +91XXXXXXXXXX or 10-digit number
  if (/^\+91\d{10}$/.test(cleaned)) return true;
  if (/^\d{10}$/.test(cleaned)) return true;
  return false;
}

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (/^\d{10}$/.test(cleaned)) {
    return `+91-${cleaned}`;
  }
  return phone;
}

export function isValidContact(contact: Contact): boolean {
  return contact.name.trim().length > 0 && validatePhone(contact.phone);
}

export function getFormattedPhone(contact: Contact): string {
  const cleaned = contact.phone.replace(/[\s\-()]/g, '');
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^\+91\d{10}$/.test(cleaned)) return cleaned;
  return cleaned;
}

export default function ContactManager({
  contacts,
  onAdd,
  onRemove,
  onUpdate,
  maxContacts,
}: ContactManagerProps) {
  const { t } = useLanguage();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [phoneErrors, setPhoneErrors] = useState<Record<string, boolean>>({});

  const handlePhoneBlur = useCallback((id: string, value: string) => {
    if (value && !validatePhone(value)) {
      setPhoneErrors((prev) => ({ ...prev, [id]: true }));
    } else {
      setPhoneErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (deleteConfirmId === id) {
        onRemove(id);
        setDeleteConfirmId(null);
        setPhoneErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setDeleteConfirmId(id);
        // Auto-dismiss confirmation after 3 seconds
        setTimeout(() => {
          setDeleteConfirmId((current) => (current === id ? null : current));
        }, 3000);
      }
    },
    [deleteConfirmId, onRemove]
  );

  const isMaxReached = contacts.length >= maxContacts;

  return (
    <div className="space-y-3">
      {/* Contact list */}
      {contacts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <UserPlus className="mx-auto mb-3 h-10 w-10 text-white/30" aria-hidden="true" />
          <p className="text-sm text-white/50">
            {t('no_contacts_yet', 'No emergency contacts added yet / अभी तक कोई आपातकालीन संपर्क नहीं जोड़ा गया')}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {t('add_contact_prompt', 'Tap the button below to add your first contact / नीचे बटन दबाकर पहला संपर्क जोड़ें')}
          </p>
        </div>
      ) : (
        contacts.map((contact, index) => (
          <div
            key={contact.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white/40">
                {t('contact', 'Contact / संपर्क')} #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(contact.id)}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  deleteConfirmId === contact.id
                    ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50'
                    : 'text-white/40 hover:bg-red-500/10 hover:text-red-400'
                }`}
                aria-label={
                  deleteConfirmId === contact.id
                    ? t('confirm_delete', 'Confirm delete / हटाने की पुष्टि करें')
                    : t('delete_contact', 'Delete contact / संपर्क हटाएं')
                }
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {deleteConfirmId === contact.id
                  ? t('confirm_q', 'Confirm? / पुष्टि?')
                  : t('delete', 'Delete / हटाएं')}
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Name input */}
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => onUpdate(contact.id, 'name', e.target.value)}
                  placeholder={t('contact_name', 'Name / नाम')}
                  className="min-h-[48px] w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-base text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  aria-label={t('contact_name_label', 'Contact name / संपर्क का नाम')}
                  maxLength={50}
                />
              </div>

              {/* Phone input */}
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
                  aria-hidden="true"
                />
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => {
                    onUpdate(contact.id, 'phone', e.target.value);
                    if (phoneErrors[contact.id]) {
                      setPhoneErrors((prev) => {
                        const next = { ...prev };
                        delete next[contact.id];
                        return next;
                      });
                    }
                  }}
                  onBlur={(e) => handlePhoneBlur(contact.id, e.target.value)}
                  placeholder="+91-9876543210"
                  className={`min-h-[48px] w-full rounded-lg border bg-white/5 py-3 pl-10 pr-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-1 ${
                    phoneErrors[contact.id]
                      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50'
                      : 'border-white/10 focus:border-blue-500/50 focus:ring-blue-500/50'
                  }`}
                  aria-label={t('phone_label', 'Phone number / फ़ोन नंबर')}
                  aria-invalid={phoneErrors[contact.id] ? 'true' : 'false'}
                  maxLength={15}
                />
                {phoneErrors[contact.id] && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-400" role="alert">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span>
                      {t('invalid_phone', 'Enter valid 10-digit number or +91-XXXXXXXXXX / सही 10-अंकीय नंबर या +91-XXXXXXXXXX दर्ज करें')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={onAdd}
        disabled={isMaxReached}
        className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-medium transition-colors ${
          isMaxReached
            ? 'cursor-not-allowed border-white/5 text-white/20'
            : 'border-white/20 text-white/60 hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-400 active:bg-blue-500/10'
        }`}
        aria-label={t('add_contact_btn', 'Add emergency contact / आपातकालीन संपर्क जोड़ें')}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {isMaxReached
          ? t('max_contacts_reached', `Maximum ${maxContacts} contacts / अधिकतम ${maxContacts} संपर्क`)
          : t('add_contact', '+ Add Contact / + संपर्क जोड़ें')}
      </button>
    </div>
  );
}
