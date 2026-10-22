import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthClient } from './_components/AuthClient';

export const metadata: Metadata = {
  title: 'Sign In — Kajal Cartel',
  description: 'Sign in to save your style matches and manage your bridal journey.',
};

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthClient />
    </Suspense>
  );
}