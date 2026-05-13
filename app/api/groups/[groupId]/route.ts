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

  const group = await db.group.findFirst({
    where: {
      id: params.groupId,
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: true,
      expenses: {
        include: { paidBy: true, splits: { include: { member: true } } },
        orderBy: { date: "desc" },
      },
      settlements: {
        include: { fromMember: true, toMember: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const group = await db.group.updateMany({
    where: { id: params.groupId, members: { some: { userId: session.user.id } } },
    data: { ...(body.name && { name: body.name }), ...(body.currency && { currency: body.currency }) },
  });
  if (!group.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await db.group.findUnique({ where: { id: params.groupId } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.group.deleteMany({
    where: { id: params.groupId, members: { some: { userId: session.user.id } } },
  });
  return NextResponse.json({ ok: true });
}
