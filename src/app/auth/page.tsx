import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthClient } from './_components/AuthClient';

export const metadata: Metadata = {
  title: 'Sign In — Kajal Cartel',
  description: 'Sign in to save your style matches and manage your bridal journey.',
  robots: { index: false, follow: true },
};

export default function AuthPage() {
  return (
    <main id="main-content">
      <Suspense fallback={null}>
        <AuthClient />
      </Suspense>
    </main>
  );
}
