import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Types } from 'mongoose';
import { getSessionUserId } from '@/lib/api/userRoute';
import { dbConnect } from '@/lib/db/connect';
import { getBoard } from '@/lib/db/controllers/BoardManager';
import SavedMoodboard from '@/lib/db/models/SavedMoodboard';
import User from '@/lib/db/models/User';
import Vendor from '@/lib/db/models/Vendor';
import { BoardDetailClient } from './_components/BoardDetailClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Moodboard — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function MoodboardDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { created?: string } }) {
  const user = await getSessionUserId();
  if (!user) redirect(`/auth?callbackUrl=${encodeURIComponent(`/moodboards/${params.id}`)}`);

  await dbConnect();
  const board = await getBoard(user.userId, params.id);
  if (!board) notFound();

  const userObjectId = new Types.ObjectId(user.userId);
  const [looks, userDoc] = await Promise.all([
    SavedMoodboard.find({ user: userObjectId }).select('label createdAt').sort({ createdAt: -1 }).lean<Array<{ _id: Types.ObjectId; label: string }>>(),
    User.findById(userObjectId).select('savedArtists').lean<{ savedArtists?: string[] }>(),
  ]);
  const savedSlugs = userDoc?.savedArtists ?? [];
  const savedArtists = savedSlugs.length
    ? await Vendor.find({ slug: { $in: savedSlugs }, 'flags.isActive': true })
        .select('slug name')
        .lean<Array<{ slug: string; name: string }>>()
    : [];

  return (
    <BoardDetailClient
      board={board}
      justCreated={searchParams?.created === '1'}
      savedLooks={looks.map((l) => ({ id: l._id.toString(), label: l.label }))}
      savedArtists={savedArtists.map((a) => ({ slug: a.slug, name: a.name }))}
    />
  );
}
