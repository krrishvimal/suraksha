# 🛡️ Suraksha (सुरक्षा) — Personal Safety Tool

> **100% Private. No Signup Required. Works Offline.**  
> A privacy-first progressive web application (PWA) designed for personal safety, solo travelers, students, late-night commuters, and families.

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)](https://supabase.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-22C55E)](#pwa--offline-capability)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Why Suraksha?

Most emergency and safety apps require full names, phone numbers, location history, and account passwords stored on centralized cloud servers. In the event of a data breach, server seizure, or privacy violation, this sensitive data can be weaponized or leaked.

**Suraksha takes an uncompromising zero-PII (Personally Identifiable Information) approach**:
- **No Signup or Login**: Never asks for email, password, or account creation.
- **Client-Side Storage**: Your name, medical history, emergency contacts, and blood group **never leave your phone**.
- **Works Offline**: The app, emergency badge generator, and SOS templates run directly inside your browser cache.
- **WhatsApp/SMS Native**: Messages are dispatched directly via your phone's native apps — zero intermediary servers.
- **Self-Destructing Check-Ins**: Safety sessions automatically expire and wipe after 24 hours.

---

## 🚀 3 Core Modules

### 1. 🪪 Emergency QR ID Card (`/qr-card`)
- **Lock Screen Emergency Badge**: Creates a high-contrast Tactical Blue badge to set as your phone's lock screen wallpaper or print for your wallet.
- **Privacy Masking Mode**: Keeps sensitive phone numbers protected inside the QR code so casual onlookers on metros or buses cannot see your contact info.
- **1-Tap Bystander Scanning**: In an accident or medical emergency, bystanders or first responders simply scan the QR code to call your emergency contacts immediately — **even if your phone is locked or damaged**.
- **Zero Server Upload**: 100% generated on an HTML5 canvas and stored only in your browser's local storage.

### 2. ⏱️ Safety Check-In & Dead Man's Switch (`/check-in`)
- **Anonymous Session**: Set a 4-digit PIN to generate a unique tracking link to share with family or trusted friends via WhatsApp.
- **Live Countdown Timer**: Choose a safety interval (e.g. 15, 30, or 60 minutes) during a cab ride, walk home, or high-risk journey.
- **Dead Man's Switch**: If you fail to tap the green **"I'm Safe"** button before the timer runs out, your shared tracking page turns red, triggers an emergency siren alert, and displays your last known GPS coordinates.
- **Auto GPS Breadcrumbs**: Periodically records background GPS breadcrumbs without requiring you to keep opening the app.
- **Server Clock Drift Sync**: Uses millisecond-accurate server time offset compensation to ensure timers remain synchronized across devices.

### 3. 🚨 One-Tap SOS Messages (`/sos`)
- **Instant Situational Alerts**: 5 quick-dispatch templates:
  - 🚨 **Need Help**: Urgent distress message with Google Maps coordinates.
  - 🔒 **Detained**: Instant alert indicating detention or emergency custody.
  - 🏥 **Medical Emergency**: Automatically attaches blood group and allergies from your ID Card.
  - 📍 **Share Location**: Clean GPS pin broadcast.
  - ✅ **I'm Safe**: Quick reassurance message.
- **Direct Dispatch**: Opens WhatsApp or SMS with pre-filled message in under 3 seconds.
- **Zero Server Routing**: Messages go directly from your phone to your carrier or WhatsApp end-to-end encrypted protocol.

---

## 🔒 Privacy & Threat Model

| Data Item | Stored On Device (`localStorage`) | Stored On Server (`Supabase`) |
|---|:---:|:---:|
| User's Name | ✅ Yes | ❌ **Never** |
| Emergency Contact Numbers | ✅ Yes | ❌ **Never** |
| Blood Group & Medical Conditions | ✅ Yes | ❌ **Never** |
| Random Session UUID | ✅ Yes | ✅ Yes (Anonymous key) |
| 4-Digit Passcode | Plaintext (in browser) | **bcrypt hash** (irreversible) |
| Current Safety Status | Cached | `safe` / `need_help` / `active` |
| Status Expiry Timestamp | Cached | Auto-deletes in 24 hours |

Even if the database or hosting account were subpoenaed or seized, it contains **zero names, zero phone numbers, and zero identities**.

---

## 🌐 Bilingual Support (English + हिन्दी)

Suraksha features full native bilingual localization:
- Toggle between **English** and **हिन्दी (Hindi)** with a single tap in the header.
- Every button, warning banner, countdown, and guide is translated.
- Language preference is automatically remembered on your device.

---

## 📱 PWA & Offline Capability

Suraksha includes:
- Web App Manifest (`manifest.json`) for **"Add to Home Screen"** installation on Android (Chrome), iOS (Safari), and desktop.
- Service Worker (`sw.js`) that caches core UI assets, pages, and icons.
- If you lose cell service in a basement, elevator, or during an internet shutdown, your Emergency ID Card and SOS templates remain fully accessible offline.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security)
- **Password Hashing**: `bcryptjs`
- **QR Engine**: `qrcode` (Client-side HTML5 canvas)
- **Hosting**: [Vercel](https://vercel.com/)

---

## ⚙️ Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/krrishvimal/suraksha.git
cd suraksha
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file in the project root:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only keys (never sent to client browser)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Database Setup (Supabase)

Create the `status_pages` table in your Supabase SQL editor:

```sql
CREATE TABLE status_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passcode_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'safe', 'need_help')),
  message TEXT DEFAULT '',
  location_link TEXT DEFAULT '',
  last_checkin_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);

-- Index for fast lookups
CREATE INDEX idx_status_pages_id ON status_pages(id);
CREATE INDEX idx_status_pages_expires ON status_pages(expires_at);

-- Row Level Security
ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view status pages"
  ON status_pages FOR SELECT USING (true);

CREATE POLICY "Anyone can create status pages"
  ON status_pages FOR INSERT WITH CHECK (true);

CREATE POLICY "Update via API only"
  ON status_pages FOR UPDATE USING (true);

CREATE POLICY "Delete via API only"
  ON status_pages FOR DELETE USING (true);
```

### 24-Hour Self-Destruct Cleanup (Optional `pg_cron`)
```sql
-- Schedule hourly purge of expired sessions
SELECT cron.schedule(
  'cleanup-expired-status-pages',
  '0 * * * *',
  $$DELETE FROM status_pages WHERE expires_at < now()$$
);
```

---

## 📄 License

This project is open-source and released under the [MIT License](LICENSE). Built with ❤️ for public safety and privacy.
