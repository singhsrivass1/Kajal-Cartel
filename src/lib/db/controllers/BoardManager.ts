import { Types } from 'mongoose';
import PlanningBoard, {
  BOARD_EVENT_TYPES,
  BOARD_ITEM_KINDS,
  MAX_BOARD_ITEMS,
  MAX_BOARD_ITEM_NOTE_LENGTH,
  MAX_BOARD_NAME_LENGTH,
  MAX_BOARD_NOTES_LENGTH,
  MAX_STYLE_PREFERENCES,
  MAX_STYLE_PREFERENCE_LENGTH,
} from '@/lib/db/models/PlanningBoard';
import type { BoardEventType, BoardItemKind, IBoardItem } from '@/lib/db/models/PlanningBoard';
import BoardImage, {
  BOARD_IMAGE_MIME_TYPES,
  MAX_BOARD_IMAGE_BYTES,
  MAX_BOARD_IMAGES_PER_USER,
} from '@/lib/db/models/BoardImage';
import SavedMoodboard from '@/lib/db/models/SavedMoodboard';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import { isIsoDate, isoDateToUtcMidnight, utcMidnightToIsoDate } from '@/lib/db/utils/time';

export class BoardError extends Error {
  readonly statusCode: 400 | 401 | 404 | 409 | 422;

  constructor(message: string, statusCode: 400 | 401 | 404 | 409 | 422 = 400) {
    super(message);
    this.name = 'BoardError';
    this.statusCode = statusCode;
  }
}

export const MAX_BOARDS_PER_USER = 20;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function oid(value: unknown, label: string, statusCode: 400 | 401 | 404 = 400): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw new BoardError(`Invalid ${label}.`, statusCode);
  }
  return new Types.ObjectId(value);
}

function cleanText(value: unknown, label: string, max: number, { required = false } = {}): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new BoardError(`${label} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new BoardError(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new BoardError(`${label} is required.`);
  if (trimmed.length > max) throw new BoardError(`${label} must be ${max} characters or fewer.`);
  if (CONTROL_CHARS.test(trimmed)) throw new BoardError(`${label} contains characters that are not allowed.`);
  return trimmed || undefined;
}

function cleanEventType(value: unknown): BoardEventType {
  if (typeof value !== 'string' || !(BOARD_EVENT_TYPES as readonly string[]).includes(value)) {
    throw new BoardError(`Event type must be one of: ${BOARD_EVENT_TYPES.join(', ')}.`);
  }
  return value as BoardEventType;
}

function cleanEventDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isIsoDate(value)) throw new BoardError('Event date must be a valid date (YYYY-MM-DD).');
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) throw new BoardError('Event date must be between the years 2000 and 2100.');
  return isoDateToUtcMidnight(value);
}

function cleanStylePreferences(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BoardError('Style preferences must be a list.');
  const cleaned: string[] = [];
  for (const entry of value) {
    const text = cleanText(entry, 'Each style preference', MAX_STYLE_PREFERENCE_LENGTH);
    if (text && !cleaned.some((c) => c.toLowerCase() === text.toLowerCase())) cleaned.push(text);
  }
  if (cleaned.length > MAX_STYLE_PREFERENCES) {
    throw new BoardError(`You can add up to ${MAX_STYLE_PREFERENCES} style preferences.`);
  }
  return cleaned;
}

export interface BoardSummary {
  id: string;
  name: string;
  eventType: BoardEventType;
  eventDate: string | null;
  itemCount: number;
  coverImages: string[];
  updatedAt: string;
}

export interface BoardItemView {
  id: string;
  kind: BoardItemKind;
  note?: string;
  addedAt: string;
  available: boolean;
  imageUrl?: string;
  imageAlt?: string;
  title: string;
  subtitle?: string;
  href?: string;
  credit?: string;
}

export interface BoardDetail extends BoardSummary {
  notes: string;
  stylePreferences: string[];
  items: BoardItemView[];
  createdAt: string;
}

function itemImageUrl(item: IBoardItem): string | null {
  if (item.kind === 'look' && item.savedLook) return `/api/user/moodboards/${item.savedLook.toString()}/image`;
  if (item.kind === 'upload' && item.upload) return `/api/user/board-images/${item.upload.toString()}`;
  if (item.kind === 'portfolio' && item.imageUrl) return item.imageUrl;
  return null;
}

function toSummary(board: Record<string, any>): BoardSummary {
  const items: IBoardItem[] = board.items ?? [];
  return {
    id: board._id.toString(),
    name: board.name,
    eventType: board.eventType,
    eventDate: board.eventDate ? utcMidnightToIsoDate(board.eventDate) : null,
    itemCount: items.length,
    coverImages: items.map(itemImageUrl).filter((u): u is string => Boolean(u)).slice(-4).reverse(),
    updatedAt: new Date(board.updatedAt).toISOString(),
  };
}

export async function listBoards(userId: string): Promise<BoardSummary[]> {
  const user = oid(userId, 'account', 401);
  const boards = await PlanningBoard.find({ user })
    .sort({ updatedAt: -1 })
    .limit(MAX_BOARDS_PER_USER * 2)
    .lean<Array<Record<string, any>>>();
  return boards.map(toSummary);
}

export interface BoardInput {
  name?: unknown;
  eventType?: unknown;
  eventDate?: unknown;
  notes?: unknown;
  stylePreferences?: unknown;
}

export async function createBoard(userId: string, input: BoardInput): Promise<BoardSummary> {
  const user = oid(userId, 'account', 401);
  const name = cleanText(input.name, 'Board name', MAX_BOARD_NAME_LENGTH, { required: true })!;
  const eventType = input.eventType === undefined ? 'wedding' : cleanEventType(input.eventType);
  const eventDate = cleanEventDate(input.eventDate);
  const notes = cleanText(input.notes, 'Notes', MAX_BOARD_NOTES_LENGTH);
  const stylePreferences = cleanStylePreferences(input.stylePreferences);

  const count = await PlanningBoard.countDocuments({ user });
  if (count >= MAX_BOARDS_PER_USER) {
    throw new BoardError(`You can have up to ${MAX_BOARDS_PER_USER} moodboards. Delete one to create another.`, 422);
  }

  const board = await PlanningBoard.create({
    user,
    name,
    eventType,
    ...(eventDate ? { eventDate } : {}),
    ...(notes ? { notes } : {}),
    stylePreferences,
    items: [],
  });
  return toSummary(board.toObject());
}

export async function updateBoard(userId: string, boardId: string, input: BoardInput): Promise<BoardSummary> {
  const user = oid(userId, 'account', 401);
  const _id = oid(boardId, 'board ID');
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};

  if (input.name !== undefined) $set.name = cleanText(input.name, 'Board name', MAX_BOARD_NAME_LENGTH, { required: true });
  if (input.eventType !== undefined) $set.eventType = cleanEventType(input.eventType);
  if (input.eventDate !== undefined) {
    const eventDate = cleanEventDate(input.eventDate);
    if (eventDate) $set.eventDate = eventDate;
    else $unset.eventDate = '';
  }
  if (input.notes !== undefined) {
    const notes = cleanText(input.notes, 'Notes', MAX_BOARD_NOTES_LENGTH);
    if (notes) $set.notes = notes;
    else $unset.notes = '';
  }
  if (input.stylePreferences !== undefined) $set.stylePreferences = cleanStylePreferences(input.stylePreferences);

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    throw new BoardError('No changes were provided.');
  }

  const updated = await PlanningBoard.findOneAndUpdate(
    { _id, user },
    { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
    { new: true, runValidators: true }
  ).lean<Record<string, any>>();
  if (!updated) throw new BoardError('Moodboard not found.', 404);
  return toSummary(updated);
}

export async function deleteBoard(userId: string, boardId: string): Promise<void> {
  const user = oid(userId, 'account', 401);
  const _id = oid(boardId, 'board ID');
  const result = await PlanningBoard.deleteOne({ _id, user });
  if (result.deletedCount === 0) throw new BoardError('Moodboard not found.', 404);
  await BoardImage.deleteMany({ board: _id, user });
}

export async function getBoard(userId: string, boardId: string): Promise<BoardDetail | null> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(boardId)) return null;
  const user = new Types.ObjectId(userId);
  const board = await PlanningBoard.findOne({ _id: new Types.ObjectId(boardId), user }).lean<Record<string, any>>();
  if (!board) return null;

  const items: IBoardItem[] = board.items ?? [];
  const lookIds = items.filter((i) => i.kind === 'look' && i.savedLook).map((i) => i.savedLook!);
  const uploadIds = items.filter((i) => i.kind === 'upload' && i.upload).map((i) => i.upload!);
  const vendorSlugs = [...new Set(items.map((i) => i.vendorSlug).filter((s): s is string => Boolean(s)))];
  const serviceIds = items.filter((i) => i.kind === 'service' && i.service).map((i) => i.service!);

  const [looks, uploads, vendors, services] = await Promise.all([
    lookIds.length
      ? SavedMoodboard.find({ _id: { $in: lookIds }, user }).select('label').lean<Array<{ _id: Types.ObjectId; label: string }>>()
      : [],
    uploadIds.length
      ? BoardImage.find({ _id: { $in: uploadIds }, user }).select('_id').lean<Array<{ _id: Types.ObjectId }>>()
      : [],
    vendorSlugs.length
      ? Vendor.find({ slug: { $in: vendorSlugs } })
          .select('slug name profileImageUrl flags.isActive location.microLocation portfolio.imageUrl')
          .lean<Array<Record<string, any>>>()
      : [],
    serviceIds.length
      ? Service.find({ _id: { $in: serviceIds } })
          .select('name slug pricing.unitPriceINR duration.baseDurationMinutes flags.isActive vendor')
          .lean<Array<Record<string, any>>>()
      : [],
  ]);

  const lookMap = new Map(looks.map((l) => [l._id.toString(), l]));
  const uploadSet = new Set(uploads.map((u) => u._id.toString()));
  const vendorMap = new Map(vendors.map((v) => [v.slug, v]));
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

  const views: BoardItemView[] = items.map((item) => {
    const base = {
      id: item._id.toString(),
      kind: item.kind,
      note: item.note || undefined,
      addedAt: new Date(item.addedAt).toISOString(),
    };
    if (item.kind === 'look') {
      const look = item.savedLook ? lookMap.get(item.savedLook.toString()) : undefined;
      return look
        ? { ...base, available: true, imageUrl: itemImageUrl(item)!, imageAlt: look.label, title: look.label, subtitle: 'Saved look', href: '/journey?tab=looks' }
        : { ...base, available: false, title: 'Saved look removed', subtitle: 'This saved look was deleted.' };
    }
    if (item.kind === 'upload') {
      const exists = item.upload ? uploadSet.has(item.upload.toString()) : false;
      return exists
        ? { ...base, available: true, imageUrl: itemImageUrl(item)!, imageAlt: item.imageAlt || 'Your inspiration image', title: item.imageAlt || 'Your inspiration', subtitle: 'Uploaded by you · private' }
        : { ...base, available: false, title: 'Image unavailable', subtitle: 'This upload could not be found.' };
    }
    const vendor = item.vendorSlug ? vendorMap.get(item.vendorSlug) : undefined;
    const vendorLive = Boolean(vendor?.flags?.isActive);
    if (item.kind === 'portfolio') {
      const stillInPortfolio = vendorLive && (vendor?.portfolio ?? []).some((p: { imageUrl: string }) => p.imageUrl === item.imageUrl);
      return stillInPortfolio
        ? {
            ...base,
            available: true,
            imageUrl: item.imageUrl,
            imageAlt: item.imageAlt || `Portfolio image by ${vendor!.name}`,
            title: item.imageAlt || 'Portfolio image',
            subtitle: `From ${vendor!.name}'s portfolio`,
            href: `/artists/${vendor!.slug}`,
            credit: vendor!.name,
          }
        : { ...base, available: false, title: 'Portfolio image unavailable', subtitle: 'The artist has removed this image or is no longer listed.' };
    }
    if (item.kind === 'artist') {
      return vendorLive
        ? {
            ...base,
            available: true,
            imageUrl: vendor!.profileImageUrl || undefined,
            imageAlt: vendor!.name,
            title: vendor!.name,
            subtitle: vendor!.location?.microLocation ? `Artist · ${vendor!.location.microLocation}` : 'Artist',
            href: `/artists/${vendor!.slug}`,
          }
        : { ...base, available: false, title: 'Artist unavailable', subtitle: 'This artist is no longer listed.' };
    }
    const service = item.service ? serviceMap.get(item.service.toString()) : undefined;
    const serviceLive = Boolean(service?.flags?.isActive) && vendorLive && service?.vendor?.toString() === vendor?._id?.toString();
    return serviceLive
      ? {
          ...base,
          available: true,
          title: service!.name,
          subtitle: `${vendor!.name} · ₹${Number(service!.pricing?.unitPriceINR ?? 0).toLocaleString('en-IN')} · ${service!.duration?.baseDurationMinutes ?? 0} min`,
          href: `/artists/${vendor!.slug}/services/${service!.slug}`,
          credit: vendor!.name,
        }
      : { ...base, available: false, title: item.serviceName || 'Service unavailable', subtitle: 'This service is no longer offered.' };
  });

  return {
    ...toSummary(board),
    notes: board.notes ?? '',
    stylePreferences: board.stylePreferences ?? [],
    items: views,
    createdAt: new Date(board.createdAt).toISOString(),
  };
}

export interface AddItemInput {
  kind?: unknown;
  note?: unknown;
  savedLookId?: unknown;
  vendorSlug?: unknown;
  imageUrl?: unknown;
  serviceId?: unknown;
}

async function pushItem(user: Types.ObjectId, boardId: Types.ObjectId, item: Record<string, unknown>, duplicateMatch: Record<string, unknown> | null) {
  const filter: Record<string, unknown> = {
    _id: boardId,
    user,
    [`items.${MAX_BOARD_ITEMS - 1}`]: { $exists: false },
  };
  if (duplicateMatch) filter.items = { $not: { $elemMatch: duplicateMatch } };

  const updated = await PlanningBoard.findOneAndUpdate(
    filter,
    { $push: { items: item } },
    { new: true, runValidators: true, projection: { items: { $slice: -1 } } }
  ).lean<Record<string, any>>();
  if (updated) return updated.items[0]._id.toString() as string;

  const board = await PlanningBoard.findOne({ _id: boardId, user }).select('items').lean<{ items: IBoardItem[] }>();
  if (!board) throw new BoardError('Moodboard not found.', 404);
  if (board.items.length >= MAX_BOARD_ITEMS) {
    throw new BoardError(`A moodboard can hold up to ${MAX_BOARD_ITEMS} items. Remove something to add more.`, 422);
  }
  throw new BoardError('That is already on this moodboard.', 409);
}

export async function addItem(userId: string, boardId: string, input: AddItemInput): Promise<{ itemId: string }> {
  const user = oid(userId, 'account', 401);
  const board = oid(boardId, 'board ID');
  const kind = input.kind;
  if (typeof kind !== 'string' || !(BOARD_ITEM_KINDS as readonly string[]).includes(kind) || kind === 'upload') {
    throw new BoardError('kind must be one of: look, portfolio, artist, service.');
  }
  const note = cleanText(input.note, 'Note', MAX_BOARD_ITEM_NOTE_LENGTH);
  const base = { kind, addedAt: new Date(), ...(note ? { note } : {}) };

  if (kind === 'look') {
    const lookId = oid(input.savedLookId, 'saved look ID');
    const look = await SavedMoodboard.findOne({ _id: lookId, user }).select('_id').lean();
    if (!look) throw new BoardError('Saved look not found.', 404);
    return { itemId: await pushItem(user, board, { ...base, savedLook: lookId }, { kind: 'look', savedLook: lookId }) };
  }

  const vendorSlug = typeof input.vendorSlug === 'string' ? input.vendorSlug.trim().toLowerCase() : '';
  if (!/^[a-z0-9-]{1,120}$/.test(vendorSlug)) throw new BoardError('A valid artist is required.');
  const vendor = await Vendor.findOne({ slug: vendorSlug, 'flags.isActive': true })
    .select('_id slug name portfolio.imageUrl portfolio.altText')
    .lean<{ _id: Types.ObjectId; slug: string; name: string; portfolio?: Array<{ imageUrl: string; altText?: string }> }>();
  if (!vendor) throw new BoardError('Artist not found.', 404);

  if (kind === 'artist') {
    return { itemId: await pushItem(user, board, { ...base, vendorSlug }, { kind: 'artist', vendorSlug }) };
  }

  if (kind === 'portfolio') {
    const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
    const portfolioItem = (vendor.portfolio ?? []).find((p) => p.imageUrl === imageUrl);
    if (!portfolioItem) throw new BoardError('That image is not part of this artist’s portfolio.', 404);
    return {
      itemId: await pushItem(
        user,
        board,
        { ...base, vendorSlug, imageUrl, imageAlt: (portfolioItem.altText ?? '').slice(0, 150) || undefined },
        { kind: 'portfolio', imageUrl }
      ),
    };
  }

  const serviceId = oid(input.serviceId, 'service ID');
  const service = await Service.findOne({ _id: serviceId, vendor: vendor._id, 'flags.isActive': true })
    .select('_id name')
    .lean<{ _id: Types.ObjectId; name: string }>();
  if (!service) throw new BoardError('Service not found for this artist.', 404);
  return {
    itemId: await pushItem(user, board, { ...base, vendorSlug, service: serviceId, serviceName: service.name }, { kind: 'service', service: serviceId }),
  };
}

export interface UploadInput {
  data?: unknown;
  mimeType?: unknown;
  caption?: unknown;
  note?: unknown;
}

export async function uploadBoardImage(userId: string, boardId: string, input: UploadInput): Promise<{ itemId: string }> {
  const user = oid(userId, 'account', 401);
  const board = oid(boardId, 'board ID');
  if (typeof input.mimeType !== 'string' || !BOARD_IMAGE_MIME_TYPES.includes(input.mimeType)) {
    throw new BoardError('Images must be JPEG, PNG or WebP.');
  }
  if (typeof input.data !== 'string' || !input.data || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) {
    throw new BoardError('Image data is missing or invalid.');
  }
  const bytes = Math.floor((input.data.length * 3) / 4) - (input.data.endsWith('==') ? 2 : input.data.endsWith('=') ? 1 : 0);
  if (bytes > MAX_BOARD_IMAGE_BYTES) {
    throw new BoardError(`Images must be under ${(MAX_BOARD_IMAGE_BYTES / (1024 * 1024)).toFixed(1)}MB after resizing.`);
  }
  const caption = cleanText(input.caption, 'Caption', 150);
  const note = cleanText(input.note, 'Note', MAX_BOARD_ITEM_NOTE_LENGTH);

  const exists = await PlanningBoard.exists({ _id: board, user });
  if (!exists) throw new BoardError('Moodboard not found.', 404);
  const uploadCount = await BoardImage.countDocuments({ user });
  if (uploadCount >= MAX_BOARD_IMAGES_PER_USER) {
    throw new BoardError(`You can upload up to ${MAX_BOARD_IMAGES_PER_USER} inspiration images. Remove an upload to add another.`, 422);
  }

  const image = await BoardImage.create({ user, board, data: input.data, mimeType: input.mimeType, bytes });
  try {
    const itemId = await pushItem(
      user,
      board,
      { kind: 'upload', addedAt: new Date(), upload: image._id, ...(caption ? { imageAlt: caption } : {}), ...(note ? { note } : {}) },
      null
    );
    return { itemId };
  } catch (err) {
    await BoardImage.deleteOne({ _id: image._id, user });
    throw err;
  }
}

export async function updateItemNote(userId: string, boardId: string, itemId: string, note: unknown): Promise<void> {
  const user = oid(userId, 'account', 401);
  const _id = oid(boardId, 'board ID');
  const item = oid(itemId, 'item ID');
  const cleaned = cleanText(note, 'Note', MAX_BOARD_ITEM_NOTE_LENGTH);
  const result = await PlanningBoard.updateOne(
    { _id, user, 'items._id': item },
    cleaned ? { $set: { 'items.$.note': cleaned } } : { $unset: { 'items.$.note': '' } }
  );
  if (result.matchedCount === 0) throw new BoardError('Item not found.', 404);
}

export async function removeItem(userId: string, boardId: string, itemId: string): Promise<void> {
  const user = oid(userId, 'account', 401);
  const _id = oid(boardId, 'board ID');
  const item = oid(itemId, 'item ID');
  const board = await PlanningBoard.findOneAndUpdate(
    { _id, user, 'items._id': item },
    { $pull: { items: { _id: item } } },
    { projection: { items: { $elemMatch: { _id: item } } } }
  ).lean<{ items?: IBoardItem[] }>();
  if (!board) throw new BoardError('Item not found.', 404);
  const removed = board.items?.[0];
  if (removed?.kind === 'upload' && removed.upload) {
    await BoardImage.deleteOne({ _id: removed.upload, user });
  }
}

export async function getBoardImage(userId: string, imageId: string): Promise<{ data: string; mimeType: string } | null> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(imageId)) return null;
  return BoardImage.findOne({ _id: new Types.ObjectId(imageId), user: new Types.ObjectId(userId) })
    .select('data mimeType')
    .lean<{ data: string; mimeType: string }>();
}

export async function listBoardsForPicker(userId: string): Promise<Array<{ id: string; name: string; eventType: BoardEventType; itemCount: number }>> {
  const boards = await listBoards(userId);
  return boards.map((b) => ({ id: b.id, name: b.name, eventType: b.eventType, itemCount: b.itemCount }));
}
