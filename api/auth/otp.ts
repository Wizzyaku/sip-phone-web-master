import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../../lib/supabase-server.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@phonicity.com';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const action = body.action as string;

  switch (action) {
    case 'send':
      return handleSend(req, res, body);
    case 'signup':
      return handleSignup(req, res, body);
    case 'reset':
      return handleReset(req, res, body);
    default:
      res.status(400).json({ error: 'Unknown action. Use: send, signup, or reset.' });
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailViaResend(to: string, code: string, purpose: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set. OTP email will not be sent.');
    return false;
  }

  const subject = purpose === 'signup' ? 'Verify your Phonicity account' : 'Reset your Phonicity password';
  const heading = purpose === 'signup' ? 'Verify your email' : 'Password reset';
  const message =
    purpose === 'signup'
      ? 'Use the code below to verify your email and create your account.'
      : 'Use the code below to reset your password.';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #4241bc; font-size: 24px; font-weight: 800; margin: 0;">Phonicity</h1>
      </div>
      <div style="background: #f8f9fa; border-radius: 16px; padding: 32px; text-align: center;">
        <h2 style="color: #1a1a2e; font-size: 18px; margin: 0 0 8px 0;">${heading}</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">${message}</p>
        <div style="display: inline-block; background: #4241bc; color: white; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
          ${code}
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0 0;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">© Phonicity. All rights reserved.</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error:', errorData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Resend fetch error:', err);
    return false;
  }
}

async function handleSend(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
  const email = (body.email as string || '').trim().toLowerCase();
  const purpose = (body.purpose as string) || 'signup';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }

  const serverClient = supabaseServer();

  if (purpose === 'signup') {
    const { data: existingUsers } = await serverClient.auth.admin.listUsers();
    const exists = (existingUsers?.users || []).some((u) => u.email?.toLowerCase() === email);
    if (exists) {
      res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }
  } else if (purpose === 'reset') {
    const { data: existingUsers } = await serverClient.auth.admin.listUsers();
    const user = (existingUsers?.users || []).find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      res.status(400).json({ error: 'No account found with this email.' });
      return;
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await serverClient.from('otp_codes').insert({
    email,
    code,
    purpose,
    used: false,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('Failed to store OTP:', insertError.message);
    res.status(500).json({ error: 'Failed to generate OTP. Please try again.' });
    return;
  }

  const sent = await sendEmailViaResend(email, code, purpose);
  if (!sent) {
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    return;
  }

  res.status(200).json({ success: true, message: 'Verification code sent to your email.' });
}

async function verifyCode(
  serverClient: ReturnType<typeof supabaseServer>,
  email: string,
  code: string,
  purpose: string
): Promise<boolean> {
  const { data: records, error: fetchError } = await serverClient
    .from('otp_codes')
    .select('id, code, used, expires_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError || !records || records.length === 0) {
    return false;
  }

  const record = records[0];
  if (record.code !== code) {
    return false;
  }

  if (new Date(record.expires_at) < new Date()) {
    return false;
  }

  await serverClient.from('otp_codes').update({ used: true }).eq('id', record.id);

  return true;
}

async function handleSignup(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
  const email = (body.email as string || '').trim().toLowerCase();
  const code = (body.code as string || '').trim();
  const password = (body.password as string || '').trim();
  const name = (body.name as string || '').trim();

  if (!email || !code || !password || !name) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid verification code format.' });
    return;
  }

  const serverClient = supabaseServer();

  const valid = await verifyCode(serverClient, email, code, 'signup');
  if (!valid) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }

  const { data: newUser, error: createError } = await serverClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError || !newUser) {
    console.error('Failed to create user:', createError?.message);
    res.status(500).json({ error: createError?.message || 'Failed to create account.' });
    return;
  }

  await serverClient.from('profiles').upsert({
    id: newUser.user.id,
    name,
    email,
    role: 'user',
  });

  res.status(200).json({ success: true, message: 'Account created successfully. You can now sign in.' });
}

async function handleReset(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
  const email = (body.email as string || '').trim().toLowerCase();
  const code = (body.code as string || '').trim();
  const newPassword = (body.newPassword as string || '').trim();

  if (!email || !code || !newPassword) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid verification code format.' });
    return;
  }

  const serverClient = supabaseServer();

  const valid = await verifyCode(serverClient, email, code, 'reset');
  if (!valid) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }

  const { data: users } = await serverClient.auth.admin.listUsers();
  const user = (users?.users || []).find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    res.status(400).json({ error: 'No account found with this email.' });
    return;
  }

  const { error: updateError } = await serverClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error('Failed to update password:', updateError.message);
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
}
