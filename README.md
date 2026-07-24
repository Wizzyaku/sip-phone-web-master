# Phonicity — Cloud Telephony Platform

A Vite React web app with browser-based SIP calling (via SIP.js and Telnyx WebRTC) and carrier SMS (via Telnyx and Vercel serverless functions).

## What was built

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **SIP calls**: SIP.js running in the browser, connecting to Telnyx WebRTC over WebSocket (`wss://rtc.telnyx.com:443`)
- **SMS**: Telnyx Messaging API via Vercel serverless functions (`/api/send-sms`, `/api/messages`, `/api/sms-webhook`)

## Prerequisites

- Node.js 18+
- A Telnyx account with a phone number that supports SMS and voice
- A Telnyx SIP connection or credential configured for WebRTC calling

## Local development

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Telnyx credentials in `.env`:
   - `TELNYX_API_KEY`
   - `TELNYX_PHONE_NUMBER`
   - `TELNYX_SIP_USERNAME`
   - `TELNYX_SIP_PASSWORD`
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Vite dev server:
   ```bash
   npm run dev
   ```
5. For local serverless functions, install the Vercel CLI and run:
   ```bash
   vercel dev
   ```

## Deploy to Vercel (free Hobby tier)

1. Install the Vercel CLI and log in:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Deploy:
   ```bash
   vercel --prod
   ```
3. In the Vercel dashboard, add these environment variables:
   - `TELNYX_API_KEY`
   - `TELNYX_PHONE_NUMBER`
   - `TELNYX_SIP_USERNAME` (used in the frontend registration form, can be set as a VITE-prefixed variable if desired)
   - `TELNYX_SIP_PASSWORD` (used in the frontend registration form, can be set as a VITE-prefixed variable if desired)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` — your Resend.com API key for sending OTP emails
   - `RESEND_FROM_EMAIL` — sender email address (e.g. `noreply@phonicity.com`, must be verified in Resend)
4. In the Telnyx Mission Control portal, set the SMS webhook URL for your messaging profile to:
   ```
   https://your-app.vercel.app/api/sms-webhook
   ```

## Important notes

- SIP calls require a secure context (HTTPS or localhost) for WebRTC microphone access.
- Telnyx credentials must stay server-side. Never commit them to the frontend `.env`.
- The demo uses in-memory storage for SMS messages. For production, replace it with Vercel KV, Postgres, or another database.
- Outbound calls are normalized to `sip:+E164@sip.telnyx.com` if a plain E.164 number is entered.

## OTP / Email verification setup

The app uses [Resend](https://resend.com) to send 6-digit verification codes for:
- **Signup**: User enters name/email/password → receives 6-digit code → verifies to create account
- **Password reset**: User enters email → receives 6-digit code → enters new password to reset

### Database table

Create the `otp_codes` table in Supabase SQL Editor:

```sql
CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'signup',
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_purpose ON otp_codes(purpose);
```

### Message read status table

Run this in the Supabase SQL editor to enable persistent read state for messages:

```sql
CREATE TABLE IF NOT EXISTS message_read_status (
  user_id uuid NOT NULL,
  message_sid text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_sid)
);

ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own read status" ON message_read_status
  FOR SELECT USING (auth.uid() = user_id);
```

### Support tickets tables

Run this in the Supabase SQL editor to enable the support ticket system:

```sql
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all tickets" ON public.support_tickets
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Admins can update all tickets" ON public.support_tickets
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_role text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read replies on own tickets" ON public.support_ticket_replies
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can insert replies on own tickets" ON public.support_ticket_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Admins can read all ticket replies" ON public.support_ticket_replies
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Admins can insert ticket replies" ON public.support_ticket_replies
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
```

### Environment variables

- `RESEND_API_KEY` — Get from [resend.com/api-keys](https://resend.com/api-keys)
- `RESEND_FROM_EMAIL` — Sender address (must be a verified domain in Resend, e.g. `noreply@phonicity.com`)
