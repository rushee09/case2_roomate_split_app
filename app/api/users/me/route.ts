import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ id: user.id, username: user.username, name: user.name, email: user.email, image: user.image });
}

// Handle username update directly in Next.js — avoids FastAPI dependency during onboarding
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.username !== undefined) {
    const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
    if (!USERNAME_RE.test(body.username)) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters: letters, numbers, underscores only." },
        { status: 400 }
      );
    }
    const lower = body.username.toLowerCase();
    const taken = await db.user.findFirst({
      where: { username: lower, NOT: { id: session.user.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }
    const user = await db.user.update({
      where: { id: session.user.id },
      data: { username: lower, ...(body.name ? { name: body.name } : {}) },
    });
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      image: user.image,
    });
  }

  return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
}
