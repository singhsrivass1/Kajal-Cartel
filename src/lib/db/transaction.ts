import type { ClientSession, Types } from 'mongoose';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';

export class TransactionsUnavailableError extends Error {
  constructor() {
    super('This database does not support multi-document transactions. Bookings require a MongoDB replica set, such as any Atlas cluster.');
    this.name = 'TransactionsUnavailableError';
  }
}

function isTransactionUnsupported(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: number; message?: string };
  if (code === 20 && typeof message === 'string' && /transaction/i.test(message)) return true;
  return typeof message === 'string' && /Transaction numbers are only allowed on a replica set/i.test(message);
}

export async function runTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const mongoose = await dbConnect();
  const session = await mongoose.connection.startSession();
  try {
    let result: T | undefined;
    let completed = false;
    await session.withTransaction(
      async () => {
        result = await work(session);
        completed = true;
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    );
    if (!completed) throw new Error('Transaction did not complete.');
    return result as T;
  } catch (err) {
    if (isTransactionUnsupported(err)) throw new TransactionsUnavailableError();
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function lockVendorSchedule(
  vendorId: Types.ObjectId,
  session: ClientSession,
  { requireActive = false }: { requireActive?: boolean } = {}
): Promise<boolean> {
  const result = await Vendor.updateOne(
    requireActive ? { _id: vendorId, 'flags.isActive': true } : { _id: vendorId },
    { $inc: { bookingLockVersion: 1 } },
    { session, timestamps: false }
  );
  return result.matchedCount === 1;
}
