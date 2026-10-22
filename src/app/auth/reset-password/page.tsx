import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordClient } from './_components/ResetPasswordClient';

export const metadata: Metadata = {
  title: 'Reset Password — Kajal Cartel',
  description: 'Set a new password for your Kajal Cartel account.',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordClient />
    </Suspense>
  );
}
