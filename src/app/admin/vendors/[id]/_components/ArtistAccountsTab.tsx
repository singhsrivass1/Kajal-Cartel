'use client';

import { useEffect, useState } from 'react';
import { Button, Field, Notice, SectionCard, TextInput } from '../../../_components/FormControls';

interface Account {
  userId: string;
  name: string;
  email: string;
}

export function ArtistAccountsTab({ vendorId }: { vendorId: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = async () => {
    const res = await fetch(`/api/admin/vendors/${vendorId}/artist-accounts`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Could not load linked accounts.');
    setAccounts(data.accounts as Account[]);
  };

  useEffect(() => {
    load().catch((err) => setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load linked accounts.' }));
  }, [vendorId]);

  const link = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/artist-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not link this account.');
      setEmail('');
      await load();
      setMessage({ tone: 'success', text: `${data.account?.email ?? 'The account'} can now open the artist portal for this vendor.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not link this account.' });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (account: Account) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/artist-accounts?userId=${encodeURIComponent(account.userId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not unlink this account.');
      await load();
      setMessage({ tone: 'success', text: `${account.email} no longer has artist portal access.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not unlink this account.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="Artist portal access">
        <p style={{ fontSize: '12px', color: '#8A8078', lineHeight: 1.6, margin: '0 0 16px', maxWidth: '68ch' }}>
          A linked account can sign in to <strong style={{ color: '#C8B9A8', fontWeight: 400 }}>/artist</strong> and see this vendor&apos;s appointments and schedule (read-only). It cannot change bookings, prices or other vendors, and gets no admin access. The artist must already have signed in to Kajal Cartel once with this email.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <Field label="Account email">
              <TextInput value={email} onChange={setEmail} type="email" placeholder="artist@example.com" />
            </Field>
          </div>
          <Button tone="primary" onClick={link} disabled={busy || !email.trim()}>{busy ? 'Working…' : 'Link account'}</Button>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </SectionCard>

      <SectionCard title="Linked accounts">
        {accounts === null ? (
          <p style={{ fontSize: '12px', color: '#7A706A', margin: 0 }}>Loading…</p>
        ) : accounts.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#7A706A', margin: 0 }}>No accounts are linked to this vendor.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {accounts.map((a) => (
              <li key={a.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', border: '1px solid #1C1C1C', padding: '10px 12px' }}>
                <span style={{ fontSize: '12px', color: '#C8B9A8' }}>{a.name ? `${a.name} · ` : ''}{a.email}</span>
                <Button tone="danger" onClick={() => unlink(a)} disabled={busy}>Unlink</Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
