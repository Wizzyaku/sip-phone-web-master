import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Mail, Lock, User, ArrowRight, ArrowLeft, Loader2,
  Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { supabase } from '../lib/supabase';
import { useAuthModal } from '../store/authModalStore';
import { cn } from '../lib/utils';

const OTP_API = '/api/auth/otp';

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length > 0) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
  return score;
}

const strengthLabels = ['Too short', 'Weak', 'Fair', 'Strong'];
const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

function OTPInput({ onComplete, onResend, email, purpose, loading }: {
  onComplete: (code: string) => void;
  onResend: () => Promise<void>;
  email: string;
  purpose: 'signup' | 'reset';
  loading: boolean;
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== '')) {
      onComplete(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      onComplete(pasted);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setResendTimer(60);
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Enter verification code</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We sent a 6-digit code to<br />
          <span className="font-semibold text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading || resending}
            className={cn(
              'h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-2 text-center text-xl font-bold transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              digit
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-input bg-background text-foreground',
              (loading || resending) && 'opacity-50'
            )}
          />
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {purpose === 'signup' ? 'Creating your account...' : 'Verifying code...'}
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Didn't receive a code?{' '}
          <button
            onClick={handleResend}
            disabled={resendTimer > 0 || loading || resending}
            className="font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resending ? 'Sending...' : resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
          </button>
        </p>
      </div>
    </div>
  );
}

export function AuthModal() {
  const { isOpen, mode, step, email, close, setMode, setStep, setEmail } = useAuthModal();

  const [fullName, setFullName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setPassword('');
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (data.session) {
        close();
        window.location.href = '/dashboard';
      } else {
        setError('Please confirm your email before signing in.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !signupEmail.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(OTP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: signupEmail.trim(), purpose: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send verification code.');
        return;
      }
      setEmail(signupEmail.trim());
      setStep('otp');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupOtpComplete = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(OTP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email,
          code,
          password,
          name: fullName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account.');
        return;
      }
      setSuccess('Account created successfully! You can now sign in.');
      setMode('login');
      setStep('form');
      setLoginEmail(email);
      setPassword('');
      setFullName('');
      setSignupEmail('');
    } catch {
      setError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, password, fullName, setMode, setStep, setLoginEmail]);

  const handleResendSignup = async () => {
    setError(null);
    const res = await fetch(OTP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', email, purpose: 'signup' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to resend code.');
      throw new Error(data.error);
    }
  };

  const handleResetSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(OTP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: resetEmail.trim(), purpose: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send reset code.');
        return;
      }
      setEmail(resetEmail.trim());
      setStep('otp');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetOtpComplete = useCallback(async (code: string) => {
    setOtpCode(code);
    setStep('new-password');
  }, [setStep]);

  const handleResendReset = async () => {
    setError(null);
    const res = await fetch(OTP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', email, purpose: 'reset' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to resend code.');
      throw new Error(data.error);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(OTP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          email,
          code: otpCode,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
        return;
      }
      setSuccess('Password reset successfully! You can now sign in.');
      setMode('login');
      setStep('form');
      setLoginEmail(email);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setResetEmail('');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setError(null);
    setSuccess(null);
    setPassword('');
    setMode(newMode);
  };

  const handleBack = () => {
    setStep('form');
    setPassword('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={close}
      />

      {/* Modal container - bottom sheet on mobile, centered on desktop */}
      <div className="fixed inset-0 z-[101] flex items-end md:items-center justify-center p-0 md:p-4">
        <div
          className={cn(
            'w-full md:max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-2xl',
            'max-h-[88vh] md:max-h-[85vh] overflow-y-auto',
            'animate-fade-in'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle for mobile */}
          <div className="md:hidden flex justify-center pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1">
            <div className="flex items-center gap-2">
              <img src="/phonicity2.png" alt="Phonicity" className="h-9 w-9 object-contain rounded-md" />
              <span className="text-base font-bold text-primary">Phonicity</span>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-1">
            {/* Success message */}
            {success && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            {/* OTP Step (signup) */}
            {step === 'otp' && mode === 'signup' ? (
              <div>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive text-center mb-4">
                    {error}
                  </div>
                )}
                <OTPInput
                  onComplete={handleSignupOtpComplete}
                  onResend={handleResendSignup}
                  email={email}
                  purpose="signup"
                  loading={loading}
                />
              </div>
            ) : step === 'otp' && mode === 'reset' ? (
              <div>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive text-center mb-4">
                    {error}
                  </div>
                )}
                <OTPInput
                  onComplete={handleResetOtpComplete}
                  onResend={handleResendReset}
                  email={email}
                  purpose="reset"
                  loading={loading}
                />
              </div>
            ) : step === 'new-password' ? (
              /* New Password Step (reset) */
              <div className="space-y-4">
                <button
                  onClick={() => { setStep('otp'); setError(null); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Set new password</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Enter your new password below.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetConfirm} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full transition-all', strengthColors[getPasswordStrength(newPassword)])}
                            style={{ width: `${(getPasswordStrength(newPassword) / 3) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{strengthLabels[getPasswordStrength(newPassword)]}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reset Password
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              </div>
            ) : mode === 'login' ? (
              /* Login Form */
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Sign in to manage your calls, messages, and contacts.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="name@company.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-muted-foreground">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>

                {/* Social auth */}
                <div className="pt-1">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-9 rounded-xl">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      <span className="font-semibold text-sm">Google</span>
                    </Button>
                    <Button variant="outline" className="h-9 rounded-xl">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                      <span className="font-semibold text-sm">GitHub</span>
                    </Button>
                  </div>
                </div>

                <p className="text-center text-sm text-muted-foreground pt-1">
                  Don't have an account?{' '}
                  <button
                    onClick={() => switchMode('signup')}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            ) : mode === 'reset' ? (
              /* Reset Password Form */
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Reset password</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Enter your email and we'll send you a verification code.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetSend} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="name@company.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send Verification Code
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground pt-1">
                  Remember your password?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            ) : (
              /* Signup Form */
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Create your account</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Start your free trial. No credit card required.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full transition-all', strengthColors[strength])}
                            style={{ width: `${(strength / 3) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{strengthLabels[strength]}</span>
                      </div>
                    )}
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">
                      I agree to the{' '}
                      <a href="#" className="text-primary font-semibold hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-primary font-semibold hover:underline">Privacy Policy</a>
                    </span>
                  </label>

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-xl text-base font-semibold shadow-lg shadow-primary/20"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Account
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default AuthModal;
