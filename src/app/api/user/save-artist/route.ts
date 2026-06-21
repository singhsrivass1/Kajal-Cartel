import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/db/connect"; 
import User from "@/lib/db/models/User";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { artistSlug } = await req.json();
    if (!artistSlug) {
      return NextResponse.json({ error: "Artist slug required" }, { status: 400 });
    }

    await dbConnect();

    
    await User.findOneAndUpdate(
      { email: session.user.email },
      { $addToSet: { savedArtists: artistSlug } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save artist error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}