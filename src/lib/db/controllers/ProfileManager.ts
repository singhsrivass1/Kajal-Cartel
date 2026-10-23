import { Types } from 'mongoose';
import User, { MAX_PROFILE_NAME_LENGTH, MAX_PROFILE_PHONE_LENGTH } from '@/lib/db/models/User';

export class ProfileError extends Error {
  readonly statusCode: 400 | 401 | 404;

  constructor(message: string, statusCode: 400 | 401 | 404 = 400) {
    super(message);
    this.name = 'ProfileError';
    this.statusCode = statusCode;
  }
}

export interface ProfileView {
  name: string;
  email: string;
  phone: string;
  image: string | null;
  memberSince: string;
}

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const PHONE_ALLOWED = /^[+\d\s().-]+$/;

export function validateProfileInput(input: Record<string, unknown>): { name: string; phone: string | null } {
  if (typeof input.name !== 'string') {
    throw new ProfileError('Please enter your name.');
  }
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new ProfileError('Please enter your name.');
  if (name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new ProfileError(`Name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer.`);
  }
  if (CONTROL_CHARS.test(name) || /[<>]/.test(name)) {
    throw new ProfileError('Name contains characters that are not allowed.');
  }

  if (input.phone !== undefined && input.phone !== null && typeof input.phone !== 'string') {
    throw new ProfileError('Phone number must be text.');
  }
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (phone) {
    if (phone.length > MAX_PROFILE_PHONE_LENGTH || !PHONE_ALLOWED.test(phone)) {
      throw new ProfileError('Enter a phone number using digits, spaces, +, -, or brackets (up to 20 characters).');
    }
    const digits = phone.replace(/\D/g, '').length;
    if (digits < 7 || digits > 15) {
      throw new ProfileError('Phone number must contain between 7 and 15 digits.');
    }
  }
  return { name, phone: phone || null };
}

function toView(user: Record<string, any>): ProfileView {
  return {
    name: user.name ?? '',
    email: user.email,
    phone: user.phone ?? '',
    image: user.image || null,
    memberSince: new Date(user.createdAt ?? Date.now()).toISOString(),
  };
}

function assertUserId(userId: string): Types.ObjectId {
  if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) {
    throw new ProfileError('You must be signed in.', 401);
  }
  return new Types.ObjectId(userId);
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const user = await User.findById(assertUserId(userId))
    .select('name email phone image createdAt')
    .lean<Record<string, any>>();
  if (!user) throw new ProfileError('Account not found.', 404);
  return toView(user);
}

export async function updateProfile(userId: string, input: Record<string, unknown>): Promise<ProfileView> {
  const _id = assertUserId(userId);
  const { name, phone } = validateProfileInput(input);
  const updated = await User.findOneAndUpdate(
    { _id },
    { $set: { name, ...(phone ? { phone } : {}) }, ...(phone ? {} : { $unset: { phone: '' } }) },
    { new: true, runValidators: true }
  )
    .select('name email phone image createdAt')
    .lean<Record<string, any>>();
  if (!updated) throw new ProfileError('Account not found.', 404);
  return toView(updated);
}
