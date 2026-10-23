import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/db/connect";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rateLimit";
import User from "@/lib/db/models/User";
import Vendor from "@/lib/db/models/Vendor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Mirrors the schema's own cap; enforced here because findOneAndUpdate does not
 *  run array validators by default, so the model-level limit never fired. */
const MAX_SAVED_ARTISTS = 50;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = enforceRateLimit(req, "save-artist", RATE_LIMITS.generalWrite, {
      userId: session.user.email,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const raw = (body ?? {}) as Record<string, unknown>;
    const artistSlug = typeof raw.artistSlug === "string" ? raw.artistSlug.trim().toLowerCase() : "";

    // Previously this was a bare truthiness check, so any JSON value — an object,
    // an array, a number — would be written straight into savedArtists[].
    if (!artistSlug || !/^[a-z0-9-]+$/.test(artistSlug)) {
      return NextResponse.json({ error: "A valid artist slug is required." }, { status: 400 });
    }

    await dbConnect();

    const vendor = await Vendor.findOne({ slug: artistSlug, "flags.isActive": true })
      .select("_id")
      .lean();
    if (!vendor) {
      return NextResponse.json({ error: "That artist could not be found." }, { status: 404 });
    }

    const user = await User.findOne({ email: session.user.email }).select("savedArtists").lean<{
      savedArtists?: string[];
    }>();
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const saved = user.savedArtists ?? [];
    if (!saved.includes(artistSlug) && saved.length >= MAX_SAVED_ARTISTS) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_ARTISTS} artists. Remove one before saving another.` },
        { status: 422 }
      );
    }

    // No upsert: the session guarantees the account exists, and upserting here
    // could otherwise mint a user document containing nothing but an email.
    await User.updateOne(
      { email: session.user.email },
      { $addToSet: { savedArtists: artistSlug } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/user/save-artist] Unhandled error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const limited = enforceRateLimit(req, "save-artist", RATE_LIMITS.generalWrite, {
      userId: session.user.email,
    });
    if (limited) return limited;

    const artistSlug = (new URL(req.url).searchParams.get("artistSlug") ?? "").trim().toLowerCase();
    if (!artistSlug || !/^[a-z0-9-]+$/.test(artistSlug)) {
      return NextResponse.json({ error: "A valid artist slug is required." }, { status: 400 });
    }

    await dbConnect();
    await User.updateOne({ email: session.user.email }, { $pull: { savedArtists: artistSlug } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/user/save-artist] Unhandled error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
