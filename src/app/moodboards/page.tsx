import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/api/userRoute';
import { dbConnect } from '@/lib/db/connect';
import { listBoards, MAX_BOARDS_PER_USER } from '@/lib/db/controllers/BoardManager';
import { BoardsClient } from './_components/BoardsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Moodboards — Kajal Cartel',
  description: 'Plan the looks for each of your wedding events in private moodboards.',
  robots: { index: false, follow: false },
};

export default async function MoodboardsPage() {
  const user = await getSessionUserId();
  if (!user) redirect('/auth?callbackUrl=/moodboards');

  await dbConnect();
  const boards = await listBoards(user.userId);
  return <BoardsClient boards={boards} maxBoards={MAX_BOARDS_PER_USER} />;
}
