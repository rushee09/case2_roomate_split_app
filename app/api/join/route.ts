import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/join?code=XXXXXX — preview a group by invite code
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const group = await db.group.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: group.id,
    name: group.name,
    currency: group.currency,
    inviteCode: group.inviteCode,
    memberCount: group._count.members,
  });
}

// POST /api/join — join a group by invite code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = (body.inviteCode as string)?.toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "inviteCode is required" }, { status: 400 });
  }

  const group = await db.group.findUnique({ where: { inviteCode: code } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Already a member?
  const existing = await db.member.findFirst({
    where: { groupId: group.id, userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ groupId: group.id, alreadyMember: true });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  await db.member.create({
    data: {
      groupId: group.id,
      name: user?.name ?? user?.username ?? user?.email ?? "Unknown",
      email: user?.email ?? "",
      userId: session.user.id,
    },
  });

  await db.activity.create({
    data: {
      groupId: group.id,
      type: "MEMBER_JOINED",
      data: JSON.stringify({ memberName: user?.name ?? user?.username }),
    },
  });

  return NextResponse.json({ groupId: group.id });
}

