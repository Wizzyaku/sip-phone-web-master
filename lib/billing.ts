// ============================================================
// Billing constants and helper functions
// 1000 coins = $1
// ============================================================

export const COINS_PER_USD = 1000;

// --- Call pricing (per second, billed per second) ---
// $0.5/min = 500 coins/min = 500/60 ≈ 8.333 coins/sec
export const OUTBOUND_CALL_COINS_PER_SECOND = 500 / 60; // $0.5/min
export const INBOUND_CALL_COINS_PER_SECOND = 500 / 60;  // $0.5/min

// --- SMS/MMS pricing (per segment) ---
export const SMS_COINS_PER_SEGMENT = 22;   // outbound & inbound
export const MMS_COINS_PER_MESSAGE = 30;

// --- Subscription pricing ---
export const NUMBER_SUBSCRIPTION_COINS = 5000; // per 30 days

// --- Feature pricing (per minute) ---
export const CALL_RECORDING_COINS_PER_MINUTE = 6;
export const CONFERENCE_COINS_PER_PARTICIPANT_PER_MINUTE = 6;
export const AI_VOICE_COINS_PER_MINUTE = 30;

// --- Safety thresholds ---
export const MIN_CALL_BALANCE = 20;        // minimum coins to start a call
export const CALL_RESERVE_SECONDS = 60;    // reserve 60s worth of coins on call start

// --- Helper: calculate call cost ---
export function calculateCallCost(
  durationSeconds: number,
  direction: 'incoming' | 'outgoing'
): number {
  const rate = direction === 'incoming'
    ? INBOUND_CALL_COINS_PER_SECOND
    : OUTBOUND_CALL_COINS_PER_SECOND;
  return Math.ceil(durationSeconds * rate);
}

// --- Helper: calculate reserve amount for call start ---
export function calculateReserveAmount(
  direction: 'incoming' | 'outgoing',
  reserveSeconds: number = CALL_RESERVE_SECONDS
): number {
  const rate = direction === 'incoming'
    ? INBOUND_CALL_COINS_PER_SECOND
    : OUTBOUND_CALL_COINS_PER_SECOND;
  return Math.ceil(reserveSeconds * rate);
}

// --- Helper: calculate SMS cost ---
export function calculateSmsCost(segments: number, isMms: boolean = false): number {
  if (isMms) return MMS_COINS_PER_MESSAGE * segments;
  return SMS_COINS_PER_SEGMENT * segments;
}

// --- Helper: estimate SMS segments from body length ---
export function estimateSmsSegments(body: string): number {
  const GSM_7BIT_LIMIT = 160;
  const UCS2_LIMIT = 70;
  const isGsm7 = /^[\x00-\x7F]*$/.test(body);
  const limit = isGsm7 ? GSM_7BIT_LIMIT : UCS2_LIMIT;
  if (body.length === 0) return 1;
  return Math.ceil(body.length / limit);
}

// --- Helper: calculate feature cost ---
export function calculateFeatureCost(
  feature: 'recording' | 'conference' | 'ai_voice',
  durationMinutes: number,
  participants: number = 1
): number {
  switch (feature) {
    case 'recording':
      return Math.ceil(durationMinutes * CALL_RECORDING_COINS_PER_MINUTE);
    case 'conference':
      return Math.ceil(durationMinutes * participants * CONFERENCE_COINS_PER_PARTICIPANT_PER_MINUTE);
    case 'ai_voice':
      return Math.ceil(durationMinutes * AI_VOICE_COINS_PER_MINUTE);
    default:
      return 0;
  }
}
