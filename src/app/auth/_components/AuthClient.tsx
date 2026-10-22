'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { toSafeCallbackPath } from '@/lib/auth/callbackUrl';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

type AuthMode = 'signin' | 'signup';
type AuthStep = 'entry' | 'forgot' | 'forgot_sent' | 'signup_sent';

type AuthNotice = { tone: 'success' | 'error'; text: string };

const AUTH_NOTICES = {
  verified: { tone: 'success', text: 'Your email is confirmed. Sign in with your email and password.' },
  verificationFailed: {
    tone: 'error',
    text: 'That confirmation link is invalid or has expired, or it was opened in a different browser from the one used to sign up. Please sign up again.',
  },
  verificationUnavailable: { tone: 'error', text: 'Email sign-up is not available right now. Please continue with Google.' },
  accessDenied: { tone: 'error', text: 'Google sign-in requires a Google account with a verified email address.' },
} satisfies Record<string, AuthNotice>;

function noticeFromParams(params: { get(name: string): string | null }): AuthNotice | null {
  if (params.get('error') === 'AccessDenied') return AUTH_NOTICES.accessDenied;
  const verification = params.get('verification');
  if (verification === 'failed') return AUTH_NOTICES.verificationFailed;
  if (verification === 'unavailable') return AUTH_NOTICES.verificationUnavailable;
  if (params.get('verified') === '1') return AUTH_NOTICES.verified;
  return null;
}

function signupErrorMessage(status: number): string {
  if (status === 503) return 'Email sign-up is not available right now. Please continue with Google.';
  if (status === 429) return 'Too many sign-up attempts. Please wait a while and try again.';
  if (status === 400) return 'Please check your name, email, and password and try again.';
  return 'Something went wrong. Please try again.';
}

function resetErrorMessage(status: number): string {
  if (status === 503) return 'Password reset is not available right now. Please continue with Google.';
  if (status === 429) return 'Too many reset requests. Please wait a while and try again.';
  if (status === 400) return 'Please enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

function SocialButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: '100%', padding: '13px 16px', background: 'none', border: `1px solid ${hover ? '#2D2418' : '#1C1C1C'}`, color: hover ? '#F0EBE0' : '#6A5A50', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyItems: 'flex-start', justifyContent: 'center', gap: '12px', transition: 'border-color 0.2s, color 0.2s', letterSpacing: '0.02em' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

const GoogleIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function TextField({ label, type, value, onChange, error, autoComplete }: { label: string; type: string; value: string; onChange: (v: string) => void; error?: boolean; autoComplete?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={label}
      autoComplete={autoComplete}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '13px 14px', background: '#0C0C0C', border: `1px solid ${error ? 'rgba(220,80,80,0.45)' : '#1C1C1C'}`, color: '#F0EBE0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
      onBlur={e => (e.currentTarget.style.borderColor = error ? 'rgba(220,80,80,0.45)' : '#1C1C1C')}
    />
  );
}

export function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = toSafeCallbackPath(searchParams.get('callbackUrl'));
  const notice = noticeFromParams(searchParams);

  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('entry');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async () => {
    setFormError('');

    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setFormError('Please enter your name.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          setFormError(signupErrorMessage(res.status));
          setIsLoading(false);
          return;
        }
        setPassword('');
        setStep('signup_sent');
        setIsLoading(false);
        return;
      }

      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl });

      if (result?.error) {
        setFormError('Incorrect email or password.');
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch (error) {
      console.error('Credentials auth error:', error);
      setFormError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    setFormError('');
    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setFormError(resetErrorMessage(res.status));
        return;
      }
      setStep('forgot_sent');
    } catch (error) {
      console.error('Forgot password error:', error);
      setFormError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/images/hero-02.png" alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 50%, #080808 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080808 0%, transparent 40%)' }} />
        <div style={{ position: 'absolute', bottom: '60px', left: '52px', right: '52px' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.15rem', fontStyle: 'italic', color: 'rgba(240,235,224,0.55)', lineHeight: 1.7, maxWidth: '300px', marginBottom: '14px' }}>
            "I found my artist in under five minutes. She understood exactly what I wanted."
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(240,235,224,0.3)' }}>Priya M. · Married November 2024 · Booked Studio Noor</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 52px' }}>
        <div style={{ width: '100%', maxWidth: '340px' }}>
          <Link href="/" style={{ display: 'block', fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none', marginBottom: '60px' }}>
            KAJAL CARTEL
          </Link>

          <AnimatePresence mode="wait">
            {step === 'entry' ? (
              <motion.div key="entry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                {notice && (
                  <p role={notice.tone === 'error' ? 'alert' : 'status'} style={{ fontSize: '11px', lineHeight: 1.6, color: notice.tone === 'error' ? 'rgba(220,80,80,0.7)' : '#5A8A5A', marginBottom: '20px' }}>
                    {notice.text}
                  </p>
                )}
                <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2.2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>
                  {mode === 'signin' ? 'Welcome back.' : 'Join Kajal Cartel.'}
                </h1>
                <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '40px' }}>
                  {mode === 'signin'
                    ? 'Sign in to access your saved artists and style matches.'
                    : 'Save your matches and keep track of your bridal planning.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  <SocialButton
                    icon={GoogleIcon}
                    label="Continue with Google"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#1A1A1A' }} />
                  <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#2E2C2A' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#1A1A1A' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '10px' }}>
                  {mode === 'signup' && (
                    <TextField label="Full name" type="text" value={name} onChange={setName} autoComplete="name" />
                  )}
                  <TextField label="your@email.com" type="email" value={email} onChange={setEmail} autoComplete="email" />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </div>

                {mode === 'signin' && (
                  <div style={{ textAlign: 'right', marginBottom: '14px' }}>
                    <button
                      onClick={() => { setFormError(''); setStep('forgot'); }}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#3A3530', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {formError && <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.7)', marginBottom: '14px' }}>{formError}</p>}

                <button onClick={handleCredentialsSubmit} disabled={isLoading}
                  style={{ width: '100%', padding: '14px', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: isLoading ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => !isLoading && (e.currentTarget.style.background = '#B8943F')}
                  onMouseLeave={e => !isLoading && (e.currentTarget.style.background = '#C9A96E')}>
                  {isLoading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>

                <p style={{ fontSize: '12px', color: '#3A3530', textAlign: 'center', marginTop: '24px' }}>
                  {mode === 'signin' ? "New here? " : 'Have an account? '}
                  <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setFormError(''); }}
                    style={{ background: 'none', border: 'none', fontSize: '12px', color: '#C9A96E', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    {mode === 'signin' ? 'Create an account' : 'Sign in'}
                  </button>
                </p>
              </motion.div>
            ) : step === 'forgot' ? (
              <motion.div key="forgot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2.2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>
                  Reset your password.
                </h1>
                <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '32px' }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>

                <div style={{ marginBottom: '14px' }}>
                  <TextField label="your@email.com" type="email" value={email} onChange={setEmail} autoComplete="email" />
                </div>

                {formError && <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.7)', marginBottom: '14px' }}>{formError}</p>}

                <button onClick={handleForgotSubmit} disabled={isLoading}
                  style={{ width: '100%', padding: '14px', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: isLoading ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                  {isLoading ? 'Sending…' : 'Send reset link'}
                </button>

                <button onClick={() => { setFormError(''); setStep('entry'); }}
                  style={{ display: 'block', margin: '24px auto 0', background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4A4440', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
                  ← Back to sign in
                </button>
              </motion.div>
            ) : (
              <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div style={{ width: '40px', height: '40px', border: '1px solid #C9A96E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px' }}>
                  <span style={{ color: '#C9A96E', fontSize: '17px' }}>✉</span>
                </div>
                <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '12px' }}>Check your email.</h1>
                <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '8px' }}>
                  {step === 'signup_sent' ? 'If this email can be used, a confirmation link is on its way to' : 'If an account exists for'}
                </p>
                <p style={{ fontSize: '14px', color: '#C8B9A8', marginBottom: '24px' }}>{email}</p>
                <p style={{ fontSize: '12px', color: '#3A3530', lineHeight: 1.7, marginBottom: '36px' }}>
                  {step === 'signup_sent'
                    ? 'You must confirm your email before you can sign in. Open the link in this same browser — it will not work in a different browser or device. It expires in 24 hours.'
                    : 'a password reset link is on its way. It expires in 30 minutes.'}
                </p>
                <button onClick={() => { setMode('signin'); setStep('entry'); }}
                  style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4A4440', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
                  ← Back to sign in
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p style={{ fontSize: '10px', color: '#252220', textAlign: 'center', marginTop: '52px', lineHeight: 1.7 }}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
