# SIP Phone + SMS Web App

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
4. In the Telnyx Mission Control portal, set the SMS webhook URL for your messaging profile to:
   ```
   https://your-app.vercel.app/api/sms-webhook
   ```

## Important notes

- SIP calls require a secure context (HTTPS or localhost) for WebRTC microphone access.
- Telnyx credentials must stay server-side. Never commit them to the frontend `.env`.
- The demo uses in-memory storage for SMS messages. For production, replace it with Vercel KV, Postgres, or another database.
- Outbound calls are normalized to `sip:+E164@sip.telnyx.com` if a plain E.164 number is entered.
