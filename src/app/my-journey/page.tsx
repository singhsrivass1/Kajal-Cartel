import type { Metadata } from 'next';
import { MyJourneyClient } from './_components/MyJourneyClient';

export const metadata: Metadata = {
  title: 'My Bridal Journey — Kajal Cartel',
  description: 'Your saved artists, style matches, and bridal planning in one place.',
};

export default function MyJourneyPage() {
  return <MyJourneyClient />;
}