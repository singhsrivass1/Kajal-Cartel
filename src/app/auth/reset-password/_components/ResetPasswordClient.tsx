'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

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

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Please request a new one.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setIsLoading(false);
        return;
      }
      setDone(true);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <Link href="/" style={{ display: 'block', fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none', marginBottom: '60px', textAlign: 'center' }}>
          KAJAL CARTEL
        </Link>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2.2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>
                Set a new password.
              </h1>
              <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '32px' }}>
                Choose a new password for your account.
              </p>

              {!token && (
                <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.7)', marginBottom: '14px' }}>
                  This link is missing its reset token. Please request a new link from the sign-in page.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                <TextField label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
                <TextField label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
              </div>

              {error && <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.7)', marginBottom: '14px' }}>{error}</p>}

              <button onClick={handleSubmit} disabled={isLoading || !token}
                style={{ width: '100%', padding: '14px', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: isLoading || !token ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: isLoading || !token ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                {isLoading ? 'Saving…' : 'Reset password'}
              </button>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div style={{ width: '40px', height: '40px', border: '1px solid #C9A96E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px' }}>
                <span style={{ color: '#C9A96E', fontSize: '17px' }}>✓</span>
              </div>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '2rem', color: '#F0EBE0', fontWeight: 400, marginBottom: '12px' }}>Password reset.</h1>
              <p style={{ fontSize: '13px', color: '#5A5450', lineHeight: 1.7, marginBottom: '36px' }}>
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button onClick={() => router.push('/auth')}
                style={{ width: '100%', padding: '14px', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: '#C9A96E', color: '#080808', border: 'none', cursor: 'pointer' }}>
                Sign in
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
