import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await db.member.findMany({
    where: { groupId: params.groupId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, email } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const group = await db.group.findUnique({ where: { id: params.groupId } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const member = await db.member.create({
    data: { name: name.trim(), email: email || null, groupId: params.groupId },
  });

  await db.activity.create({
    data: {
      groupId: params.groupId,
      type: "MEMBER_ADDED",
      data: JSON.stringify({ memberName: name, memberId: member.id }),
    },
  });

  return NextResponse.json(member, { status: 201 });
}
