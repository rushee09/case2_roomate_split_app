import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groups = await db.group.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { members: true, expenses: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; currency?: string };
  try { body = await req.json(); } catch { body = {}; }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const group = await db.group.create({
    data: {
      name,
      currency: body.currency ?? "INR",
      inviteCode: generateInviteCode(),
      members: {
        create: {
          name: user.name ?? user.username ?? user.email,
          email: user.email,
          userId: user.id,
        },
      },
      activities: {
        create: {
          type: "GROUP_CREATED",
          data: JSON.stringify({ groupName: name, createdBy: user.name ?? user.username }),
        },
      },
    },
    include: { members: true, _count: { select: { members: true, expenses: true } } },
  });

  return NextResponse.json(group, { status: 201 });
}
