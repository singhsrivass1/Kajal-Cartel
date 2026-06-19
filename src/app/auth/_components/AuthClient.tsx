'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

type AuthMode = 'signin' | 'signup';
type AuthStep = 'entry' | 'email_sent';


function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '100%', padding: '13px 16px', background: 'none', border: `1px solid ${hover ? '#2D2418' : '#1C1C1C'}`, color: hover ? '#F0EBE0' : '#6A5A50', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'flex-start', justifyContent: 'center', gap: '12px', transition: 'border-color 0.2s, color 0.2s', letterSpacing: '0.02em' }}>
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


const AppleIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74.83 0 2.04-.84 3.65-.7-1.47 2.4-1.04 4.88 1.1 5.92-1.2 2.58-2.67 5.25-5.32 5.3M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/>
  </svg>
);

export function AuthClient() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('entry');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async () => {
    if (!email || !email.includes('@')) { setEmailError('Please enter a valid email address.'); return; }
    setEmailError('');
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1100));
    setIsLoading(false);
    setStep('email_sent');
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
                <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2.2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>
                  {mode === 'signin' ? 'Welcome back.' : 'Join Kajal Cartel.'}
                </h1>
                <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '40px' }}>
                  {mode === 'signin'
                    ? 'Sign in to access your saved artists and style matches.'
                    : 'Save your matches and keep track of your bridal planning.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {}
                  <SocialButton icon={GoogleIcon} label="Continue with Google" />
                  <SocialButton icon={AppleIcon} label="Continue with Apple" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#1A1A1A' }} />
                  <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#2E2C2A' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#1A1A1A' }} />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <input type="email" value={email} placeholder="your@email.com"
                    onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    style={{ width: '100%', padding: '13px 14px', background: '#0C0C0C', border: `1px solid ${emailError ? 'rgba(220,80,80,0.45)' : '#1C1C1C'}`, color: '#F0EBE0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A96E')}
                    onBlur={e => (e.currentTarget.style.borderColor = emailError ? 'rgba(220,80,80,0.45)' : '#1C1C1C')} />
                  {emailError && <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.7)', marginTop: '6px' }}>{emailError}</p>}
                </div>

                <button onClick={handleEmailSubmit} disabled={isLoading}
                  style={{ width: '100%', padding: '14px', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: isLoading ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => !isLoading && (e.currentTarget.style.background = '#B8943F')}
                  onMouseLeave={e => !isLoading && (e.currentTarget.style.background = '#C9A96E')}>
                  {isLoading ? 'Sending link…' : mode === 'signin' ? 'Send sign-in link' : 'Create account'}
                </button>

                <p style={{ fontSize: '12px', color: '#3A3530', textAlign: 'center', marginTop: '24px' }}>
                  {mode === 'signin' ? "New here? " : 'Have an account? '}
                  <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    style={{ background: 'none', border: 'none', fontSize: '12px', color: '#C9A96E', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    {mode === 'signin' ? 'Create an account' : 'Sign in'}
                  </button>
                </p>
              </motion.div>
            ) : (
              <motion.div key="sent" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div style={{ width: '40px', height: '40px', border: '1px solid #C9A96E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px' }}>
                  <span style={{ color: '#C9A96E', fontSize: '17px' }}>✉</span>
                </div>
                <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '12px' }}>Check your email.</h1>
                <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '8px' }}>
                  We've sent a sign-in link to
                </p>
                <p style={{ fontSize: '14px', color: '#C8B9A8', marginBottom: '24px' }}>{email}</p>
                <p style={{ fontSize: '12px', color: '#3A3530', lineHeight: 1.7, marginBottom: '36px' }}>
                  Click the link in the email to continue. It expires in 15 minutes.
                </p>
                <button onClick={() => { setStep('entry'); setEmail(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4A4440', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
                  ← Use a different email
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