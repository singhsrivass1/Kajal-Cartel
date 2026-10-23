'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Avatar } from '@/components/site/AccountMenu';
import { apiRequest, SessionExpiredError, signInHref } from '@/lib/client/api';
import {
  COLORS,
  FONT_DISPLAY,
  cardStyle,
  eyebrowStyle,
  fieldStyle,
  labelStyle,
  pageTitleStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '@/components/site/tokens';
import type { ProfileView } from '@/lib/db/controllers/ProfileManager';

export function AccountClient({ profile, signInMethod }: { profile: ProfileView; signInMethod: string }) {
  const { update } = useSession();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [saved, setSaved] = useState<ProfileView>(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string; expired?: boolean } | null>(null);
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const phoneHintId = useId();

  const dirty = name.trim() !== saved.name || phone.trim() !== saved.phone;

  const save = async () => {
    if (!name.trim()) {
      setMessage({ tone: 'error', text: 'Please enter your name.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { profile: next } = await apiRequest<{ profile: ProfileView }>('/api/user/profile', {
        method: 'PATCH',
        body: { name: name.trim(), phone: phone.trim() },
      });
      setSaved(next);
      setName(next.name);
      setPhone(next.phone);
      await update();
      setMessage({ tone: 'success', text: 'Your profile has been saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save your profile.', expired: err instanceof SessionExpiredError });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '880px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Account</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '32px' }}>Profile &amp; Settings</h1>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]" style={{ gap: '20px', alignItems: 'start' }}>
          <section aria-labelledby="profile-heading" style={{ ...cardStyle, padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <Avatar name={saved.name} email={saved.email} image={saved.image} size={56} />
              <div>
                <h2 id="profile-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', color: COLORS.text, fontWeight: 400, margin: '0 0 2px' }}>
                  {saved.name || 'Your profile'}
                </h2>
                <p style={{ fontSize: '11px', color: COLORS.textDim, margin: 0 }}>
                  Member since {new Date(saved.memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor={nameId} style={labelStyle}>Full name</label>
                <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required style={fieldStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor={phoneId} style={labelStyle}>Phone (optional)</label>
                <input id={phoneId} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" aria-describedby={phoneHintId} style={fieldStyle} />
                <p id={phoneHintId} style={{ fontSize: '11px', color: COLORS.textDim, margin: '6px 0 0' }}>Used to prefill booking requests. Digits, spaces, +, - and brackets.</p>
              </div>
              <div style={{ marginBottom: '22px' }}>
                <label htmlFor={emailId} style={labelStyle}>Email</label>
                <input id={emailId} value={saved.email} readOnly aria-readonly="true" style={{ ...fieldStyle, color: COLORS.textDim, cursor: 'not-allowed' }} />
                <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '6px 0 0' }}>Your email comes from your sign-in ({signInMethod}) and can&apos;t be changed here.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="submit" disabled={saving || !dirty} style={primaryButtonStyle(saving || !dirty)}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {dirty && !saving && (
                  <button type="button" onClick={() => { setName(saved.name); setPhone(saved.phone); setMessage(null); }} style={secondaryButtonStyle()}>
                    Discard
                  </button>
                )}
              </div>
              <div aria-live="polite">
                {message && (
                  <p role={message.tone === 'error' ? 'alert' : undefined} style={{ fontSize: '12px', margin: '14px 0 0', color: message.tone === 'success' ? COLORS.success : COLORS.error }}>
                    {message.text}{' '}
                    {message.expired && <Link href={signInHref('/account')} style={{ color: COLORS.gold }}>Sign in again</Link>}
                  </p>
                )}
              </div>
            </form>
          </section>

          <aside aria-label="Account shortcuts" style={{ ...cardStyle, padding: '22px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 12px' }}>Your account</p>
            <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                ['/journey?tab=bookings', 'My bookings'],
                ['/journey?tab=artists', 'Saved artists'],
                ['/journey?tab=looks', 'Saved looks'],
                ['/moodboards', 'Moodboards'],
                ['/policies', 'Booking policy'],
                ['/help', 'Help'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="kc-menu-item" style={{ display: 'block', padding: '9px 8px', fontSize: '13px', color: COLORS.textMuted, textDecoration: 'none' }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => signOut({ callbackUrl: '/' })} style={{ ...secondaryButtonStyle(), width: '100%' }}>
              Sign out
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
