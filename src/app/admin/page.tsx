import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { getAdminOverview } from '@/lib/db/controllers/AdminInsightsManager';
import { AdminHome } from './_components/AdminHome';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await requireAdminPage('/admin');
  await dbConnect();
  const overview = await getAdminOverview();

  return <AdminHome adminEmail={session.user?.email ?? ''} overview={overview} />;
}
